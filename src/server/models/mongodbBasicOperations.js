var Promise = require("bluebird");
//var dbConstants = require("../conf/constants.json").dbConstants;
//var nodeConstants = require('../conf/constants.json').nodeConstants;
var dbConstants = require("../lib/conf/constants.json").dbConstants;
var nodeConstants = require('../lib/conf/constants.json').nodeConstants;
var utils = require("../lib/utils");

//errors

var MissingParameterError = require("../lib/errors/MissingParameterError");
var InvalidParameterError = require("../lib/errors/InvalidParameterError");

/**
 * Basic Operations constructor definition. The basic operations contains a set of functions
 * that can be exntended and shared across db resources. These are the base fucntions that work
 * on any collection
 * @param db a database instance from mongodbConnect
 * @param logger the logger instance
 * @throws MissingParameterError
 */
function mongodbBasicOperations(db,logger){
	if (db === undefined)
		throw new MissingParameterError("database object is required");
	this.db = db;
	if (!logger) logger = require('../lib/logger')(nodeConstants.LOG_DIR)//require('./logger')(nodeConstants.LOG_DIR)//
	this.logger = logger; //Accepts a logger instance
}

/**
 * Search through a collection and find all of the entries that meet the query criteria, returning
 * the result as an array. If the fields paramter is provided, only return the fields that are defined.
 * takes additional options as well (look at mongodb find api)
 * @param collectionName name of the collection
 * @param query object with the query. can be {} but cannot be undefined
 * @param fields which fields to return, defined as {<fieldname>:0 or 1}
 * @param options object of additional options
 * @param user
 * @return promise
 * @throws MissingParameterError
 * @throws InvalidParameterError
 */
mongodbBasicOperations.prototype.find= function(collectionName, query, fields, options,user) {
	var args = arguments;
	var _this  = this;
	// validate input
	var promise= new Promise(function(resolve, reject) {
		if (!collectionName || !query)
			reject(new MissingParameterError("Required parameter is missing"));
		if (!utils.isString(collectionName))
			reject(new InvalidParameterError("Invalid collection name, must be a valid string"));
		if (!utils.isObject(query))
			reject(new InvalidParameterError("Query must be an object"));

		if (options){
			if(options == {})
				options = undefined;
			else if (!utils.isObject(options))
				reject(new InvalidParameterError("Options must be an object"));
		}
		_this.db.getDB().collection(collectionName)
		.find(query, fields, options)
		.toArray(function(err, doc) {
			if (doc === null ) doc = [];
			if (err) {
				_this.logger('err',err,{action:'find',arguments:args});
				reject(err);
			}
			_this.logger('info',"Found " + doc.length + "meeting search criteria",{action:'find',arguments:arguments,user:user,target:collectionName})
			resolve(doc);
		});
	});
	return promise;	
};


/**
 * Search through a collection and find all of the entries that meet the query criteria and remove them
 * from the collection
 * @param collectionName name of the collection
 * @param query object with the query. can be {} but cannot be undefined
 * @param user
 * @return promise
 * @throws MissingParameterError
 * @throws InvalidParameterError
 */
mongodbBasicOperations.prototype.removeDocument = function(collectionName,query,user){
	var args = arguments;
	var _this = this;
	var promise = new Promise(function(resolve,reject){
		if (!collectionName || !options)
			reject(new MissingParameterError("Required parameter is missing"));
		if ( !utils.isObject(query))
			reject(new InvalidParameterError("Required paramter: query in removeDocument must be an object"));

		_this.logger('info','removing document from collection', {'collection':collectionName,query:query});
		var collection = _this.db.getDB().collection(collectionName);
		collection.remove(query,function(err,doc){
			if (err){
				_this.logger('error',err,{action:'removeDocument',user:user,arguments:arguments, target:collectionName})
				reject(err);
			} else {
				_this.logger('info',"Document successfully removed",{action:'removeDocument',user:user,arguments:args,target:collectionName})
				resolve(doc);
			}
		});	
	});
	return promise;
};

/**
 * Serach through a collection using a series of commands defined in the aggregation array.
 * These commands allow the transformation of data (similar to a join except on a single dataset).
 * See the mongodb api for a full explanation of aggregation
 * @param collectionName name of the collection
 * @param aggArray an Array of objects defining the actions to take
 * @param user
 * @return promise
 * @throws MissingParameterError
 * @throws InvalidParameterError
 */
