/* Bulk Operations for the database
 * Perform bulk import and export operations on the database
 * allowing the user to input or export files in the JSON
 * form. The bulk operations take a single positional argument flaging either
 * import or export, followed by the specofoc functions for that seuqence */

var MongoClient = require('mongodb').MongoClient;
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
//var logger  = require('./src/server/src/logger');
var constants = require('./src/server/conf/constants.json');
//var logger = require('./lib/logger');
//var constants = require('./lib/conf/constants.json');

var db;

var ops = {
	operation : ['import','export'],
	import : {
		options : ['future','recommendation','haplotype'],
		usage : '\nbulkop.js import [collection]\n',
		future : {
			args : ['file'],
			collection : constants.dbConstants.DRUGS.FUTURE.COLLECTION

		},
		recommendation : {
			args : ['file'],
			collection : constants.dbConstants.DRUGS.DOSING.COLLECTION
		},
		haplotype : {
			args : ['file'],
			collection : constants.dbConstants.PGX.GENES.COLLECTION,
			marker_collection : constants.dbConstants.PGX.COORDS.COLLECTION
		}
	},
	export : {
		options : ['future','recommendation','haplotype','genes','descriptors','patients','patient'],
		usage:'\nbulkop.js export [collection] [file]',
		future : {
			args :['infile','outfile']
		},
		recommendation :{
			args :['infile','outfile']
		},
		haplotype : {
			args :['infile','outfile']
		},
		genes :{
			args :['infile','outfile']
		},
		descriptors :{
			args :['infile','outfile']
		},
		patient : {
			args :['infile','outfile']
		},
		patients :{
			args :['infile','outfile']
		}
	},
}


var usage = function(op,col){
	var usgStsring = '\nbulkop.js'
	if (!op || op == '-h' || op == 'help'){
		usgStsring += ' [operation]\n\n';
		usgStsring += "Please select from the following list\n\n";
		for (var i = 0; i < ops.operation.length; i++ ){
			usgStsring += '\t' + (i + 1) + '. ' + ops.operation[i] + '\n';
		}
		usgStsring += '\n\thelp\t-h\tprovide this list';
	} else if (!col || col == '-h' || col == 'help') {
		usgStsring += ' ' + op + ' [collection]\n\n';
		usgStsring += "Please select from the following list\n\n";
		for (var i = 0; i < ops[op].options.length; i++ ){
			usgStsring += '\t' + (i + 1) + '. ' + ops[op].options[i] + '\n';
		}
		usgStsring += '\n\thelp\t-h\tprovide this list';
	} else {
		usgStsring += ' ' + op  + ' ' + col;
		for (var i = 0; i < ops[op][col].args.length; i++ ){
			usgStsring += ' [' + ops[op][col].args[i] + ']';
		}
		usgStsring += '\n\n\thelp\t-h\tprovide this list';

	}

	console.log(usgStsring)
	process.exit(0)
}


//SMALL NUMBER OF MONGO FUNCTION
var connect= function() {
		// if DB exists and is open/closed, refresh/open the connection pool
	if (db) {
		db.open();
		return null;
	}

	dbURL= "mongodb://" + constants.dbConstants.DB.HOST + ":" + constants.dbConstants.DB.PORT + "/" + constants.dbConstants.DB.NAME;

	var promise= new Promise(function(resolve, reject) {
		MongoClient.connect(dbURL, function(err, DB) {
			if (err) {
				reject(err);
			}
			//logger("info","Connected to mongoDatabase",{target:dbURL,action:'connect'});
			db = DB;
			resolve(DB);
		});
	});
	return promise;
};


var find= function(collectionName, query) {
	assert.notStrictEqual(db, undefined); // ensure we're connected first
	var args = arguments;

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
				//logger('err',err,{action:'find',arguments:args});
				reject(err);
			}
			//logger('info',"Found " + doc.length + "meeting search criteria",{action:'find',arguments:arguments,user:user,target:collectionName})
			resolve(doc);
		});
	});
	return promise;	
};


var insertMany = function(col,documents){
	assert.notStrictEqual(db, undefined); // ensure we're connected first


	// validate input
	assert(Object.prototype.toString.call(options) == "[object Object]",
		"Invalid Options");

	
	var promise = new Promise(function(resolve,reject){
		db.collection(col,function(err,collection){
			var bulk = collection.initializeOrderedBulkOp();
			for (var i = 0; i < documents.length; i++){
				bulk.insert(documents[i]);
			}
			bulk.execute(function(err,doc){
				if(err){
					//logger("error",err,{action:'insertMany',target:col,user:user});
					reject(err);
				} else {
					//logger("info","successfully inserted " + documents.length.toString() + "documents",{action:'insertMany',target:collectionName,user:user});
					resolve(doc);
				}
			});
		});
	});
	return promise;
};

var update= function(collectionName, query, doc) {
	assert.notStrictEqual(db, undefined); // ensure we're connected first
	var args = arguments;

	// validate input
	assert(Object.prototype.toString.call(collectionName) == "[object String]",
		"Invalid collection");
	assert(Object.prototype.toString.call(query) == "[object Object]",
		"Invalid query");
	assert(Object.prototype.toString.call(doc) == "[object Object]",
		"Invalid update document");
	var options;
	var promise= new Promise(function(resolve, reject) {
		db.collection(collectionName).update(query, doc, options, function(err, resultDoc) {
			if (err) {
				//logger("error",err,{action:'update',arguments:args,target:collectionName,user:user});
				reject(err);
			}
			//logger("info","successfully updated documents",{action:'update',arguments:args,target:collectionName,user:user});
			resolve(resultDoc);
		});
	});
	return promise;
};

//get the operaction
var op  =  process.argv[2];

if ( op == '-h' || op == 'help'){
	usage(op);
} else if ( ops.operation.indexOf(op) ==-1 || op === undefined){
	console.log("ERROR: invalid operation provided: " + op);
	usage()
}


var collection = process.argv[3];
if (collection == '-h' || collection == 'help'){
	usage(op,collection);
} else if (ops[op].options.indexOf(collection) === -1 || collection === undefined){
	console.log('ERROR: invalid collection provided: ' + collection);
	usage(op);
}


var args = {};
for (var i = 0; i < ops[op][collection].args.length; i++ ){
	if (process.argv[i+4] == '-h' || process.argv[i+4] == 'help'){
		usage(op,collection)
	}
	else if (process.argv[i + 4] == undefined){
		console.log("ERROR: missing parameter")
		usage(op,collection)
	}
	args[ops[op][collection].args[i]] = process.argv[i + 4];
}


connect().then(function(){

	if (op == 'import'){
		var docs;
		if (args.file.search(/.json%/) ==-1) {
			console.log('ERROR: File must be in the json format');
			usage(op,collection);
		}

		fs.statAsync(args.file).catch(function(){
			console.log('ERROR: File not found. Could not find ' + args.file)
			usage(op,collection);
		}).then(function(){
			docs = require(path.resolve(args.file));
		}).catch(function(err){
			console.log('ERROR: ' + err.message);
			usage(op,collection);
		});






	} else if (op == 'export'){

	}

}).then(function(){
	db.close();
});
