var Promise = require("bluebird");
var assert= require("assert");
//var dbConstants = require("../conf/constants.json").dbConstants;
//var nodeConstants = require('../conf/constants.json').nodeConstants;
var dbConstants = require("../lib/conf/constants.json").dbConstants;
var nodeConstants = require('../lib/conf/constants.json').nodeConstants;
var utils = require("../lib/utils");

//errors

var MissingParameterError = require("../lib/errors/MissingParameterError");
var InvalidParameterError = require("../lib/errors/InvalidParameterError");

function mongodbBasicOperations(db,logger){
	if (db === undefined)
		throw new MissingParameterError("database object is required");
	this.db = db;
	if (!logger) logger = require('../lib/logger')(nodeConstants.LOG_DIR)//require('./logger')(nodeConstants.LOG_DIR)//
	this.logger = logger; //Accepts a logger instance
}

mongodbBasicOperations.prototype.find= function(collectionName, query, fields, options,user) {
	var args = arguments;
	var _this = this;
	// validate input
	if (!collectionName || !query)
		throw new MissingParameterError("Required parameter is missing");
	if (!utils.isString(collectionName))
		throw new InvalidParameterError("Invalid collection name, must be a valid string");
	if (!utils.isObject(query))
		throw new InvalidParameterError("Query must be an object");

	if (options){
		if(options == {})
			options = undefined;
		else if (!utils.isObject(options))
			throw new InvalidParameterError("Options must be an object")
			
	}
	var promise= new Promise(function(resolve, reject) {
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


/* find and remove a patient where options are the query to submit
* returns a promise */
mongodbBasicOperations.prototype.removeDocument = function(collectionName,options,user){
	var args = arguments;
	var _this = this;

	// validate input
	if (!collectionName || !options)
			throw new MissingParameterError("Required parameter is missing");
	if ( !utils.isObject(options))
		throw new InvalidParameterError("Required paramter: Options in removeDocument must be an object");

	this.logger('info','removing document from collection', {'collection':collectionName,query:options});
	var promise = new Promise(function(resolve,reject){
		var collection = _this.db.getDB().collection(collectionName);
		collection.remove(options,function(err,doc){
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

mongodbBasicOperations.prototype.aggregate = function(collectionName,aggArray,user){
		var args = arguments;
		var _this = this;
		
		if (!collectionName || !aggArray)
			throw new MissingParameterError("Required parameter is missing");
		if (!utils.isString(collectionName))
			throw new InvalidParameterError("collectionName must be a valid string");
		if (!utils.isArray(aggArray))
			throw new InvalidParameterError("Invalid options, aggregation array must be an array");


		var promise = new Promise(function(resolve,reject){
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

mongodbBasicOperations.prototype.insert= function(collectionName, doc, user) {
		var args = arguments;
		var _this = this;
		// validate input
		if (!collectionName || !doc)
			throw new MissingParameterError("Required parameter is missing");
		if (!utils.isString(collectionName))
			throw new InvalidParameterError("collectionName must be a valid string");
		if (!utils.isObject(doc))
			throw new InvalidParameterError("doc must be an object containing new document information");

		var promise= new Promise(function(resolve, reject) {
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

/* Insert Many documents at once into a collection.
 * Takes one Object with two paramters arguments:
 * tablename: tablename
 * documents: {object to insert}
 * Returns a promise. */
mongodbBasicOperations.prototype.insertMany = function(options,user){
	var _this = this;
	if (!options)
		throw new MissingParameterError("Required parameter is missing");
	if (!options.collectionName || options.documents)
		throw new MissingParameterError("No Collection Name Provided");
	if (!utils.isObject(options))
		throw new InvalidParameterError("Options must be an Object");
	if (!utils.isString(options.collectionName))
		throw new InvalidParameterError("collectionName must be a valid string");
	if (!utils.isArray(options.documents))
		throw new InvalidParameterError("documents must be in an array");

	var promise = new Promise(function(resolve,reject){
		
		_this.db.getDB().collection(options.collectionName,function(err,collection){
			var bulk = collection.initializeOrderedBulkOp();
			for (var i = 0; i < options.documents.length; i++){
				bulk.insert(options.documents[i]);
			}
			bulk.execute(function(err,doc){
				if(err){
					_this.logger("error",err,{action:'insertMany',target:options.collectionName,user:user,arguments:options});
					reject(err);
				} else {
					_this.logger("info","successfully inserted " + options.documents.length.toString() + "documents",{action:'insertMany',target:options.collectionName,user:user});
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
mongodbBasicOperations.prototype.update= function(collectionName, query, doc, options,user) {
	var args = arguments;
	var _this = this;

	// validate input
	if (! collectionName || ! query || !doc)
		throw new MissingParameterError("Required parameters are missing");
	if (!utils.isString(collectionName))
		throw new InvalidParameterError("collectionName must be a valid string");
	if (!utils.isObject(query))
		throw new InvalidParameterError("Query must be an object");
	if (!utils.isObject(doc))
		throw new InvalidParameterError("Document to update must be an object");
	if (options)
		if (!utils.isObject(options))
			throw new InvalidParameterError("Options must be an object");

	var promise= new Promise(function(resolve, reject) {
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
	if (! collectionName || ! spec )
		throw new MissingParameterError("Required parameters are missing");
	if (!utils.isString(collectionName))
		throw new InvalidParameterError("collectionName must be a valid string");
	if (!utils.isObject(spec))
		throw new InvalidParameterError("Invalid spec");

	var promise= new Promise(function(resolve, reject) {
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

/* Find a single document based on the query. 
 * Returns a promise. */
mongodbBasicOperations.prototype.findOne= function(collectionName,query,user) {
	var args = arguments;
	var _this = this;
	if (! collectionName || ! query)
		throw new MissingParameterError("Required parameters are missing");
	// validate input
	if (!utils.isString(collectionName))
		throw new InvalidParameterError("collectionName must be a valid String");
	if (!utils.isObject(query))
		throw new InvalidParameterError("Query must be an object");

	var promise= new Promise(function(resolve, reject) {
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


/* Return the count of documents matching the query.
 * Returns a promise. */
mongodbBasicOperations.prototype.count= function(collectionName, query) {
	var _this = this;
	if (!collectionName || !query)
		throw new MissingParameterError("Required parameters are missing");
	if (!utils.isString(collectionName))
		throw new InvalidParameterError("collectionName must be a valid string");
	if (!utils.isObject(query))
		throw new InvalidParameterError("Query must be an object");
	var promise= new Promise(function(resolve, reject) {
		_this.db.getDB().collection(collectionName).count(query, function(err, count){
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
mongodbBasicOperations.prototype.createCollection = function(name,user){
	var _this = this;
	if (!name)
		throw new MissingParameterError("A collection name is required");
	if (!utils.isString(name))
	var promise = new Promise(function(resolve,reject){
		if (name){
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
		} else {
			reject();
			return false;
		}
	});
	return promise;
};

/* Drop a currently existing collection
 * returns a promise */
mongodbBasicOperations.prototype.dropCollection = function(collectionName,user){
	var _this = this;
	if (!collectionName)
		throw new MissingParameterError("CollectionName required");
	if (!utils.isString(collectionName))
		throw new InvalidParameterError("collectionName must be a valid string");

	var promise = new Promise(function(resolve,reject){
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

/* Check within the specified database to determine whether or not an item exists*/
mongodbBasicOperations.prototype.checkInDatabase = function(collection,field,value,user){

	if (!collection || ! field || ! value)
		throw new MissingParameterError("Required paramter is missing");
	if (!utils.isString(collection))
		throw new InvalidParameterError("collection must be a valid string");
	if (!utils.isString(field))
		throw new InvalidParameterError("field paramter must be a valid string");
	var query = {};
	query[field] = value;
	return this.findOne(collection,query,user).then(function(result){
		if (result){
			return true;
		} else {
			return false;
		}
	});
};

//get the owner of a specified field
mongodbBasicOperations.prototype.getOwner = function(collection,field){
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
};


module.exports = mongodbBasicOperations;