mongodbBasicOperations.prototype.aggregate = function(collectionName,aggArray,user){
		var args = arguments;
		var _this = this;
		var promise = new Promise(function(resolve,reject){
			if (!collectionName || !aggArray)
				reject(new MissingParameterError("Required parameter is missing"));
			if (!utils.isString(collectionName))
				reject(new InvalidParameterError("collectionName must be a valid string"));
			if (!utils.isArray(aggArray))
				reject(new InvalidParameterError("Invalid options, aggregation array must be an array"));
			var collection = _this.db.getDB().collection(collectionName);
			collection.aggregate(aggArray,function(err,doc){
				if (err){
					_this.logger('error',err,{action:'aggregate',user:user,arguments:args})
					reject(err);
				}
				_this.logger('info',"Found " + doc.length + "meeting search criteria",{action:'aggregate',user:user,arguments:arguments,target:collectionName})
				resolve(doc);
			});
		});

		return promise;
	};
/**
 * Insert a new document into a given collection. This function does not enforce any rules about what
 * is in the document and will simply insert any data supplied it. If more advanced type checking 
 * and data models are required, it is advisable to write a wrapper around the insert to perform the check.
 * @param collectionName name of the collection
 * @param doc to be inserted
 * @param user
 * @return promise inserted document with Oid
 * @throws MissingParameterError
 * @throws InvalidParameterError
 */
mongodbBasicOperations.prototype.insert= function(collectionName, doc, user) {
		var args = arguments;
		var _this = this;
		// validate input
		var promise= new Promise(function(resolve, reject) {
			if (!collectionName || !doc)
				reject(new MissingParameterError("Required parameter is missing"));
			if (!utils.isString(collectionName))
				reject(new InvalidParameterError("collectionName must be a valid string"));
			if (!utils.isObject(doc))
				reject(new InvalidParameterError("doc must be an object containing new document information"));
			_this.db.getDB().collection(collectionName).insert(doc, {}, function(err, result) {
				if (err) {
					_this.logger("error",err,{action:'insert',target:collectionName,user:user,arguments:args});
					reject(err);
				}
				_this.logger("info","Document successfully inserted",{action:'insert',user:user,target:collectionName});
				resolve(doc);
			});
		});
		return promise;
	};

/**
 * Insert many documents at once in a single batch command. the Documents and the collectionName to insert
 * them into must be in a single object. The documents are required to be in the format of an array like the
 * following 
 *
 * documents: {
 * 		collectionName: <name of collection>
 *		documents: [<object of document>]	
 * }
 *
 * @param documents object all documents to insert
 * @param user
 * @return promise
 * @throws MissingParameterError
 * @throws InvalidParameterError
 */
mongodbBasicOperations.prototype.insertMany = function(documents,user){
	var _this = this;
	

	var promise = new Promise(function(resolve,reject){
		if (!documents)
			reject(new MissingParameterError("Required parameter is missing"));
		if (!documents.collectionName || !documents.documents)
			reject(new MissingParameterError("Missing collection name or documents to add"));
		if (!utils.isObject(documents))
			reject(new InvalidParameterError("Options must be an Object"));
		if (!utils.isString(documents.collectionName))
			reject(new InvalidParameterError("collectionName must be a valid string"));
		if (!utils.isArray(documents.documents))
			reject(new InvalidParameterError("documents must be in an array"));

		_this.db.getDB().collection(documents.collectionName,function(err,collection){
			var bulk = collection.initializeOrderedBulkOp();
			for (var i = 0; i < documents.documents.length; i++){
				bulk.insert(documents.documents[i]);
			}
			bulk.execute(function(err,doc){
				if(err){
					_this.logger("error",err,{action:'insertMany',target:documents.collectionName,user:user,arguments:documents});
					reject(err);
				} else {
					_this.logger("info","successfully inserted " + documents.documents.length.toString() + "documents",{action:'insertMany',target:options.collectionName,user:user});
					resolve(doc);
				}
			});
		});
	});
	return promise;
};


