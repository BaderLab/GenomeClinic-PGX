/* 
 * MongoDB interface for node server.
 * @author Ron Ammar
 */

var MongoClient= require("mongodb").MongoClient;
var Promise = require("bluebird");
var assert= require("assert");
var dbConstants = require("../conf/constants.json").dbConstants;
var bcrypt = require("bcrypt-nodejs");
var randomstring = require("just.randomstring");
var pgx= require("../conf/pgx_haplotypes");


var dbFunctions = function(logger,DEBUG){
	var logInfo,logErr;
	if (!logger)
		logger = require('./logger')('db');	
	if (DEBUG){
		logInfo = console.log;
		logErr = console.log;
	} else {
		logInfo = logger.info;
		logErr = logger.error;
	}
//=======================================================================================
// Private properties
//=======================================================================================
/* Default DB parameters. */
	var dbURL,db,
		self = this;
	/* Connect to the DB using default parameters.
	 * If connection has already been initialized, but closed, it is opened.
	 * If connection is already open, the connection pool is refereshed.
	 * Returns a promise if connection does not exist, null otherwise. */
	var connect= function() {
		// if DB exists and is open/closed, refresh/open the connection pool
		if (db) {
			db.open();
			return null;
		}

		dbURL= "mongodb://" + dbConstants.DB.HOST + ":" + dbConstants.DB.PORT + "/" + dbConstants.DB.NAME;

		var promise= new Promise(function(resolve, reject) {
			MongoClient.connect(dbURL, function(err, db) {
				if (err) {
					reject(err);
				}
				logInfo("connected to " + dbURL);
				resolve(db);
			});
		});
		return promise;
	};



	/* Create the collections required for an initialized DB.
	 * Returns a promise. */
	var createInitCollections= function() {
		logInfo("configuring server, creating default collections, rules, and indexes");
		assert.notStrictEqual(db, undefined); // ensure we're connected first
		var promise= new Promise(function(resolve, reject) {
			var currentDocument = {};
			currentDocument[dbConstants.PATIENTS.CURRENT_INDEX_FIELD]= 1;
			currentDocument[dbConstants.PANELS.CURRENT_INDEX_FIELD]= 1;
			// when the DB is first initialized, the server is not configured
			currentDocument[dbConstants.DB.SERVER_CONFIGURED_FIELD]= false;

			// Create a patient collection and index by unique identifiers.
			// Do the same for panel collections.
			self.insert(dbConstants.DB.DMIN_COLLECTION, currentDocument)
				.then(function(result) {
					// Patient IDs are unique.
					currentDocument= {};
					currentDocument[dbConstants.PATIENTS.ID_FIELD]= 1;  // index in ascending order
					return self.createIndex(dbConstants.PATIENTS.COLLECTION, currentDocument, {unique: true});
				})
				.then(function(result){
					// Patient Collection IDs are also unique
					currentDocument= {};
					currentDocument[dbConstants.PATIENTS.COLLECTION_ID_]= -1;  // index in descending order
					return self.createIndex(dbConstants.PATIENTS.COLLECTION, currentDocument, {unique: true});
				})
				.then(function(result){
					var currentDocument = {};
					currentDocument[dbConstants.USERS.ID_FIELD]=-1;
					return self.createIndex(dbConstants.USERS.COLLECTION,currentDocument,{unique:true});
				})
				.then(function(result) {
					// Panel IDs are unique.
					currentDocument= {};
					currentDocument[dbConstants.PANELS.ID_FIELD]= 1;  // index in ascending order
					return self.createIndex(dbConstants.PANELS.COLLECTION, currentDocument, {unique: true});
				})
				.then(function(result){
					// Panel Collection IDs are also unique
					currentDocument= {};
					currentDocument[dbConstants.PANELS.COLLECTION_ID]= -1;  // index in descending order
					return self.createIndex(dbConstants.PANELS.COLLECTION, currentDocument, {unique: true});
				})
				.then(function(result){
					//project_id field should be unique
					currentDocument = {};
					currentDocument[dbConstants.PROJECTS.ID_FIELD] = 1; // index in ascending order
					return self.createIndex(dbConstants.PROJECTS.COLLECTION, currentDocument,{unique:true}); 
				})
				.then(function(result) {
					resolve();
				})
				.catch(function(err) {
					logErr(err);
					reject(err);
				});
		});
		return promise;
	};

	/* general find query to find All documents matching string. 
	 * Returns a promise. */
	var find= function(collectionName, query, fields, options) {
		assert.notStrictEqual(db, undefined); // ensure we're connected first

		// validate input
		assert(Object.prototype.toString.call(collectionName) == "[object String]",
			"Invalid collection");
		assert(Object.prototype.toString.call(query) == "[object Object]",
			"Invalid query");

		if (options){
			if(options == {})
				options = undefined;

			else if (options)
				assert(Object.prototype.toString.call(options) == "[object Object]",
					"Invalid Options");
		}
		var promise= new Promise(function(resolve, reject) {
			db.collection(collectionName)
			.find(query, fields, options)
			.toArray(function(err, doc) {
				if (err) {
					reject(err);
				}
				resolve(doc);
			});
		});
		return promise;	
	};


	/* find and remove a patient where options are the query to submit
 	* returns a promise */
	var removeDocument = function(collectionName,options,sort){
		assert.notStrictEqual(db, undefined); // ensure we're connected first

		// validate input
		assert(Object.prototype.toString.call(options) == "[object Object]",
			"Invalid Options");

		logInfo('removing document from collection', {'collection':collectionName,query:options});
		var promise = new Promise(function(resolve,reject){
			var collection = db.collection(collectionName);
			collection.findAndRemove(options,sort,function(err,doc){
				if (err){
					reject(err);
				} else {
					resolve(doc);
				}
			});	
		});
		return promise;
	};

//=======================================================================================
//=======================================================================================
//Public functions
//=======================================================================================
//=======================================================================================


	//=======================================================================================
	//Connection and Initializaition
	//=======================================================================================
	/* Close the DB connection. */
	this.closeConnection= function(callback) {
		logInfo('closing Connection');
		assert.notStrictEqual(db, undefined); // ensure we're connected first
		db.close(callback);
	};

	/* Connect to the DB and initialize it using defaults if the DB has not been
	 * initialized already. if silent exists, will not print to console.*/
	this.connectAndInitializeDB= function(silent) {
		var promise= new Promise(function(resolve, reject) {
			// Connect to MongoDB
			connect().then(function(result) {
				db= result;
				if (!silent)
					logInfo("Connected to MongoDB at " + dbURL);

				/* Check if the "FrangipaniDB" DB already exists. If it doesn't, 
				 * we need to intialize the DB. */
				self.count(dbConstants.DB.SYSTEM_NAMESPACES).then(function(result) {
				 	if (!result) { // # of collections in DB is 0
				 		if (!silent){
				 			logInfo("initializing database.");
				 		}
				 		createInitCollections()
				 			.catch(function(err) {
			 					reject(err);
			 				});
				 	} else {
				 		if (!silent)
				 			logInfo("database has already been initialized.");
				 	}
				 	resolve();
				 }).catch(function(err) {
				 	reject(err);
				 });
			}).catch(function(err) {
				reject(err);
			});
		});
		return promise;
	};

	/* Change or check if the server has been configured.
	 * If changing the status of the configuration, use the set parameter.
	 * set === true, changes the configured status to true.
	 * If set is omitted, function returns the status as a boolean.
	 * Returns a promise. */
	this.isConfigured= function(set) {
		assert.notStrictEqual(db, undefined); // ensure we're connected first
		assert(Object.prototype.toString.call(set) == "[object Boolean]" || Object.prototype.toString.call(set) == "[object Undefined]","Invalid config set parameter");

		logInfo("checking database configuration setting");
		var promise= new Promise(function(resolve, reject) {
			if (set === undefined) {  // Return config status
				self.findOne(dbConstants.DB.ADMIN_COLLECTION, {})
					.then(function(doc) {
						resolve(doc[dbConstants.DB.SERVER_CONFIGURED_FIELD]);
					}).catch(function(err) {
						reject(err);
					});
			} else { // set config status
				var currentDocument= {};
				currentDocument[dbConstants.DB.SERVER_CONFIGURED_FIELD]= set;
				self.update(dbConstants.DB.ADMIN_COLLECTION, {}, {$set: currentDocument})
					.then(function(doc) {
						resolve();
					}).catch(function(err) {
						reject(err);
					});
			}
		});
		return promise;
	};


	//=======================================================================================
	//Generic collection and document control
	//=======================================================================================
	/* Insert a document into a collection.
	 * Returns a promise. */
	this.insert= function(collectionName, doc) {
		assert.notStrictEqual(db, undefined); // ensure we're connected first

		// validate input
		assert(Object.prototype.toString.call(collectionName) == "[object String]",
			"Invalid collection");
		assert(Object.prototype.toString.call(doc) == "[object Object]",
			"Invalid document");

		logInfo('inserting document', {'collection':collectionName});
		var promise= new Promise(function(resolve, reject) {
			db.collection(collectionName).insert(doc, {}, function(err, result) {
				if (err) {
					reject(err);
				}
				resolve(doc);
			});
		});
		return promise;
	};

	/* Insert Many documents at once into a collection.
	 * Takes one Object with two paramters arguments:
	 * tablename: tablename
	 * documents: {object to insert}
	 * Returns a promise. */
	this.insertMany = function(options){
		assert.notStrictEqual(db, undefined); // ensure we're connected first

		// validate input
		assert(Object.prototype.toString.call(options) == "[object Object]",
			"Invalid Options");

		logInfo('inserting %d documents',options.documents.length,{'collection':options.collectionName});
		var promise = new Promise(function(resolve,reject){
			if(!options.collectionName)
				reject(new ReferenceError("No Collection Name Provided"));
			//if(options.documents.length > 100)
			//		reject(new Error("Must contain less then 1000 documents"))
			db.collection(options.collectionName,function(err,collection){
				var bulk = collection.initializeOrderedBulkOp();
				for (var i = 0; i < options.documents.length; i++){
					bulk.insert(options.documents[i]);
				}
				bulk.execute(function(err,doc){
					if(err){
						reject(err);
					} else {
						resolve(doc);
					}
				});
			});
		});
		return promise;
	};


	/* Update documents based on the query selector with the doc specifying which 
	 * fields to update.
	 * Returns a promise. */
	this.update= function(collectionName, query, doc, options) {
		assert.notStrictEqual(db, undefined); // ensure we're connected first

		// validate input
		assert(Object.prototype.toString.call(collectionName) == "[object String]",
			"Invalid collection");
		assert(Object.prototype.toString.call(query) == "[object Object]",
			"Invalid query");
		assert(Object.prototype.toString.call(doc) == "[object Object]",
			"Invalid update document");
		if (options)
			assert(Object.prototype.toString.call(options) == "[object Object]",
			"Invalid update options");


		logInfo("updating document",{'query':query,'doc':doc,'collectionName':collectionName,'options':options});
		var promise= new Promise(function(resolve, reject) {
			db.collection(collectionName).update(query, doc, options, function(err, resultDoc) {
				if (err) {
					reject(err);
				}
				resolve(resultDoc);
			});
		});
		return promise;
	};

	/* Create index for a specific field in a collection.
	 * spec format example: {a:1, b:-1}, a in ascending index order, b in descending
	 * options format example: {unique: true} to ensure that the index is unique
	 * Returns a promise. */
	this.createIndex= function(collectionName, spec, options) {
		assert.notStrictEqual(db, undefined); // ensure we're connected first

		// validate input
		assert(Object.prototype.toString.call(collectionName) == "[object String]",
			"Invalid collection");
		assert(Object.prototype.toString.call(spec) == "[object Object]",
			"Invalid spec");

		var promise= new Promise(function(resolve, reject) {
			db.collection(collectionName).createIndex(spec, options, function(err, result) {
				if (err) {
					reject(err);
				}
				resolve(result);
			});
		});
		return promise;	
	};

	/* Find a single document based on the query. 
	 * Returns a promise. */
	this.findOne= function(collectionName, query) {
		assert.notStrictEqual(db, undefined); // ensure we're connected first

		// validate input
		assert(Object.prototype.toString.call(collectionName) == "[object String]",
			"Invalid collection");
		assert(Object.prototype.toString.call(query) == "[object Object]",
			"Invalid query");
		var promise= new Promise(function(resolve, reject) {
			db.collection(collectionName).findOne(query,function(err, doc) {
				if (err) {
		
					reject(err);
				}
				resolve(doc);
			});
		});
		return promise;	
	};


	/* Return the count of documents matching the query.
	 * Returns a promise. */
	this.count= function(collectionName, query) {
		assert.notStrictEqual(db, undefined); // ensure we're connected first

		var promise= new Promise(function(resolve, reject) {
			db.collection(collectionName).count(query, function(err, count){
				if (err) {
					reject(err);
				}
				resolve(count);
			});
		});
		return promise;
	};


	/* Create a new collection, raising an error if it already exists
	 * returns a promise */

	this.createCollection = function(name){
		assert.notStrictEqual(db, undefined);

		logInfo('creating Collection %s',name);
		var promise = new Promise(function(resolve,reject){
			if (name){
				db.createCollection(name,{strict:true},function(err,collection){
					if ( err ){
						reject(err);
					} else {
						resolve(collection);
					}
				});
			}
		});
		return promise;
	};

	/* Drop a currently existing collection
	 * returns a promise */
	this.dropCollection = function(collectionName){
		assert.notStrictEqual(db, undefined); 
		assert(Object.prototype.toString.call(collectionName) == "[object String]",
			"Invalid Options");

		logInfo('dropping collection %d', collectionName);
		var promise = new Promise(function(resolve,reject){
			db.dropCollection(collectionName, function(err,done){
				if (err){
					reject(err);
				} else {
					resolve(done);
				}
			});
		});
		return promise;
	};

	/* Check within the specified database to determine whether or not an item exists*/
	this.checkInDatabase = function(collection,field,value){
		assert.notStrictEqual(db, undefined);
		assert(Object.prototype.toString.call(collection) == "[object String]",
			"Invalid collection");
		assert(Object.prototype.toString.call(field) == "[object String]",
			"Invalid collection");
		assert(Object.prototype.toString.call(value) == "[object String]",
			"Invalid collection");
		var query = {};
		query[field] = value;
		return this.findOne(collection,query).then(function(result){
			if (result){
				return true;
			} else {
				return false;
			}
		});
	};

	//get the owner of a field
	this.getOwner = function(collection,field){
		assert.notStrictEqual(db, undefined);
		assert(Object.prototype.toString.call(collection) == "[object String]",
			"Invalid collection");
		assert(Object.prototype.toString.call(field) == "[object String]",
			"Invalid collection");
		var query = {};
		if (collection === dbConstants.PROJECTS.COLLECTION){
			query[dbConstants.PROJECTS.ID_FIELD]=field;
		} else if (collection === dbConstants.PATIENTS.COLLECTION){
			query[dbConstants.PATIENTS.ID_FIELD]=field;
		}
		return self.findOne(collection,query).then(function(result){
			if (result){
				return result[dbConstants.DB.OWNER_ID];
			} else {
				return undefined;
			}
		});

	};


	//=======================================================================================
	//Project functions
	//=======================================================================================

	this.findProjects = function(projectName, username){
		assert.notStrictEqual(db, undefined);
		var query = {$or:[]};
		var fields = [dbConstants.PROJECTS.AUTH_USER_FIELD,dbConstants.DB.OWNER_ID];
		fields.forEach(function(item){
			var o = {};
			o[item] = username;
			query.$or.push(o);
		});


		if (projectName){
			query[dbConstants.PROJECTS.ID_FIELD] = projectName;
		}
		var resultArray;
		return find(dbConstants.PROJECTS.COLLECTION,query).then(function(result){
			resultArray = result;
			return resultArray;
		}).each(function(doc,index){
			var query = {};
			query[dbConstants.PROJECTS.ARRAY_FIELD] = doc[dbConstants.PROJECTS.ID_FIELD];
			return self.count(dbConstants.PATIENTS.COLLECTION,query).then(function(result){
				resultArray[index].numPatients = result;
			});
		}).then(function(){
			return resultArray;
		});

	};


	this.addProject = function(options){
		assert.notStrictEqual(db,undefined);
		assert(Object.prototype.toString.call(options) == '[object Object]',"Invalid options");
		//project info should have patient_id, details, and for future use, allowed users
		var projectInfo = options.project;
		projectInfo[dbConstants.PROJECTS.AUTH_USER_FIELD] = options.users;
		projectInfo[dbConstants.PROJECTS.DATE_ADDED] = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

		var patientTags = options.patients;
		var users = options.users;

		logInfo("adding new project to database",{projectInfo:projectInfo});
		return this.insert(dbConstants.PROJECTS.COLLECTION, projectInfo).then(function(result){
			if (patientTags) {
				return Promise.each(patientTags, function(patient){
					return self.addProjectToPatient(projectInfo[dbConstants.PROJECTS.ID_FIELD],patient).catch(function(err){
						logErr(err);
					});
				});
			}	
		});
	};

	/*remove project from collection */

	this.removeProject = function(project){
		var query = {};
		logInfo("removing %s project from database", project);
		query[dbConstants.PROJECTS.ID_FIELD] = project;
		return removeDocument(dbConstants.PROJECTS.COLLECTION,query,[[dbConstants.PROJECTS.ID_FIELD,1]]);
	};


	this.addProjectToPatient = function(project,patient){
		assert.notStrictEqual(db,undefined);
		assert(Object.prototype.toString.call(project) == "[object String]", "Invalid Project Name");
		assert(Object.prototype.toString.call(patient) == "[object String]", "Invalid Patient Name");

		var query = {};
		query[dbConstants.PATIENTS.ID_FIELD] = patient;
		doc = {};
		doc[dbConstants.PROJECTS.ARRAY_FIELD] = project;
		doc = {$addToSet:doc};
		return this.update(dbConstants.PATIENTS.COLLECTION, query, doc);
	};


	this.removePatientsFromProject = function(project, patients){
		assert.notStrictEqual(db,undefined);
		assert(Object.prototype.toString.call(project) == "[object String]", "Invalid Project Name");
		assert(Object.prototype.toString.call(patients) == "[object Array]", "Patients must be an array");
		var query = {};
		query[dbConstants.PATIENTS.ID_FIELD] = {$in:patients};
		var doc = {};
		doc[dbConstants.PROJECTS.ARRAY_FIELD] = project;
		doc = {$pull:doc};
		var options = {multi:true};
		return this.update(dbConstants.PATIENTS.COLLECTION, query, doc, options).then(function(result){
			return true;
		});
	};


	this.addPatientsToProject = function(project, patients){
		assert.notStrictEqual(db,undefined);
		assert(Object.prototype.toString.call(project) == "[object String]", "Invalid Project Name");
		assert(Object.prototype.toString.call(patients) == "[object Array]", "Patients must be an array");
		var query = {};
		query[dbConstants.PATIENTS.ID_FIELD] = {$in:patients};
		var doc = {};
		doc[dbConstants.PROJECTS.ARRAY_FIELD] = project;
		doc = {$addToSet:doc};
		var options = {multi:true};
		return this.update(dbConstants.PATIENTS.COLLECTION, query, doc, options).then(function(result){
			return true;
		});
	};


	//=======================================================================================
	//Patient Functions
	//=======================================================================================


	/* Create a patient with the input patient ID.
	 * Returns a promise which resolves to the new patient collection ID. */
	this.addPatient= function(options) {
		assert.notStrictEqual(db, undefined); // ensure we're connected first
		var currentPatientCollectionID;
		var promise= new Promise(function(resolve, reject) {
			/* Get most recent patient collection ID integer from the admin table
			 * and increment it. */
			logInfo('adding new patient: %s to databse',options[dbConstants.PATIENTS.ID_FIELD]);
			self.findOne(dbConstants.DB.ADMIN_COLLECTION, {})
				.then(function(doc) {
					currentPatientCollectionID= doc[dbConstants.PATIENTS.CURRENT_INDEX_FIELD];
					// Add new patient
					if (typeof options === 'object'){
						currentDocument = options;
					} else { 
						currentDocument= {};
						currentDocument[dbConstants.PATIENTS.ID_FIELD] = options;
					}

					if (currentDocument[dbConstants.PATIENTS.ID_FIELD]===undefined)
						throw new ReferenceError("No Patient ID provided");
						

					currentDocument[dbConstants.PATIENTS.COLLECTION_ID]= "p" + currentPatientCollectionID;
					return self.insert(dbConstants.PATIENTS.COLLECTION, currentDocument);
				}).then(function(result) {
					// Increment patient collection ID only after insert is done
					var currentDocument= {};
					currentDocument[dbConstants.PATIENTS.CURRENT_INDEX_FIELD]= 1;  // increment by 1
					return self.update(dbConstants.DB.ADMIN_COLLECTION, {}, {$inc: currentDocument});
				}).then(function(result) {
					resolve({newCollection:"p" + currentPatientCollectionID, document:currentDocument});
				}).catch(function(err) {
					logErr(err);
					reject(err);
				});
		});
		return promise;
	};

	/*remove patient from patient collection */
	this.removePatient = function(patient){
		var query = {};
		query[dbConstants.PATIENTS.ID_FIELD] = patient;
		logInfo('removing patient: %s from databse',patient);
		return removeDocument(dbConstants.PATIENTS.COLLECTION,query,[[dbConstants.PATIENTS.ID_FIELD,1]]);
	};

	/* Find all the patients in the 'patients' collection.
	 * Returns a promise that returns an array of elements corresponding to All
	 * the patient_id's*/
	this.findAllPatientIds=function(username){
		assert.notStrictEqual(db, undefined); // ensure we're connected first
		var collectionName = dbConstants.PATIENTS.COLLECTION;
		var options = {'_id':0};
		options[dbConstants.PATIENTS.ID_FIELD]=1;	
		return self.findProjects(undefined,username).then(function(result){
			var tags = result.map(function(item){
				return item[dbConstants.PROJECTS.ID_FIELD];
			});
			var tagQuery = {};
			tagQuery[dbConstants.PROJECTS.ARRAY_FIELD] = {$in:tags};
			var query = {$or:[tagQuery]};
			var q ={};
			q[dbConstants.DB.OWNER_ID] = username;
			query.$or.push(q);
			return find(collectionName, query, {}, options);
		});
	};


	/* find all the patients in the patient collection and return an array
	 * corresponding to the entire document of each patient.
	 * If readyOnly == true, return only fully uploaded patients.
	 * To get output sorted by date and time(newest patient records first), do:
	 * options == {sort: {"date": -1, "time": -1}} */
	this.findAllPatients=function(query, readyOnly, options, username, project,exclude){
		assert.notStrictEqual(db, undefined); // ensure we're connected first
		var collectionName = dbConstants.PATIENTS.COLLECTION;
		if (!query)
			query= {};
		if (username && !project)
			query[dbConstants.DB.OWNER_ID] = username;
		var fields = {'_id': 0};
		if (readyOnly) {
			query[dbConstants.PATIENTS.READY_FOR_USE]= true;
		}
		if (project){
			return find(collectionName, query,fields, options);
		} else {
			return self.findProjects(undefined,username).then(function(result){
				return result.map(function(item){
					if (exclude){
						if (item[dbConstants.PROJECTS.ID_FIELD] != exclude)
							return item[dbConstants.PROJECTS.ID_FIELD];
					} else {
						return item[dbConstants.PROJECTS.ID_FIELD];
					}
				});
			}).then(function(result){
				result = result.filter(function(n){return n!==undefined;});
				var tagQuery = {};
				tagQuery[dbConstants.PROJECTS.ARRAY_FIELD] = {$in:result};
				var newQuery = {$or:[query,tagQuery]};
				return find(collectionName,newQuery,fields,options);
			}).then(function(result){
				if (exclude) {
					return result.filter(function(patient){
						if (!patient[dbConstants.PROJECTS.ARRAY_FIELD])
							return patient;
						if (patient[dbConstants.PROJECTS.ARRAY_FIELD].indexOf(exclude)==-1){
							return patient;
						}
					});
				} else {
					return result;
				}
			});
		}
	};
	//=======================================================================================
	//PGX and Panels
	//=======================================================================================
	/* Create a panel from the input object (in JSON).
	 * There are 3 types of panels, "gene", "coord", "marker":
	 * 1) gene, 2) chromosomal coordinate, 3) marker
	 * If specifying gene or marker panel, pass in a list of genes/markers 
	 * (case insensitive):
	 * [{"gene": "cyp2d6"}, {"gene": "tpmt"}, {"gene": "brca1"}, {"gene": "plce1"}]
	 * or
	 * [{"marker": rs1128503"}, {"marker": "rs2032582"}, {"marker": "rs1045642"}]
	 * If specifying a coordinate panel, pass a list of objects (note chromosome
	 * must be passed in as a string, coordinate as an integer):
	 * [{"chr": "22", "coord": 4253023}, {"chr": "22", "coord": 4253028}]
	 * Returns a promise which resolves to the new panel's collection ID. */
	this.addPanel= function(panelName, panel) {
		assert.notStrictEqual(db, undefined); // ensure we're connected first
		
		// validate input
		assert(Object.prototype.toString.call(panelName) == "[object String]",
			"Invalid panel name");
		assert(Object.prototype.toString.call(panel) == "[object Array]",
			"Invalid panel");

		var currentPanelCollectionID;

		var promise= new Promise(function(resolve, reject) {
			/* Get most recent panel collection ID integer from the admin table
			 * and increment it. */
			logInfo('adding pannel: %s to databse',panelName);
			self.findOne(dbConstants.DB.ADMIN_COLLECTION, {})
				.then(function(doc) {
					currentPanelCollectionID= doc[dbConstants.PANELS.CURRENT_INDEX_FIELD];
					// Add panel collection ID to panels collection
					currentDocument= {};
					currentDocument[dbConstants.PANELS.ID_FIELD]= panelName;
					currentDocument[dbConstants.PANELS.COLLECTION_ID]= "panel" + currentPanelCollectionID;
					return self.insert(dbConstants.PANELS.COLLECTION, currentDocument);
				}).then(function(result) {
					// Create a new collection using the currentPanelCollectionID as the name
					// and store the input panel object.
					return new Promise(function(resolve, reject) {
						db.collection("panel" + currentPanelCollectionID, function(err, col) {
							var bulk= col.initializeUnorderedBulkOp();
							for (var i= 0; i < panel.length; ++i) {
								bulk.insert(panel[i]);
							}
							bulk.execute(function(err, doc) {
								if (err) {
									reject(err);
								} else {
									resolve(doc);
								}
							});
						});
					});
				}).then(function(result) {
					// Increment panel collection ID only after insert is done
					var currentDocument= {};
					currentDocument[dbConstants.PANELS.CURRENT_INDEX_FIELD]= 1;  // increment by 1
					return self.update(dbConstants.DB.ADMIN_COLLECTION, {}, {$inc: currentDocument});
				}).then(function(result) {
					// Promise resolves to the new panel's collection ID
					resolve(currentPanelCollectionID);
				}).catch(function(err) {
					logErr(err);
					reject(err);
				});
		});
		return promise;
	};


	/* Find all PGx variants for a specific patient ID.
	 * NOTE: patient ID is the user-specified ID, not the internal collection ID.
	 * Returns a promise. */
	this.getPGXVariants= function(patientID) {
		assert.notStrictEqual(db, undefined);  // ensure we're connected first
		var query= {};
		var getTempCoords = function(marker,query){
			var tempCoords = {};
			tempCoords[dbConstants.VARIANTS.CHROMOSOME]= pgx.pgxCoordinates[marker].chr;
			tempCoords[dbConstants.VARIANTS.START]= pgx.pgxCoordinates[marker].pos;
			query.$or.push(tempCoords);
		};
		query[dbConstants.PATIENTS.ID_FIELD]= patientID;
		var promise= this.findOne(dbConstants.PATIENTS.COLLECTION, query)
		.then(function(result) {
			// build search query
			var query= {};
			query.$or= [];
			for (var marker in pgx.pgxCoordinates) {
				if (pgx.pgxCoordinates.hasOwnProperty(marker)) {
					getTempCoords(marker,query);
				}
			}

			var currentPatientCollectionID= result[dbConstants.PATIENTS.COLLECTION_ID];
			return find(currentPatientCollectionID, query, {"_id": 0}); // don't send internal _id field
		})
		.then(function(result) {
			var doc= {};
			doc.variants= result;
			var opts = {"_id":0};
			opts[dbConstants.DB.REPORT_FOOTER] = 1;
			opts[dbConstants.DB.REPORT_DISCLAIMER] = 1;
			return find(dbConstants.DB.ADMIN_COLLECTION_ID, {}, opts)
			.then(function(result) {
				doc[dbConstants.DB.REPORT_FOOTER]= result[0][dbConstants.DB.REPORT_FOOTER];
				doc[dbConstants.DB.REPORT_DISCLAIMER]= result[0][dbConstants.DB.REPORT_DISCLAIMER];

				return Promise.resolve(doc);
			});
		});
		return promise;
	};

	//=======================================================================================
	//Login functions
	//=======================================================================================


	this.addUser = function(user){
		assert.notStrictEqual(db, undefined);
		assert(Object.prototype.toString.call(user[dbConstants.USERS.ID_FIELD]) == "[object String]",
			"Invalid Options");
		assert(Object.prototype.toString.call(user[dbConstants.USERS.PASSWORD_FIELD]) == "[object String]",
			"Invalid Options");
		//encrypt the password
		logInfo('adding new user to databse', {'user':user[dbConstants.USER_ID_FIELD]});
		user[dbConstants.USERS.PASSWORD_FIELD] = bcrypt.hashSync(user[dbConstants.USERS.PASSWORD_FIELD], bcrypt.genSaltSync(8), null);
		return this.insert(dbConstants.USERS.COLLECTION,user);

	};


	this.findUserById = function(id){
		assert.notStrictEqual(db, undefined);
		assert(Object.prototype.toString.call(id) == "[object String]",
			"Invalid Options");
		var query = {};
		query[dbConstants.USERS.ID_FIELD] = id;

		return this.findOne(dbConstants.USERS.COLLECTION,query);

	};



	this.validatePassword = function(username,password){
		assert.notStrictEqual(db, undefined);
		assert(Object.prototype.toString.call(username) == "[object String]",
			"Invalid Options");
		assert(Object.prototype.toString.call(password) == "[object String]",
			"Invalid Options");

		return this.findUserById(username).then(function(result){
			 return bcrypt.compareSync(password, result[dbConstants.USERS.PASSWORD_FIELD]);
		});

	};

	this.findUserByGoogleId = function(id){
		assert.notStrictEqual(db, undefined);
		assert(Object.prototype.toString.call(id) == "[object String]",
			"Invalid Options");
		var query = {};
		query[dbConstants.USERS.GOOGLE.ID_FIELD] = id;
		return this.findOne(dbConstants.USERS.COLLECTION,query);
	};


	this.addUserGoogle = function(user){
		assert.notStrictEqual(db, undefined);
		assert(Object.prototype.toString.call(user[dbConstants.USERS.GOOGLE.ID_FIELD]) == "[object String]",
			"Invalid Options");
		assert(Object.prototype.toString.call(user[dbConstants.USERS.GOOGLE.TOKEN_FIELD]) == "[object String]",
			"Invalid Options");
		assert(Object.prototype.toString.call(user[dbConstants.USERS.GOOGLE.NAME_FIELD]) == "[object String]",
			"Invalid Options");
		assert(Object.prototype.toString.call(user[dbConstants.USERS.GOOGLE.EMAIL_FIELD]) == "[object String]",
			"Invalid Options");
		assert(Object.prototype.toString.call(user[dbConstants.USERS.ID_FIELD]) == "[object String]",
			"Invalid Options");
		return this.insert(dbConstants.USERS.COLLECTION,user);
	};

	this.generatePassword = function(user){
		assert.notStrictEqual(db, undefined);
		assert(Object.prototype.toString.call(user) == "[object String]",
			"Invalid Options");

		var newPassowrd = randomstring(10);
		var encryptPassword = bcrypt.hashSync(newPassowrd,bcrypt.genSaltSync(8),null);
		var query = {};
		query[dbConstants.USERS.ID_FIELD] = user;
		newPass = {};
		newPass[dbConstants.USERS.PASSWORD_FIELD] = encryptPassword;
		var doc = {$set:newPass};
		logInfo('generating new password for user', {'user':user});
		return this.update(dbConstants.USERS.COLLECTION,query,doc).then(function(result){
			return newPassowrd;
		});
	};

	this.changePassword = function(user, password){
		assert.notStrictEqual(db, undefined);
		assert(Object.prototype.toString.call(user) == "[object String]",
			"Invalid Options");
		assert(Object.prototype.toString.call(password) == "[object String]",
			"Invalid Options");

		var encryptPassword = bcrypt.hashSync(password,bcrypt.genSaltSync(8),null);
		var doc = {};
		var query = {};
		query[dbConstants.USERS.ID_FIELD] = user;
		doc[dbConstants.USERS.PASSWORD_FIELD] = encryptPassword;
		doc = {$set:doc};
		logInfo('changing password for user', {'user':user});
		return this.update(dbConstants.USERS_COLLECTION,query,doc);
	};
};

module.exports= new dbFunctions(logger);