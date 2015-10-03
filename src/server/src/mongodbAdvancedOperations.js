var Promise = require("bluebird");
var assert= require("assert");
var dbConstants = require("../lib/conf/constants.json").dbConstants;
var nodeConstants = require('../lib/conf/constants.json').nodeConstants;
var basicOperations = require("./mongodbBasicOperations");
var bcrypt = require("bcrypt-nodejs");
var randomstring = require("just.randomstring");


var SALT = 8;
var PWD_STRING_LEN = 10;
var TARGET_VERSION = 1 //{{DBVERSION}};
var ASCENDING_INDEX = 1;
var DESCENDING_INDEX = -1;
var MISSING = -1;


function mongodbAdvancedOperations (db,logger){
	basicOperations.call(this,db,logger);
}
//inherit methods of basic operation
mongodbAdvancedOperations.prototype = Object.create(basicOperations.prototype); 


//Generic advanced operaiont not beloning to a specific namespace


/* Change or check if the server has been configured.
 * If changing the status of the configuration, use the set parameter.
 * set === true, changes the configured status to true.
 * If set is omitted, function returns the status as a boolean.
 * Returns a promise. */
mongodbAdvancedOperations.prototype.isConfigured= function(set) {
	var _this = this;
	assert(Object.prototype.toString.call(set) == "[object Boolean]" || Object.prototype.toString.call(set) == "[object Undefined]","Invalid config set parameter");
	var promise= new Promise(function(resolve, reject) {
		if (set === undefined) {  // Return config status
			_this.findOne(dbConstants.DB.ADMIN_COLLECTION, {})
				.then(function(doc) {
					resolve(doc[dbConstants.DB.SERVER_CONFIGURED_FIELD]);
				})
				.catch(function(err) {
					reject(err);
				});
		} else { // set config status
			var currentDocument= {};
			currentDocument[dbConstants.DB.SERVER_CONFIGURED_FIELD]= set;
			_this.update(dbConstants.DB.ADMIN_COLLECTION, {}, {$set: currentDocument})
				.then(function(doc) {
					resolve();
				})
				.catch(function(err) {
					reject(err);
				});
		}
	});
	return promise;
};

/* wrapper to retrieve the admin email from the server */
mongodbAdvancedOperations.prototype.getAdminEmail = function(){
	return this.find(dbConstants.DB.ADMIN_COLLECTION,{})
	.then(function(result){
		return result[0]['admin-email'];
	});
};


//==========================================================================
// Database Initialization functions
//==========================================================================
/* init operations to be performed on server startup including initialization
 * default data insertion */

mongodbAdvancedOperations.prototype.init = {};

//Retrieve the namsapce for the default database and return the items as an array
mongodbAdvancedOperations.prototype.init.getNameSpace = function(){
	_this = this;
	var promise = new Promise(function(resolve,reject){
		_this.db.listCollections().toArray(function(err,items){				
			if (err) reject(err);
			else resolve(items);
		});
	});
};


//Check to see if the databse has been initialzied yet. If it has not, initialize it!
mongodbAdvancedOperations.prototype.init.checkInit = function(){
	var _this = this;
	var promise= new Promise(function(resolve, reject) {
		//check to see what
		/* Check if the "webapp" DB already exists. If it doesn't, 
		 * we need to intialize the DB. */
		_this.getNameSpace.then(function(collections) {
			//assumes that the db is setup if admin is in namesapces
			if (collections.indexOf(dbConstants.DB.ADMIN_COLLECTION) == MISSING)
				return _this.initializeDB().then(function(){
					return _this.insertDefaultData();
				});

		 }).then(function(){
		 	resolve(true); // nothing bad happend
		 }).catch(function(err) {
		 	_this.logger("error",err,{action:'connectAndInitializeDB'});
		 	reject(err);
		 });
	});
	return promise;
}; //end checkInit

/* chech to see if
/* Create the collections required for an initialized DB.
 * Returns a promise. */
