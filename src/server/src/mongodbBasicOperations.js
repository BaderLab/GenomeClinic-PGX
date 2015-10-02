var Promise = require("bluebird");
var assert= require("assert");
var dbConstants = require("../conf/constants.json").dbConstants;
var nodeConstants = require('../conf/constants.json').nodeConstants;
//var dbConstants = require("../lib/conf/constants.json").dbConstants;
//var nodeConstants = require('../lib/conf/constants.json').nodeConstants;


function mongoBasicOperations(db,logger){
	assert.notStrictEqual(db,undefined);
	this.db = db;
	if (!logger) logger = require('../lib/logger')(nodeConstants.LOG_DIR)//require('./logger')(nodeConstants.LOG_DIR)
	this.logger = logger; //Accepts a logger instance
}

mongoBasicOperations.prototype.find= function(collectionName, query, fields, options,user) {
	var args = arguments;
	var _this = this;
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
		_this.db.getDB().collection(collectionName)
		.find(query, fields, options)
		.toArray(function(err, doc) {
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
mongoBasicOperations.prototype.removeDocument = function(collectionName,options,user){
	var args = arguments;
	var _this = this;

	// validate input
	assert(Object.prototype.toString.call(options) == "[object Object]",
		"Invalid Options");

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

mongoBasicOperations.prototype.aggregate = function(collectionName,aggArray,user){
		var args = arguments;
		var _this = this;
		assert(Object.prototype.toString.call(aggArray) == "[object Array]",
			"Invalid Options, aggregate requires an array");

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

mongoBasicOperations.prototype.insert= function(collectionName, doc, user) {
		var args = arguments;
		var _this = this;
		// validate input
		assert(Object.prototype.toString.call(collectionName) == "[object String]",
			"Invalid collection");
		assert(Object.prototype.toString.call(doc) == "[object Object]",
			"Invalid document");

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
mongoBasicOperations.prototype.insertMany = function(options,user){
	var _this = this;
	assert(Object.prototype.toString.call(options) == "[object Object]",
		"Invalid Options");
	var promise = new Promise(function(resolve,reject){
		if(!options.collectionName){
			reject(new ReferenceError("No Collection Name Provided"));
		}
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
mongoBasicOperations.prototype.update= function(collectionName, query, doc, options,user) {
	var args = arguments;
	var _this = this;

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
mongoBasicOperations.prototype.createIndex= function(collectionName, spec, options,user) {
	var args = arguments;
	var _this = this;
	// validate input
	assert(Object.prototype.toString.call(collectionName) == "[object String]",
		"Invalid collection");
	assert(Object.prototype.toString.call(spec) == "[object Object]",
		"Invalid spec");

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
mongoBasicOperations.prototype.findOne= function(collectionName,query,user) {
	var args = arguments;
	var _this = this;
	// validate input
	assert(Object.prototype.toString.call(collectionName) == "[object String]",
		"Invalid collection");
	assert(Object.prototype.toString.call(query) == "[object Object]",
		"Invalid query");
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
mongoBasicOperations.prototype.count= function(collectionName, query) {
	var _this = this;
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
mongoBasicOperations.prototype.createCollection = function(name,user){
	var _this = this;
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
mongoBasicOperations.prototype.dropCollection = function(collectionName,user){
	var _this = this;
	assert(Object.prototype.toString.call(collectionName) == "[object String]",
		"Invalid Options");

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
mongoBasicOperations.prototype.checkInDatabase = function(collection,field,value,user){
	assert(Object.prototype.toString.call(collection) == "[object String]",
		"Invalid collection");
	assert(Object.prototype.toString.call(field) == "[object String]",
		"Invalid collection");
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


module.exports = mongoBasicOperations;