/**
 * Update an entry or a number of entries with the document that fit the query criteria, using 
 * the doc to update the found entry. refer to the mongodb api about the specific update commands
 * that can be employed. Additionally, if you want to update more then once document at a time, 
 * you must set the options to {multi:true} 
 * @param collectionName name of the collection
 * @oaram query serach query
 * @param doc update documents
 * @param options additional options to change update behaviour
 * @param user
 * @return promise inserted document with Oid
 * @throws MissingParameterError
 * @throws InvalidParameterError
 */
mongodbBasicOperations.prototype.update= function(collectionName, query, doc, options,user) {
	var args = arguments;
	var _this = this;

	// validate input
	

	var promise= new Promise(function(resolve, reject) {
		if (! collectionName || ! query || !doc)
			reject(new MissingParameterError("Required parameters are missing"));
		if (!utils.isString(collectionName))
			reject(new InvalidParameterError("collectionName must be a valid string"));
		if (!utils.isObject(query))
			reject(new InvalidParameterError("Query must be an object"));
		if (!utils.isObject(doc))
			reject(new InvalidParameterError("Document to update must be an object"));
		if (options)
			if (!utils.isObject(options))
				reject(new InvalidParameterError("Options must be an object"));

		_this.db.getDB().collection(collectionName).update(query, doc, options, function(err, resultDoc) {
			if (err) {
				_this.logger("error",err,{action:'update',arguments:args,target:collectionName,user:user});
				reject(err);
			}
			_this.logger("info","successfully updated documents",{action:'update',arguments:args,target:collectionName,user:user});
			resolve(resultDoc);
		});
	});
	return promise;
};

/* Create index for a specific field in a collection.
 * spec format example: {a:1, b:-1}, a in ascending index order, b in descending
 * options format example: {unique: true} to ensure that the index is unique
 * Returns a promise. */
mongodbBasicOperations.prototype.createIndex= function(collectionName, spec, options,user) {
	var args = arguments;
	var _this = this;
	// validate input

	var promise= new Promise(function(resolve, reject) {
		if (! collectionName || ! spec )
			reject(new MissingParameterError("Required parameters are missing"));
		if (!utils.isString(collectionName))
			reject(new InvalidParameterError("collectionName must be a valid string"));
		if (!utils.isObject(spec))
			reject(new InvalidParameterError("Invalid spec"));

		_this.db.getDB().collection(collectionName).createIndex(spec, options, function(err, result) {
			if (err) {
				_this.logger("error",err,{action:'createIndex',arguments:args,target:collectionName,user:user});
				reject(err);
			}
			_this.logger("info","successfully created index",{action:'createIndex',arguments:args,target:collectionName,user:user});
			resolve(result);
		});
	});
	return promise;	
};

/**
 * Search through a collection and return the FIRST entry that meats the search criteria.
 * Even if there would have been a number of matchesthis ONLY returns the frst encounter match
 * additionally it is returned as an object.
 * @param collectionName name of the collection
 * @param query 
 * @param user
 * @return promise single entry
 * @throws MissingParameterError
 * @throws InvalidParameterError
 */
mongodbBasicOperations.prototype.findOne= function(collectionName,query,user) {
	var args = arguments;
	var _this = this;
	
	var promise= new Promise(function(resolve, reject) {
		if (! collectionName || ! query)
			reject(new MissingParameterError("Required parameters are missing"));
		// validate input
		if (!utils.isString(collectionName))
			reject(new InvalidParameterError("collectionName must be a valid String"));
		if (!utils.isObject(query))
			reject( new InvalidParameterError("Query must be an object"));
		_this.db.getDB().collection(collectionName).findOne(query,function(err, doc) {
			if (err) {
				_this.logger("error",err,{action:'insert',arguments:args,target:collectionName,user:user});
				reject(err);
			}
			if (doc){
				_this.logger("info","Found one document corresponding to search criteria",{action:'findOne',arguments:args,target:collectionName,user:user});
			} else {
				_this.logger("info","Found no documents corresponding to search criteria",{action:'findOne',arguments:args,target:collectionName,user:user});
			}
			resolve(doc);
		});
	});
	return promise;	
};


/**
 * Serach through a collection and count the number of entries that match the query
 * @param collectionName name of the collection
 * @param query
 * @return promise iwith settled value of the numebr
 * @throws MissingParameterError
 * @throws InvalidParameterError
 */