mongodbAdvancedOperations.prototype.init.initializeDB = function() {
	this.logger("info","Creating and initializing database",{action:"initializeDB"});
	var _this = this;
	var promise= new Promise(function(resolve, reject){
		var currentDocument = {};
		currentDocument[dbConstants.PATIENTS.CURRENT_INDEX_FIELD]= 1;
		currentDocument[dbConstants.PANELS.CURRENT_INDEX_FIELD]= 1;
		// when the DB is first initialized, the server is not configured
		currentDocument[dbConstants.DB.SERVER_CONFIGURED_FIELD]= false;
		currentDocument.version = TARGET_VERSION.toString();

		// Create a patient collection and index by unique identifiers.
		// Do the same for panel collections.
		_this.insert(dbConstants.DB.ADMIN_COLLECTION, currentDocument)
		.then(function(result){
			// Patient IDs are unique.
			currentDocument= {};
			currentDocument[dbConstants.PATIENTS.ID_FIELD]= ASCENDING_INDEX;  // index in ascending order
			return _this.createIndex(dbConstants.PATIENTS.COLLECTION, currentDocument, {unique: true});
		})
		.then(function(result){
			// Patient Collection IDs are also unique
			currentDocument= {};
			currentDocument[dbConstants.PATIENTS.COLLECTION_ID]= DESCENDING_INDEX;  // index in descending order
			return _this.createIndex(dbConstants.PATIENTS.COLLECTION, currentDocument, {unique: true});
		})
		.then(function(result){
			var currentDocument = {};
			currentDocument[dbConstants.USERS.ID_FIELD]= ASCENDING_INDEX;
			return _this.createIndex(dbConstants.USERS.COLLECTION,currentDocument,{unique:true});
		})
		.then(function(result){
			//project_id field should be unique
			currentDocument = {};
			currentDocument[dbConstants.PROJECTS.ID_FIELD] = ASCENDING_INDEX; // index in ascending order
			return _this.createIndex(dbConstants.PROJECTS.COLLECTION, currentDocument,{unique:true});
		})
		.then(function(){
			//Create Collections for haplotypes.
			currentDocument = {};
			currentDocument[dbConstants.PGX.GENES.ID_FIELD] = ASCENDING_INDEX;
			return _this.createIndex(dbConstants.PGX.GENES.COLLECTION,currentDocument);
		})
		.then(function(){
			//create non unique indexes basex on the gene name
			currentDocument = {};
			currentDocument[dbConstants.DRUGS.ALL.ID_FIELD] = ASCENDING_INDEX;
			return _this.createIndex(dbConstants.DRUGS.ALL.COLLECTION,currentDocument);
		})
		.then(function(){
			return _this.createCollection(dbConstants.DRUGS.DRUGS.COLLECTION);
		})
		.then(function(){
			return _this.createCollection(dbConstants.DRUGS.DOSING.COLLECTION);
		})
		.then(function(){
			return _this.createCollection(dbConstants.DRUGS.FUTURE.COLLECTION);
		})
		.then(function(){
			return _this.createCollection(dbConstants.PGX.COORDS.COLLECTION);
		})
		.then(function(){
			return _this.createCollection(dbConstants.PGX.GENES.COLLECTION);
		})
		.then(function(){
			return _this.createCollection(dbConstants.DRUGS.CLASSES.COLLECTION);
		})
		.then(function(){
			_this.logger("info","Database collections initialize", {action:"initializeDB"});
			resolve();
		})
		.catch(function(err){
			_this.logger("error",err,{action:'createInitCollections'});
			reject(err);
		});
	});
};


