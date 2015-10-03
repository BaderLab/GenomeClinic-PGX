/* 
 * MongoDB interface for node server.
 * @author Patrick Magee 
 * @author Ron Ammar
 */

var MongoClient= require("mongodb").MongoClient;
var Promise = require("bluebird");
var assert= require("assert");
var dbConstants = require("../lib/conf/constants.json").dbConstants;
var nodeConstants = require('../lib/conf/constants.json').nodeConstants;
var bcrypt = require("bcrypt-nodejs");
var randomstring = require("just.randomstring");
var fs = Promise.promisifyAll(require('fs'));
//var logger = require('../lib/logger');
var getRS = require('../lib/getDbSnp');
var _ = require('underscore');
var dbFunctions = function(){

	var TARGET_VERSION = {{DBVERSION}};
//=======================================================================================
// Private properties
//=======================================================================================
/* Default DB parameters. */
	var dbURL,db,
		self = this;
	var logger;


	this.setlogger = function(log){
		if (log) logger = log;
		else logger = require('../lib/logger')(nodeConstants.LOG_DIR)
		return;
	}
	

//=======================================================================================
//=======================================================================================
//Public functions
//=======================================================================================
//=======================================================================================
	this.getAdminEmail = function(){
		assert.notStrictEqual(db,undefined);
		return find(dbConstants.DB.ADMIN_COLLECTION,{})
		.then(function(result){
			return result[0]['admin-email'];
		});
	};

	//=======================================================================================
	//Connection and Initializaition
	//=======================================================================================
	/* Close the DB connection. */
	this.closeConnection= function(callback) {
		logger('info','closing connection to database',{action:'closeConnection'});
		assert.notStrictEqual(db, undefined); // ensure we're connected first
		db.close(callback);
	};

	/* Connect to the DB and initialize it using defaults if the DB has not been
	 * initialized already. if silent exists, will not print to console.*/
	this.connectAndInitializeDB= function(log,user,pwd){
		var _this = this;
		if (!logger) this.setlogger(log);
		var promise= new Promise(function(resolve, reject) {
			// Connect to MongoDB
			connect(user,pwd).then(function(result) {
				/* Check if the "FrangipaniDB" DB already exists. If it doesn't, 
				 * we need to intialize the DB. */
				self.count(dbConstants.DB.SYSTEM_NAMESPACES).then(function(result) {
				 	if (!result) { // # of collections in DB is 0
				 		return createInitCollections()
				 			.catch(function(err) {
				 				logger('error',err,{action:'connectAndInitializeDB'});
			 					reject(err);
			 				});
				 	} 
				 }).then(function(){
				 	return //_this.checkDefaultGenes();
				 }).then(function(){
				 	resolve();
				 }).catch(function(err) {
				 	logger("error",err,{action:'connectAndInitializeDB'});
				 	reject(err);
				 });
			}).catch(function(err) {
				logger("error",err,{action:'connectAndInitializeDB'});
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
	//Login functions
	//=======================================================================================

	//Add a user to the database, encrypting the provided password and storing them in the users db
	this.addUser = function(user){
		assert.notStrictEqual(db, undefined);
		assert(Object.prototype.toString.call(user[dbConstants.USERS.ID_FIELD]) == "[object String]",
			"Invalid Options");
		assert(Object.prototype.toString.call(user[dbConstants.USERS.PASSWORD_FIELD]) == "[object String]",
			"Invalid Options");
		//encrypt the password
		logger('info','adding new user to databse', {'user':user[dbConstants.USER_ID_FIELD]});
		user[dbConstants.USERS.PASSWORD_FIELD] = bcrypt.hashSync(user[dbConstants.USERS.PASSWORD_FIELD], bcrypt.genSaltSync(8), null);
		return this.insert(dbConstants.USERS.COLLECTION,user);

	};

	//Find a user by the provided ID and return all information related to them
	this.findUserById = function(id){
		assert.notStrictEqual(db, undefined);
		assert(Object.prototype.toString.call(id) == "[object String]",
			"Invalid Options");
		var query = {};
		query[dbConstants.USERS.ID_FIELD] = id;

		return this.findOne(dbConstants.USERS.COLLECTION,query);

	};


	//Validate the password during signon in a secure manner.
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


	//Find the user by the google id
	this.findUserByGoogleId = function(id){
		assert.notStrictEqual(db, undefined);
		assert(Object.prototype.toString.call(id) == "[object String]",
			"Invalid Options");
		var query = {};
		query[dbConstants.USERS.GOOGLE.ID_FIELD] = id;
		return this.findOne(dbConstants.USERS.COLLECTION,query);
	};

	//Add a google user, only used for Google OAUTH
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


	//=======================================================================================
	//Project functions
	//=======================================================================================

	/* Find all projects for a specific user and return the project within an array */
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
		return find(dbConstants.PROJECTS.COLLECTION,query,undefined,undefined,username).then(function(result){
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

	/* Add a new project to the database under the passed user. the The options
	 * must contain the Project name, as well as the patients that are included 
	 * in the new project */
	this.addProject = function(options,user){
		assert.notStrictEqual(db,undefined);
		assert(Object.prototype.toString.call(options) == '[object Object]',"Invalid options");
		//project info should have patient_id, details, and for future use, allowed users
		var projectInfo = options.project;
		projectInfo[dbConstants.PROJECTS.AUTH_USER_FIELD] = options.users;
		projectInfo[dbConstants.PROJECTS.DATE_ADDED] = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

		var patientTags = options.patients;
		var users = options.users;
		return this.insert(dbConstants.PROJECTS.COLLECTION, projectInfo, user).then(function(result){
			if (patientTags) {
				return Promise.each(patientTags, function(patient){
					return self.addProjectToPatient(projectInfo[dbConstants.PROJECTS.ID_FIELD],patient,user)
				});
			}	
		});
	};

	/*remove project from the collection, and remove the patient associations
	 * from all the patients in that project */
	this.removeProject = function(project,user){
		var _this = this;
		var query = {};
		query[dbConstants.PROJECTS.ID_FIELD] = project;
		return removeDocument(dbConstants.PROJECTS.COLLECTION,query,user)
		.then(function(){
			return _this.removePatientsFromProject(project,undefined,user);
		});
	};


	/* Add a new project to a patient by adding the project name to the tags field */
	this.addProjectToPatient = function(project,patient,user){
		assert.notStrictEqual(db,undefined);
		assert(Object.prototype.toString.call(project) == "[object String]", "Invalid Project Name");
		assert(Object.prototype.toString.call(patient) == "[object String]", "Invalid Patient Name");

		var query = {};
		query[dbConstants.PATIENTS.ID_FIELD] = patient;
		doc = {};
		doc[dbConstants.PROJECTS.ARRAY_FIELD] = project;
		doc = {$addToSet:doc};
		return this.update(dbConstants.PATIENTS.COLLECTION, query, doc,undefined, user);
	};

	/* Remove the Tag for a project from one or more patients. Once the tag is remvoed the patient
	 * is no longer associated with the previous project in any way and will not show up in the project
	 * screen. */
	this.removePatientsFromProject = function(project, patients,user){
		var query = {};
		assert.notStrictEqual(db,undefined);
		assert(Object.prototype.toString.call(project) == "[object String]", "Invalid Project Name");
		if (patients){
			assert(Object.prototype.toString.call(patients) == "[object Array]", "Patients must be an array");
			query[dbConstants.PATIENTS.ID_FIELD] = {$in:patients};
		} else {
			query[dbConstants.PROJECTS.ARRAY_FIELD] = project;
		}
		var doc = {};
		doc[dbConstants.PROJECTS.ARRAY_FIELD] = project;
		doc = {$pull:doc};
		var options = {multi:true};
		return this.update(dbConstants.PATIENTS.COLLECTION, query, doc, options, user).then(function(result){
			return true;
		});
	};

	/* When a  new patient is added to a project add the project to their 'tags' field, so that this patient
	 * will then be associated with the new project */
	this.addPatientsToProject = function(project, patients, user){
		assert.notStrictEqual(db,undefined);
		assert(Object.prototype.toString.call(project) == "[object String]", "Invalid Project Name");
		assert(Object.prototype.toString.call(patients) == "[object Array]", "Patients must be an array");
		var query = {};
		query[dbConstants.PATIENTS.ID_FIELD] = {$in:patients};
		var doc = {};
		doc[dbConstants.PROJECTS.ARRAY_FIELD] = project;
		doc = {$addToSet:doc};
		var options = {multi:true};
		return this.update(dbConstants.PATIENTS.COLLECTION, query, doc, options, user).then(function(result){
			return true;
		});
	};


	//=======================================================================================
	//Patient Functions
	//=======================================================================================


	/* Create a patient with the input patient ID.
	 * Returns a promise which resolves to the new patient collection ID. */
	this.addPatient= function(options, user) {
		assert.notStrictEqual(db, undefined); // ensure we're connected first
		var args = arguments;
		var currentPatientCollectionID;
		var promise= new Promise(function(resolve, reject) {
			/* Get most recent patient collection ID integer from the admin table
			 * and increment it. */
			self.findOne(dbConstants.DB.ADMIN_COLLECTION, {}, user)	
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
					return self.insert(dbConstants.PATIENTS.COLLECTION, currentDocument,user);
				}).then(function(result) {
					// Increment patient collection ID only after insert is done
					currentDocument= {};
					currentDocument[dbConstants.PATIENTS.CURRENT_INDEX_FIELD]= 1;  // increment by 1
					return self.update(dbConstants.DB.ADMIN_COLLECTION, {}, {$inc: currentDocument},undefined,user);
				}).then(function(result) {
					resolve({newCollection:"p" + currentPatientCollectionID, document:currentDocument});
				}).catch(function(err) {
					logger("error",err,{action:'addPatient',target:dbConstants.PATIENTS.COLLECTION,arguments:args});
					reject(err);
				});
		});
		return promise;
	};

	/* remove patient from the patient collection. Takes two arguments, the first is the
	 * patient name, and the second is the suer adding the patient. */
	this.removePatient = function(patient,user){
		assert.notStrictEqual(db, undefined);
		assert(Object.prototype.toString.call(patient) == "[object String]", "Invalid Patient Name");
		var query = {};
		var _this = this;
		var failure;
		query[dbConstants.PATIENTS.ID_FIELD] = patient;
		return this.findOne(dbConstants.PATIENTS.COLLECTION,query,user).then(function(result){
			failure = result;
			return _this.dropCollection(result[dbConstants.PATIENTS.COLLECTION_ID],user);
		}).catch(function(err){
		}).then(function(){
			return removeDocument(dbConstants.PATIENTS.COLLECTION,query,user);
		}).then(function(){
			failure[dbConstants.FAILURE.ANNO_COMPLETE] = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
			failure[dbConstants.FAILURE.FAIL_FIELD] = true;
			return _this.insert(dbConstants.FAILURE.COLLECTION,failure);
		}).catch(function(err){
				logger('error',err,{user:user,action:'removePatient'});
		});
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
			return find(collectionName, query, {}, options, username);
		});
	};


	/* find all the patients in the patient collection and return an array
	 * corresponding to the entire document of each patient.
	 * If readyOnly == true, return only fully uploaded patients.
	 * To get output sorted by date and time(newest patient records first), do:
	 * options == {sort: {"date": -1, "time": -1}} */

	this.findAllPatientsInProject = function(project,options,user){
		assert.notStrictEqual(db,undefined);
		assert(Object.prototype.toString.call(project) == "[object String]", "Invalid Project Name");
		var field = {'_id':0};
		query = {};
		query[dbConstants.PROJECTS.ARRAY_FIELD] = project;
		return find(dbConstants.PATIENTS.COLLECTION,query,field,options,user);
	};


	/* Given a specific project, return all available patients for a user that are
	 * not listed in that project. this is used for adding patients to an existing 
	 * project */
	this.findAllPatientsNinProject = function(project,username,options){
		var _this = this;
		assert.notStrictEqual(db,undefined);
		assert(Object.prototype.toString.call(project) == "[object String]", "Invalid Project Name");
		//find all the availble projects for this person
		return this.findProjects(undefined,username).then(function(result){
			return result.filter(function(item){
				if (item[dbConstants.PROJECTS.ID_FIELD] != project)
					return item[dbConstants.PROJECTS.ID_FIELD];
			});
		}).then(function(result){
			var query = {},tagQuery={},ownerQuery={},queryList=[];
			ownerQuery[dbConstants.DB.OWNER_ID] = username;
			queryList.push(ownerQuery);
			if (result.length > 0){
				tagQuery[dbConstants.PROJECTS.ARRAY_FIELD] = {$in:result};
				queryList.push(tagQuery);
				queryList.$or = queryList;
			} else {
				query = ownerQuery;
			}
			query[dbConstants.PATIENTS.READY_FOR_USE] = true;
			return find(dbConstants.PATIENTS.COLLECTION,query,null,options,username);
		}).then(function(result){
			return result.filter(function(patient){
				if (!patient[dbConstants.PROJECTS.ARRAY_FIELD])
					return patient;
				if (patient[dbConstants.PROJECTS.ARRAY_FIELD].indexOf(project)==-1)
					return patient;
			});
		});
	};

	/* Find all of the patients for a praticular user. this will find either ALLL
	 * patients in the the entire database regardless of their status or it will find
	 * only those that are ready for analysis depending on if readyOnly is true or not.
	 * If readyonly is False or undefiend, this function will look for all non-ready,ready,
	 * And failed vcf files. It will then return a concatenated list of all of them
	 */
	this.findAllPatients = function(username,readyOnly,options){
		assert.notStrictEqual(db,undefined);
		assert(Object.prototype.toString.call(username) == "[object String]", "Invalid username Name");
		return this.findProjects(undefined,username)
		.then(function(result){
			return result.map(function(item){
				return item[dbConstants.PROJECTS.ID_FIELD];
			});
		}).then(function(result){
			var query = {},tagQuery={},ownwerQuery={},queryList=[];
			ownwerQuery[dbConstants.DB.OWNER_ID] = username;
			queryList.push(ownwerQuery);
			if (result.length > 0){
				tagQuery[dbConstants.PROJECTS.ARRAY_FIELD] = {$in:result};
				queryList.push(tagQuery);
			}
			query.$or = queryList;
			if (readyOnly){
				query[dbConstants.PATIENTS.READY_FOR_USE] = true;
				return find(dbConstants.PATIENTS.COLLECTION,query,null,options,username);
			} else {
				var goodResults;
				return find(dbConstants.PATIENTS.COLLECTION,query,null,options,username)
				.then(function(result){
					goodResults = result;
					return find(dbConstants.FAILURE.COLLECTION,query,null,options,username);
				}).then(function(failures){
					return goodResults.concat(failures);
				}).then(function(result){
					result = result.sort(function(a,b){
						a = a.added.split(/\s/);
						b = b.added.split(/\s/);
						if (a[0] < b[0]){
							return 1;
						} else if (a[0] > b[0]) {
							return -1;
						} else {
							if (a[1] < b[1])
								return 1;
							else if (a[1] > b[1])
								return -1;
							return 0;
						}
					});
					return result;
				});
			}
		});
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
	 * Returns a promise which resolves to the new panel's collection ID. 

	 ****** DEPRECATED AND NO LONGER USED *****
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
			 * and increment it. 
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
	*/

	/* Retrieve markers and coordinates from the server. Convert the data returned into an
	 * Object with the marker names as the key. If no parameters are passed, return all 
	 * markers from the databse. if the marker name is provided only return information
	 * for the specified marker. Two marker types are stored in the database, 'custom'
	 * and 'dbsnp'. If the type parameter is passed return only the type of marker
	 */ 
	this.getPGXCoords = function(rsID,username,type) {
		assert.notStrictEqual(db,undefined);
		var query = {};
		if (Object.prototype.toString.call(rsID) == "[object Array]")
			query[dbConstants.PGX.COORDS.ID_FIELD] = {$in:rsID};
		else if (rsID)
			query[dbConstants.PGX.COORDS.ID_FIELD] = rsID;
		if (type)
			query.type = type;
		return find(dbConstants.PGX.COORDS.COLLECTION,query,undefined,null,username)
		.then(function(result){
			//Check to see if the marker has been merged at all
			if (result.length === 0){
				var query = {};
				if (Object.prototype.toString.call(rsID) == "[object Array]")
					query['merged.from'] = {$in:rsID}
				else if (rsID)
					query['merged.from'] = rsID;
				if (type)
					query.type = type
				return find(dbConstants.PGX.COORDS.COLLECTION,query,undefined,null,username)
			} else {
				return result
			}
		}).then(function(result){
			var out = {}
			for (var i = 0; i < result.length; i++ ){
				out[result[i]._id] = {};
				if (result[i].merged){
					out[result[i].merged.from] = {};
				}
				for (var key in result[i]){
					if (result[i].hasOwnProperty(key)){
						if (result[i].merged)
							out[result[i].merged.from][key] = result[i][key]
						out[result[i]._id][key] = result[i][key];
					}
				}
				if (result[i].merged)out[result[i].merged.from]._id = result[i].merged.from;

			}
			return out;	
		});
	};

	/* Update all the pgxCoordinates
	 * Query the NCBI's dbsnp to find all minformation on all the markers included in
	 * our database (can take a minute). THen if there are any changes update the databse
	 */
	this.updatedbSnpPGXCoords = function(snp){
		var record, update, changed = [], notFound = [], notchanged = [], toChange = [];
		assert.notStrictEqual(db,undefined);
		return self.getPGXCoords(snp ,null,'dbsnp').then(function(markers){
			var markerNames = Object.keys(markers);
			return getRS(markerNames).then(function(result){
				foundMarkers = [];

				//Check to see if any of the genes have changed.
				for (var i = 0; i < result.dbSnp.length; i++ ){
					//check version
					record = result.dbSnp[i];
					update = false;
					foundMarkers.push(record._id);
					if (markers[record._id].build < record.build) update = true;
					if (markers[record._id].assembly < record.assembly ) update = true;
					if (markers[record._id].ref != record.ref ) update = true;
					if (!_.isEqual(markers[record._id].alt,record.alt) ) update = true;
					if (update) toChange.push(record);	
					else notchanged.push(record._id);
				}

				for (i = 0; i < markers.length; i++ ){
					if (foundMarkers.indexOf(markers[i]) == -1 ) notFound.push(markers[i]);
				}
				return toChange;
			}).each(function(record){
				return self.update(dbConstants.PGX.COORDS.COLLECTION,{_id:record._id},record).then(function(){
					changed.push(record);
				});
			}).then(function(){
				output = {
					changed:changed,
					missing:notFound,
					notchanged:notchanged
				};
				return output;
			});
		});
	};

	/* Each gene has an array of markers associated with it that links these markers
	 * with the respective gene haplotype page. When a marker is present in the array
	 * it will show up in the haplotype table for that gene. The function accepts a string
	 * or an array of markers.  
	 */
	this.addMarkerToGene = function(markers,gene,user){
		assert.notStrictEqual(db,undefined);
		var _this = this;

		if (Object.prototype.toString.call(markers) == '[object String]')
			markers = [markers];

		//ensure that each marker exists
		return Promise.resolve(markers).each(function(marker){
			return _this.findOne(dbConstants.PGX.COORDS.COLLECTION, {_id:marker},user).then(function(result){
				if (!result) {
					throw new Error("Could not find " + marker + ". Please add the marker and continue.");
				} else {
					var query = {};
					var update = {$addToSet:{}}

					query[dbConstants.DRUGS.ALL.ID_FIELD] = gene;
					update.$addToSet[dbConstants.DRUGS.ALL.MARKERS] = marker;
					return _this.update(dbConstants.DRUGS.ALL.COLLECTION,query,update,undefined,user);
				}
			});
		});
	};

	/* Remove the associated markers from a gene by pulling the specified marking
	 * or array from the gene marker array */
	this.removeMarkerFromGene = function(markers,gene,user){
		assert.notStrictEqual(db,undefined);
		var _this = this;

		if (Object.prototype.toString.call(markers) == '[object String]')
			markers = [markers];
		
		return Promise.resolve(markers).each(function(marker){
			return _this.findOne(dbConstants.PGX.COORDS.COLLECTION, {_id:marker},user).then(function(result){
				if (!result) {
					throw new Error("Could not find " + marker + ". Please add the marker and continue.");
				} else {
					var query = {};
					var update = {$pull:{}}
					query[dbConstants.DRUGS.ALL.ID_FIELD] = gene;
					update.$pull[dbConstants.DRUGS.ALL.MARKERS] = marker;
					return _this.update(dbConstants.DRUGS.ALL.COLLECTION,query,update,undefined,user).then(function(){
						//Remove the Marker from all the haplotypes associated with this gene
						var query = {gene:gene};
						var update = {$pull:{markers:{$in:markers}}};
						return _this.update(dbConstants.PGX.GENES.COLLECTION,query,update,{multi:true},user);
					});
				}
			});
		});
	};

	//remove the selected marker
	this.removePGXCoords = function(rsID,user){
		var _this = this;
		assert.notStrictEqual(db,undefined);
		assert(Object.prototype.toString.call(rsID) == "[object String]");
		var query = {};
		query[dbConstants.PGX.COORDS.ID_FIELD] = rsID;
		var removed;
		return removeDocument(dbConstants.PGX.COORDS.COLLECTION,query,user).then(function(){
			//it has successfully removed the doc
			removed = true;
			var update = {$pull:{}};
			update.$pull[dbConstants.DRUGS.ALL.MARKERS] = rsID;
			var query = {};
			query[dbConstants.DRUGS.ALL.MARKERS] = rsID;
			return _this.update(dbConstants.DRUGS.ALL.COLLECTION,{},update,{multi:true});
		}).then(function(result){
			var query = {};
			query[dbConstants.PGX.GENES.MARKERS] = rsID;
			var update = {$pull:{}};
			update.$pull[dbConstants.PGX.GENES.MARKERS] = rsID;
			return _this.update(dbConstants.PGX.GENES.COLLECTION,query,update,{multi:true});
		}).then(function(){
			return removed
		})

	};
	/*retrieve the selected Haplotype Gene(s). Accepts an array or string, or no
	 * arugment. If an array or string is passed it will search for all of the genes
	 * in that are named, while if no arguments are passed it will retrieve ALL
	 * of the genes */
	this.getPGXGenesForAnalysis = function(geneName,user){
		assert.notStrictEqual(db,undefined);
		var query = {};
		if (Object.prototype.toString.call(geneName) == '[object Array]')
			query[dbConstants.DRUGS.ALL.ID_FIELD] = {$in:geneName};
		else if (geneName)
			query[dbConstants.DRUGS.ALL.ID_FIELD] = geneName;
		return find(dbConstants.DRUGS.ALL.COLLECTION,query,undefined,undefined,user)
		.each(function(geneResult){
			var query = {_id:{$in:geneResult[dbConstants.DRUGS.ALL.CURRENT_HAPLO]}}
			return find(dbConstants.PGX.GENES.COLLECTION,query,undefined,undefined,user).then(function(result){
				geneResult[dbConstants.DRUGS.ALL.CURRENT_HAPLO] = result;
			});
		}).then(function(result){
			var out = {};
			for (var i=0; i< result.length; i++ ){
				temp = {}
				if (result[i][dbConstants.DRUGS.ALL.CURRENT_HAPLO].length !== 0){
					for (var j = 0; j < result[i][dbConstants.DRUGS.ALL.CURRENT_HAPLO].length; j++ ){
						temp[result[i][dbConstants.DRUGS.ALL.CURRENT_HAPLO][j].haplotype] = result[i][dbConstants.DRUGS.ALL.CURRENT_HAPLO][j].markers
						}
					out[result[i].gene] = temp;
				}
			}
			return out;
		});
	};

	//Update the specified gene with the requqired parameter Doc
	this.updatePGXGene = function(id,doc,user){
		assert.notStrictEqual(db,undefined);
		assert(Object.prototype.toString.call(geneName) == "[object String]");
		assert(Object.prototype.toString.call(doc) == "[object Object]");

		var query = {};
		query[dbConstants.PGX.GENES.ID_FIELD] = geneName;
		return this.update(dbConstants.PGX.GENES.COLLECTION,query,doc,undefined,user);
	};

	//Update the specified marker with the required parameter Doc
	this.updatePGXCoord = function(rsID,doc,user){
		assert.notStrictEqual(db,undefined);
		assert(Object.prototype.toString.call(rsID) == "[object String]");
		assert(Object.prototype.toString.call(doc) == "[object Object]");
		var query = {};
		query[dbConstants.PGX.COORDS.ID_FIELD] = rsID;
		return this.update(dbConstants.PGX.COORDS.COLLECTION,query,doc,undefined,user);
	};

	/* Find all PGx variants for a specific patient ID.
	 * NOTE: patient ID is the user-specified ID, not the internal collection ID.
	 * Returns a promise. */
	this.getPGXVariants= function(patientID,user) {

		assert.notStrictEqual(db, undefined);  // ensure we're connected first
		var self = this;
		var pgxCoords, pgxGenes,currentPatientCollectionID,pgxGenesRemoved = [];
		var query= {};
		query[dbConstants.PATIENTS.ID_FIELD]= patientID;

		var promise= this.findOne(dbConstants.PATIENTS.COLLECTION, query, user)
		.then(function(result) {
			currentPatientCollectionID = result[dbConstants.PATIENTS.COLLECTION_ID];
			return self.getPGXGenesForAnalysis();
		}).then(function(result){
			pgxGenes = result;
			return self.getPGXCoords();
		}).then(function(result){
			//Ensure that only genes are being provided that have complete marker information
			//if genes are lacking marker information remove them and put them in a separate array
			var haplotypes;
			pgxCoords = result;
			var genes = Object.keys(pgxGenes);
			var markers = Object.keys(pgxCoords);
			for (var i=0; i<genes.length; i++ ){
				hap = Object.keys(pgxGenes[genes[i]]);
				for (var j=0; j < hap.length; j++){
					for ( var k = 0; k < pgxGenes[genes[i]][hap[j]].length; k++ ){
						if (markers.indexOf(pgxGenes[genes[i]][hap[j]][k]) === -1 ){
							if (pgxGenesRemoved.indexOf(genes[i])=== -1 ){
								pgxGenesRemoved.push(genes[i]);
							}
						}
					}
				}
				
			}
			for (i = 0; i< pgxGenesRemoved.length; i++){
				delete pgxGenes[pgxGenesRemoved[i]];
			}

			return pgxCoords;
		}).then(function(result){
			
			var tempCoords;
			var keys = Object.keys(result);
			query = {};
			query[dbConstants.VARIANTS.IDENTIFIER] = {$in:keys};
			return find(currentPatientCollectionID, query, {"_id": 0},undefined,user); // don't send internal _id field
		})
		.then(function(result) {
			var doc= {};
			doc.variants= {};
			for (var i = 0; i < result.length; i++ ) {
				doc.variants[result[i][dbConstants.VARIANTS.IDENTIFIER]] = result[i];
			}
			doc.pgxGenes = pgxGenes;
			doc.pgxCoordinates = pgxCoords;
			doc.patientID = patientID;
			doc.pgxGenesRemoved = pgxGenesRemoved;

			var opts = {"_id":0};
			opts[dbConstants.DB.REPORT_FOOTER] = 1;
			opts[dbConstants.DB.REPORT_DISCLAIMER] = 1;

			return find(dbConstants.DB.ADMIN_COLLECTION, {}, opts,undefined,user)
			.then(function(result) {
				doc[dbConstants.DB.REPORT_FOOTER]= result[0][dbConstants.DB.REPORT_FOOTER];
				doc[dbConstants.DB.REPORT_DISCLAIMER]= result[0][dbConstants.DB.REPORT_DISCLAIMER];
				return doc;
			});
		});
		return promise;
	};

	

	//Functions related to dealing with drug dosing and drugs
	this.drugs = {
		//Get the genes associated with drug recomednations and return an array of genes;
		getGenes : function(user,from){
			assert.notStrictEqual(db,undefined);
			var match = {$match:{}}
			match.$match['use' + from] = true;
			var options = {$project:{}};
			options.$project[dbConstants.DRUGS.ALL.ID_FIELD] = 1;
			options.$project.type = '$type';
			options.$project.numRecs = {$size:'$' + dbConstants.DRUGS.ALL.RECOMMENDATIONS};
			options.$project.numFuture = {$size:'$' + dbConstants.DRUGS.ALL.FUTURE};
			options.$project.numHaplo = {$size:'$' + dbConstants.DRUGS.ALL.HAPLO};
			options.$project.numCurrH = {$size:'$' + dbConstants.DRUGS.ALL.CURRENT_HAPLO};
			options.$project.numCurrM = {$size:'$' + dbConstants.DRUGS.ALL.MARKERS}
			var sort = {$sort:{}};
			sort.$sort[dbConstants.DRUGS.ALL.ID_FIELD] = 1;
			var pipeline = [match,options,sort];
			return aggregate(dbConstants.DRUGS.ALL.COLLECTION,pipeline,user);
		},

		/* for the given genes, return all the dosing information current in the database. this information
		 * is returned in the form of an array. The function can accept either a stirng or an array */
		getGeneDosing : function(gene,user){
			assert.notStrictEqual(db,undefined);
			var query = {};
			var out = [];
			if (Object.prototype.toString.call(gene) == '[object Array]'){
				query[dbConstants.DRUGS.ALL.ID_FIELD] = {$in:gene};
			} else {
				query[dbConstants.DRUGS.ALL.ID_FIELD] = gene;
			}
			return 	find(dbConstants.DRUGS.ALL.COLLECTION,query,undefined,undefined,user).each(function(record){
				var recIDs = record[dbConstants.DRUGS.ALL.RECOMMENDATIONS] || [];
				var haploIDs = record[dbConstants.DRUGS.ALL.HAPLO] || [];
				var futureIDs = record[dbConstants.DRUGS.ALL.FUTURE] || [];
				
				//Find all recommendations
				return find(dbConstants.DRUGS.DOSING.COLLECTION,{_id:{$in:recIDs}},undefined,undefined,user).then(function(recommendations){
					if (recommendations.length > 0) record[dbConstants.DRUGS.ALL.RECOMMENDATIONS] = recommendations;
					
				}).then(function(){
					return find(dbConstants.DRUGS.FUTURE.COLLECTION,{_id:{$in:futureIDs}},undefined,undefined,user);
				}).then(function(future){
					if (future.length > 0 ) record[dbConstants.DRUGS.ALL.FUTURE] = future;
					
				}).then(function(){
					return find(dbConstants.DRUGS.HAPLO.COLLECTION,{_id:{$in:haploIDs}},undefined,undefined,user);
				}).then(function(haplo){
					if (haplo.length > 0 ) record[dbConstants.DRUGS.ALL.HAPLO] = haplo;
					out.push(record);
					//if (record[dbConstants.DRUGS.ALL.RECOMENDATIONS] || record[dbConstants.DRUGS.ALL.FUTURE] || record[dbConstants.DRUGS.ALL.HAPLO]) out.push(record);
				});
			}).then(function(){
				if (out.length === 0) return null;
				else if (out.length === 1 ) return out[0];
				else return out;
			});
		},

		/* Remove a specific entry. This function will remove an entry based on the objectID and the type of entry. It will
		 * accept four different 'Types':
		 * all - removes All the recommendations and associations linked to a specific gene. it also removes the dosing document itself
		 *		 and removes the recommendations from other genes that are depending upon the current gene being removed.
		 * recommendation - removes a specific recommmendation. IT is first removed from all the genes that link to it, then the document
		 * 	 	 is entirely removed from the drugRecommendation collection
		 * future - removes a specific future recommendation first from the future array within a gene, then subsequently removes the entry
		 *		  from its collections entirely.
		 * haplotype -removes the haplotype association from a gene and removes the document entry from the haplotype collection.
		 */
		removeEntry : function(oID,type,from,user){
			assert.notStrictEqual(db,undefined);
			var collection, query, ids;
			var toRemove = [];
			var genes = [];

			var promise;
			/* Remove the entire document and all entries relating to it. This will remove all
			 * shared entries as well. So this is a very dangerous action */
			if (type == 'all'){
				var recIDs,futureIDs,haploIDs;
				var query = {};
				if (from == 'Haplotype') query[dbConstants.DRUGS.ALL.ID_FIELD] = oID;
				else if (from == 'Dosing') query._id = oID
				else throw new Error("Source must be from Haplotype or Dosing");

				promise = self.findOne(dbConstants.DRUGS.ALL.COLLECTION,query,user).then(function(result){
					if (from == 'Dosing'){
						genes = [result[dbConstants.DRUGS.ALL.ID_FIELD]];
						toRemove.push({
							ids : result[dbConstants.DRUGS.ALL.RECOMMENDATIONS],
							collection : dbConstants.DRUGS.DOSING.COLLECTION,
							field:dbConstants.DRUGS.ALL.RECOMMENDATIONS
						});
						toRemove.push({
							ids : result[dbConstants.DRUGS.ALL.FUTURE],
							collection : dbConstants.DRUGS.FUTURE.COLLECTION,
							field:dbConstants.DRUGS.ALL.FUTURE
						})
						toRemove.push({
							ids : result[dbConstants.DRUGS.ALL.HAPLO],
							collection : dbConstants.DRUGS.FUTURE.COLLECTION,
							field:dbConstants.DRUGS.ALL.HAPLO
						})
					} else {
						genes = [oID];
						toRemove.push({
							ids: result[dbConstants.DRUGS.ALL.CURRENT_HAPLO],
							collection : dbConstants.PGX.GENES.COLLECTION,
							field:dbConstants.DRUGS.ALL.CURRENT_HAPLO
						})
						toRemove.push({
							genes:[oID],
							ids:result[dbConstants.DRUGS.ALL.MARKERS],
							field: dbConstants.DRUGS.ALL.MARKERS
						});

					}

					return toRemove;
				});
			} else {
				promise = Promise.resolve().then(function(){
					if (type == 'future' && from == 'Dosing'){
						toRemove.push({
							ids : [oID],
							collection : dbConstants.DRUGS.FUTURE.COLLECTION,
							field:dbConstants.DRUGS.ALL.FUTURE
						});
					}
					else if (type == 'recommendation' && from == 'Dosing'){
						toRemove.push({
							ids : [oID],
							collection : dbConstants.DRUGS.DOSING.COLLECTION,
							field:dbConstants.DRUGS.ALL.RECOMMENDATIONS
						});

					}
					else if (type == 'haplotye' && from == 'Dosing'){
						toRemove.push({
							ids : [oID],
							collection : dbConstants.DRUGS.FUTURE.COLLECTION,
							field:dbConstants.DRUGS.ALL.HAPLO
						});
					} 
					else if (type == 'haplotype' && from == 'Haplotype') {
						toRemove.push({
							ids:[oID],
							collection:dbConstants.PGX.GENES.COLLECTION,
							field:dbConstants.DRUGS.ALL.CURRENT_HAPLO
						});
					}

					return toRemove;
				});
			}
				//Remove each item
			return promise.each(function(item){
				var newPromise;
				var update = {};
				if (item.collection && item.ids.length > 0){
					newPromise = find(item.collection,{_id:{$in:item.ids}}).each(function(result){
						var temp;
						if (result.genes && Object.prototype.toString.call(result.genes) == '[object Array]') temp = result.genes;
						else if (result.gene && Object.prototype.toString.call(result.gene) == '[object String]') temp = [result.gene];
						for (var i = 0 ; i < temp.length; i++ ){
							if (genes.indexOf(temp[i]) == -1) genes.push(temp[i]);
						}
						return removeDocument(item.collection,{_id:result._id},user)
					});

				} else {
					//If there is not collection, or associated IDs then do nothing
					newPromise = Promise.resolve()
				}
				return newPromise.then(function(){
					update.$pull = {};
					if (item.genes) genes = item.genes;
					update.$pull[item.field] = {$in:item.ids};
					query = {};
					query[dbConstants.DRUGS.ALL.ID_FIELD] = {$in:genes}
					return self.update(dbConstants.DRUGS.ALL.COLLECTION,query,update,{mulit:true},user)
				});

			}).then(function(){
				/* For each gene there are two internal flags that determine whether it is being displayed to the user for
				 * editing purposes. Once you have removed an item, this block will check to see if the several fields are of lenght 0,
				 * if they are, then the internal flags will be set to false and they user will no longer see dosing or haplotypes. This
				 * additionally changes the behaviour of this */
				var query = {};
				var update = {$set:{}};
				query[dbConstants.DRUGS.ALL.ID_FIELD] = {$in:genes}
				return find(dbConstants.DRUGS.ALL.COLLECTION,query).each(function(entry){
					var newQeury = {};
					newQeury[dbConstants.DRUGS.ALL.ID_FIELD] = entry[dbConstants.DRUGS.ALL.ID_FIELD]
					if (from == 'Haplotype'){
						if (entry[dbConstants.DRUGS.ALL.MARKERS].length === 0 && entry[dbConstants.DRUGS.ALL.CURRENT_HAPLO].length === 0) update.$set['useHaplotype'] = false;
					} else if (from == 'Dosing'){
						if (entry[dbConstants.DRUGS.ALL.FUTURE].length === 0 && entry[dbConstants.DRUGS.ALL.RECOMMENDATIONS].length === 0 && entry[dbConstants.DRUGS.ALL.HAPLO].length === 0) update.$set['useDosing'] = false;
					}	
					//this gene is empty, remove
					if (update.$set.useDosing == false || update.$set.useHaplotype == false){
						return self.update(dbConstants.DRUGS.ALL.COLLECTION,newQeury,update,undefined,user)
					} else {
						return true;
					}

				});
			});
		},
		/* Create an empty dosing document based on the gene name. If the Gene already exists
		 * reject the process and return an error */
		createNewDoc : function(gene,type,from,user){
		var promise = new Promise(function(resolve,reject){
			if (from) assert(['Haplotype','Dosing'].indexOf(from)!== -1);
			var newDoc = {};
			newDoc[dbConstants.DRUGS.ALL.TYPE] = type || 'metabolizer'; // metabolizer is the default type
			newDoc[dbConstants.DRUGS.ALL.ID_FIELD] = gene;
			newDoc[dbConstants.DRUGS.ALL.RECOMMENDATIONS] = [];
			newDoc[dbConstants.DRUGS.ALL.HAPLO] = [];
			newDoc[dbConstants.DRUGS.ALL.FUTURE] = [];
			newDoc[dbConstants.DRUGS.ALL.CURRENT_HAPLO] = [];
			newDoc[dbConstants.DRUGS.ALL.MARKERS] = [];
			if (from) newDoc['use' + from] = true;
			return self.insert(dbConstants.DRUGS.ALL.COLLECTION,newDoc,user)
			.then(function(result){
				resolve(result);
			}).catch(function(err){
				reject(err);
			})
		});

		return promise;
	}
		
	};
};
module.exports = exports = new dbFunctions();