mongodbBasicOperations.prototype.count= function(collectionName, query) {
	var _this = this;
	var promise= new Promise(function(resolve, reject) {
		if (!collectionName || !query)
			reject(new MissingParameterError("Required parameters are missing"));
		if (!utils.isString(collectionName))
			reject(new InvalidParameterError("collectionName must be a valid string"));
		if (!utils.isObject(query))
			reject(new InvalidParameterError("Query must be an object"));
		_this.db.getDB().collection(collectionName).count(query, function(err, count){
			if (err) {
				reject(err);
			}
			resolve(count);
		});
	});
	return promise;
};


/**
 * Create a new collection with the defined name in the current databse
 * @param name
 * @param user
 * @throws MissingParameterError
 * @throws InvalidParameterError
 * @throws MongoError
 */
mongodbBasicOperations.prototype.createCollection = function(name,user){
	var _this = this;

	var promise = new Promise(function(resolve,reject){
		if (!name)
			reject(new MissingParameterError("A collection name is required"));
		if (!utils.isString(name))
			reject(new InvalidParameterError("collection name must be a string"));
		_this.db.getDB().createCollection(name,{strict:true},function(err,collection){
			if ( err ){
				_this.logger("error",err,{action:'createCollection',target:name,user:user});
				reject(err);
				return false
			} else {
				_this.logger("info","successfully created new collection",{action:'createCollection',target:name,user:user});
				resolve(collection);
				return false
			}
		});
	});
	return promise;
};

/**
 * Delete an entire collection from the databse. In general this is performed when faulty 
 * patient data is encountered while parsing a VCF file. 
 * @param collectionName 
 * @param user
 * @return promise 
 * @throws MissingParameterError
 * @throws InvalidParameterError
 */
mongodbBasicOperations.prototype.dropCollection = function(collectionName,user){
	var _this = this;
	var promise = new Promise(function(resolve,reject){
		if (!collectionName)
			reject(new MissingParameterError("CollectionName required"));
		if (!utils.isString(collectionName))
			reject(new InvalidParameterError("collectionName must be a valid string"));
		_this.db.getDB().dropCollection(collectionName, function(err,done){
			if (err){
				_this.logger("error",err,{action:'dropCollection',target:collectionName,user:user});
				reject(err);
			} else {
				_this.logger("info","successfully dropped collection from database",{action:'dropCollection',target:collectionName,user:user});
				resolve(done);
			}
		});
	});
	return promise;
};

/**
 * Check to see if a specifc field and value are already in the database.
 * @param collectionName name of the collection
 * @param field the field to test
 * @param value the set value of the field
 * @param user
 * @return promise true / false
 * @throws MissingParameterError
 * @throws InvalidParameterError
 */
mongodbBasicOperations.prototype.checkInDatabase = function(collection,field,value,user){
	var _this = this;
	var promise = Promise.resolve().then(function(){
		if (!collection || ! field || ! value)
			throw new MissingParameterError("Required paramter is missing");
		if (!utils.isString(field))
			throw new InvalidParameterError("field paramter must be a valid string");
		var query = {};
		query[field] = value;
		return _this.findOne(collection,query,user).then(function(result){
			if (result){
				return true;
			} else {
				return false;
			}
		});
	});
	return promise;
};

//get the owner of a specified field
mongodbBasicOperations.prototype.getOwner = function(collection,field){
	var _this = this;
	var promise = Promise.resolve().then(function(){
		if (!collection || !field)
			throw new MissingParameterError("Required parameter missing");
		if (!utils.isString(collection))
			throw new InvalidParameterError("collection must be a valid string");
		if (!utils.isString(field))
			throw new InvalidParameterError("field must be a string");

		var query = {};
		if (collection === dbConstants.PROJECTS.COLLECTION){
			query[dbConstants.PROJECTS.ID_FIELD]=field;
		} else if (collection === dbConstants.PATIENTS.COLLECTION){
			query[dbConstants.PATIENTS.ID_FIELD]=field;
		}
		return this.findOne(collection,query).then(function(result){
			if (result){
				return result[dbConstants.DB.OWNER_ID];
			} else {
				return undefined;
			}
		});
	});
	return promise;
};


module.exports = mongodbBasicOperations;