/* Drug recommendation (both future and current recommendations) as well as associated haplotypes
* are all stored in separate collections. Each Entry in the colleciton is a single recommendation.
* Additionally within there is a separate collection created that contains one document
* corresponding to a single gene. This collection does not contain any data persay but contains
* several fields, recommendations, future, and haplotypes. Each of these are an array with object
* id's that link to the specific recmmomendation. This allows for very easy association of complex 
* durg relationships. Ie if a single recommendation interacts with many drugs, its object id is simply
* added to the dosing document for each of those drugs. All of the information is contained in the 
* main recommendaiton document.
*/
mongodbAdvancedOperations.prototype.init.insertDefaultData = function(){
	this.logger("info","Creating and initializing database",{action:"initializeDB"});
	var _this = this;
	var data;
	var promise= new Promise(function(resolve, reject){
	
		//Check to see if there are currently any default dosing recommendations
		return fs.statAsync(dbConstants.DRUGS.DEFAULT)
		//If there are add them to the database
		.then(function(result){
				//Save the default data in the data objec
			data = require(dbConstants.DRUGS.DEFAULT);
		})
		.then(function(){
			//INsert the drug names into the drugs collection;
			if (data.drugs){
				var options = {
					collectionName : dbConstants.DRUGS.DRUGS.COLLECTION,
					documents: data.drugs
				}
				return _this.insertMany(options)
					.catch(function(err){
						_this.logger("error",err,{action:'createInitCollections'});
					});
			}
		}).then(function(){
			//Check to see if the genes exits in the database (ie as we are adding it, is it already there)
			return Promise.resolve(data.Recommendations)
			.each(function(item){
				return _this.insert(dbConstants.DRUGS.DOSING.COLLECTION,item)
				.then(function(result){
					return Promise.resolve(result.genes)
					.each(function(gene){
				// check to see if there is a 
						return _this.checkInDatabase(dbConstants.DRUGS.ALL.COLLECTION,dbConstants.DRUGS.ALL.ID_FIELD,gene)
						.then(function(exists){
							if (!exists){
						//If this is a new gene, create a new document
							return _this.drugs.createNewDoc(gene,data.Genes[gene],'Dosing')
							}
						})
						.then(function(){
						//Update the documents now to iunclude the new objectID's
							var query = {};
							query[dbConstants.DRUGS.ALL.ID_FIELD] = gene;
							var update = {$addToSet:{},$set:{useDosing:true}};
							update.$addToSet[dbConstants.DRUGS.ALL.RECOMMENDATIONS] = result._id;
							return _this.update(dbConstants.DRUGS.ALL.COLLECTION,query,update);
						});
					});
				});
			})
			.catch(function(err){
				_this.logger("error",err,{action:'createInitCollections'});
			});
		})
		.then(function(){
				//Same as previously except for the future collections;
			return Promise.resolve(data.Future)
			.each(function(item){
				return _this.insert(dbConstants.DRUGS.FUTURE.COLLECTION,item)
				.then(function(result){
					return Promise.resolve(result.genes)
					.each(function(gene){
					// check to see if it exists already
						return _this.checkInDatabase(dbConstants.DRUGS.ALL.COLLECTION,dbConstants.DRUGS.ALL.ID_FIELD,gene)
						.then(function(exists){
							if (!exists){
								return _this.drugs.createNewDoc(gene,data.Genes[gene],'Dosing');
							}
						})
						.then(function(){
							var query = {};
							query[dbConstants.DRUGS.ALL.ID_FIELD] = gene;
							var update = {$addToSet:{},$set:{useDosing:true}};
							update.$addToSet[dbConstants.DRUGS.ALL.FUTURE] = result._id;
							return _this.update(dbConstants.DRUGS.ALL.COLLECTION,query,update);
						});
					});
				});
			}).catch(function(err){
				_this.logger("error",err,{action:'createInitCollections'});
			});
		}).then(function(){
			/* Assignment of the recommendation centre around the concept of attributing classes
			 * to a diplotype for a specific gene. These classes are different depending on the "type"
			 * of gene (ie. metabolizer or other); */
			var o = {
				documents: data.Classes,
				collectionName: dbConstants.DRUGS.CLASSES.COLLECTION
			};
			return _this.insertMany(o)
			.catch(function(err){
				_this.logger("err",err,{action:'createInitCollections'});
			});
		}).catch(function(err){
			_this.logger("info",dbConstants.DRUGS.DEFAULT + " was not found and could not be added to the databse",{action:'createInitCollections'});
		}).then(function(){
			//Chech to ensure the default haplotypes are located within direcetoryh
			fs.statAsync(dbConstants.PGX.GENES.DEFAULT)
			.then(function(){
				var pgxGenes = require(dbConstants.PGX.GENES.DEFAULT);
				var markers = [],keys;
				//Compile a list of all the markers within the haplotypes
				for (var i = 0; i < pgxGenes.length; i++ ){
					for (var j = 0; j < pgxGenes[i].markers.length; j++ ){
						if (markers.indexOf(pgxGenes[i].markers[j]) == MISSING ) markers.push(pgxGenes[i].markers[j])
					}
				}

				//Retrieve marker information from ncbi dbsnp databse and then save to the local database
				return getRS(markers)
				.then(function(result){
					if (result.missing.length > 0 ){
						_this.logger('info','could not retrieve information from NCBI dbSNP for several markers', {action:'getRS',missing:result.missing.length});
					}
					if (result.dbSnp.length > 0 ){
						var options = {
							collectionName : dbConstants.PGX.COORDS.COLLECTION,
							documents: result.dbSnp
						};
						return _this.insertMany(options);
					}
				//Add the Haplotypes to the database
				})
				.then(function(){
					return Promise.resolve(pgxGenes)
					.each(function(item){
						delete item._id;
						return _this.insert(dbConstants.PGX.GENES.COLLECTION,item)
						.then(function(result){
							var gene = result.gene;
							// check to see if it exists already
							return _this.checkInDatabase(dbConstants.DRUGS.ALL.COLLECTION,dbConstants.DRUGS.ALL.ID_FIELD,gene)
							.then(function(exists){
								if (!exists){
									return _this.drugs.createNewDoc(gene,undefined,"Haplotype");
								}
							})
							.then(function(){
								var query = {};
								query[dbConstants.DRUGS.ALL.ID_FIELD] = gene;
								var update = {$addToSet:{},$set:{useHaplotype:true}}
								update.$addToSet[dbConstants.DRUGS.ALL.CURRENT_HAPLO] = result._id;
								return _this.update(dbConstants.DRUGS.ALL.COLLECTION,query,update);
							})
							.then(function(){
								return _this.addMarkerToGene(result.markers,gene)
							});
						});
					});
				})
				.catch(function(err){
					_this.logger('error',err,{action:'createInitCollections'});
					reject(err);
				});

			})
			.catch(function(err){
				_this.logger('info','No Defualt PGx Data detected, skipping step',{action:'createInitCollections'});
			});
		}).then(function(result) {
			resolve();
		}).catch(function(err) {
			_this.logger('error',err);
			reject(err);
		}); 
	});

	return promise;
};

//=======================================================================================
//Login functions
//=======================================================================================
mongodbAdvancedOperations.prototype.auth = {};
//Add a user to the database, encrypting the provided password and storing them in the users db
mongodbAdvancedOperations.prototype.auth.addUser = function(user){
	assert(Object.prototype.toString.call(user[dbConstants.USERS.ID_FIELD]) == "[object String]",
		"Invalid Options");
	assert(Object.prototype.toString.call(user[dbConstants.USERS.PASSWORD_FIELD]) == "[object String]",
		"Invalid Options");
	//encrypt the password
	this.logger('info','adding new user to databse', {'user':user[dbConstants.USER_ID_FIELD]});
	user[dbConstants.USERS.PASSWORD_FIELD] = bcrypt.hashSync(user[dbConstants.USERS.PASSWORD_FIELD], bcrypt.genSaltSync(SALT), null);
	return this.insert(dbConstants.USERS.COLLECTION,user);
};

//Find a user by the provided ID and return all information related to them
mongodbAdvancedOperations.prototype.auth.findUserById = function(id){
	assert(Object.prototype.toString.call(id) == "[object String]",
		"Invalid Options");
	var query = {};
	query[dbConstants.USERS.ID_FIELD] = id;
	return this.findOne(dbConstants.USERS.COLLECTION,query);

};

//Validate the password during signon in a secure manner.
mongodbAdvancedOperations.prototype.auth.validatePassword = function(username,password){
	assert(Object.prototype.toString.call(username) == "[object String]",
		"Invalid Options");
	assert(Object.prototype.toString.call(password) == "[object String]",
		"Invalid Options");
	return this.auth.findUserById(username).then(function(result){
		 return bcrypt.compareSync(password, result[dbConstants.USERS.PASSWORD_FIELD]);
	});

};


//Find the user by the google id
mongodbAdvancedOperations.prototype.auth.findUserByGoogleId = function(id){
	assert(Object.prototype.toString.call(id) == "[object String]",
		"Invalid Options");
	var query = {};
	query[dbConstants.USERS.GOOGLE.ID_FIELD] = id;
	return this.findOne(dbConstants.USERS.COLLECTION,query);
};

//Add a google user, only used for Google OAUTH
mongodbAdvancedOperations.prototype.auth.addUserGoogle = function(user){
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


//When the password is lost and needs to be recovered, generate a random password, bcrypt it
//And return the new password in an non-encrypted format
mongodbAdvancedOperations.prototype.auth.generatePassword = function(user){
	assert(Object.prototype.toString.call(user) == "[object String]",
		"Invalid Options");

	var newPassowrd = randomstring(PWD_STRING_LEN);
	var encryptPassword = bcrypt.hashSync(newPassowrd,bcrypt.genSaltSync(SALT),null);
	var query = {};
	query[dbConstants.USERS.ID_FIELD] = user;
	newPass = {};
	newPass[dbConstants.USERS.PASSWORD_FIELD] = encryptPassword;
	var doc = {$set:newPass};
	return this.update(dbConstants.USERS.COLLECTION,query,doc,undefined,user).then(function(result){
		return newPassowrd;
	});
};


//Change the current users password
mongodbAdvancedOperations.prototype.auth.changePassword = function(user, password){
	assert(Object.prototype.toString.call(user) == "[object String]",
		"Invalid Options");
	assert(Object.prototype.toString.call(password) == "[object String]",
		"Invalid Options");
	var encryptPassword = bcrypt.hashSync(password,bcrypt.genSaltSync(SALT),null);
	var doc = {};
	var query = {};
	query[dbConstants.USERS.ID_FIELD] = user;
	doc[dbConstants.USERS.PASSWORD_FIELD] = encryptPassword;
	doc = {$set:doc};
	this.logger('info','changing password for' + user,{action:'changePassword'});
	return this.update(dbConstants.USERS.COLLECTION,query,doc,undefined,user);
};


mongodbAdvancedOperations.prototype.

module.exports = mongodbAuthAndLogin;
