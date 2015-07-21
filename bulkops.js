
/* Bulk Operations for the database
 * Perform bulk import and export operations on the database
 * allowing the user to input or export files in the JSON
 * form. The bulk operations take a single positional argument flaging either
 * import or export, followed by the specofoc functions for that seuqence */

var MongoClient = require('mongodb').MongoClient;
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
var assert= require("assert");
var constants = require('./src/server/conf/constants.json');
var dbFunctions = require("./build/models/mongodb_functions");
var utils = require('./build/lib/utils');
var getRS = require("./build/lib/getDbSnp");
//var constants = require('./lib/conf/constants.json');

var ops = {
	operation : ['import','export','update'],
	import : {
		options : ['future','recommendation','haplotype','genes','custommarkers','dbsnp'],
		usage : '\nbulkop.js import [collection]\n',
		future : {
			args : ['file']
		},
		recommendation : {
			args : ['file']
		},
		haplotype : {
			args : ['file']
		},
		genes : {
			args : ['file']
		},
		custommarkers : {
			args : ['file'] 
		},
		dbsnp : {
			args : ['file']
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
	update : {
		options : ['future','recommendation','haplotype'],
		usage : '\nbulkop.js update [collection]\n',
		future : {
			args : ['file']
		},
		recommendation : {
			args : ['file']
		},
		haplotype : {
			args : ['file']
		}
	},
	collections : {
		custommarkers : {
			collection : constants.dbConstants.PGX.COORDS.COLLECTION,
			fields : [
				{
					field:'_id',
					type:'[object String]',
					query : true
				},
				{
					field:'chr',
					type:'[object String]'
				},
				{
					field:'asgenes',
					type:'[object Array]'
				},
				{
					field:'ref',
					type:'[object String]'
				},
				{
					field:'alt',
					type:'[object Array]'
				}
			]
		},
		dbsnp : {//No fields, simply takes an array
			collection : constants.dbConstants.PGX.COORDS.COLLECTION
		},
		future : {
			collection : constants.dbConstants.DRUGS.FUTURE.COLLECTION,
			dosing_field:constants.dbConstants.DRUGS.ALL.FUTURE,
			fields : [
				{
					field:'class',
					type:'[object String]',
					query : true
				},
				{
					field:'gene',
					type:'[object String]',
					query : true
				},
				{
					field:'rec',
					type : '[object String]'
				}
			]

		},
		recommendation : {
			collection : constants.dbConstants.DRUGS.DOSING.COLLECTION,
			dosing_field:constants.dbConstants.DRUGS.ALL.RECOMMENDATIONS,
			fields : [
				{
					field:'classes',
					type: '[object Array]',
					query : true
				},
				{
					field:'drug',
					type:'[object String]',
					query  : true
				},
				{
					field:'genes',
					type : '[object Array]',
					query : true
				},
				{
					field :'pubmed',
					type : '[object Array]'
				},
				{
					field : 'rec',
					type : '[object String]'
				}
			]
		},
		haplotype : {
			collection : constants.dbConstants.PGX.GENES.COLLECTION,
			marker_collection : constants.dbConstants.PGX.COORDS.COLLECTION,
			dosing_field:constants.dbConstants.DRUGS.ALL.CURRENT_HAPLO,
			fields : [
				{
					field : 'gene',
					type : '[object String]',
					query : true
				},
				{
					field : 'haplotype',
					type : '[object String]',
					query : true
				},
				{
					field : 'markers',
					type : '[object Array]'
				}
			],
		},
		genes :{
			collection : constants.dbConstants.DRUGS.ALL.COLLECTION,
			fields : [
				{
					field :'gene',
					type : '[object String]',
					query : true
				},
				{
					field : 'type',
					type : '[object String]'
				}
			]
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

	}
};


var usage = function(op,col){
	var i;
	var usgStsring = '\nbulkop.js';
	if (!op || op == '-h' || op == 'help'){
		usgStsring += ' [operation]\n\n';
		usgStsring += "Please select from the following list\n\n";
		for (i = 0; i < ops.operation.length; i++ ){
			usgStsring += '\t' + (i + 1) + '. ' + ops.operation[i] + '\n';
		}
		usgStsring += '\n\thelp\t-h\tprovide this list';
	} else if (!col || col == '-h' || col == 'help') {
		usgStsring += ' ' + op + ' [collection]\n\n';
		usgStsring += "Please select from the following list\n\n";
		for (i = 0; i < ops[op].options.length; i++ ){
			usgStsring += '\t' + (i + 1) + '. ' + ops[op].options[i] + '\n';
		}
		usgStsring += '\n\thelp\t-h\tprovide this list';
	} else {
		usgStsring += ' ' + op  + ' ' + col;
		for (i = 0; i < ops[op][col].args.length; i++ ){
			usgStsring += ' [' + ops[op][col].args[i] + ']';
		}
		usgStsring += '\n\n\thelp\t-h\tprovide this list';

	}

	console.log(usgStsring);
	process.exit(0);
};


var searchForConflicts = function(fields,arr){
	var truthSum = 0;
	var i;
	if (arr.length < 2 ){
		return true;
	}
	if ( arr.length == 2){
		for (i = 0; i < fields.length; i++){
			if (arr[0][fields[i]].toString() == arr[1][fields[i]].toString()) truthSum++;
		}
		if (truthSum == fields.length) return false;
		return true;
	} else {
		var unique = searchForConflicts(fields,arr.slice(1));
		var item = arr[0];
		if (!unique) return false;
		for (i = 1; i < arr.length; i++ ){
			truthSum = 0;
			for (var j = 0; j < fields.length; j++ ){
				if (item[fields[j]].toString() == arr[i][fields[j]].toString()) truthSum++;

			}
			if (truthSum == fields.length) return false;
		}
		return true;
	}
};

//get the operaction
var op  =  process.argv[2];
var warnings = false;

if ( op == '-h' || op == 'help'){
	usage(op);
} else if ( ops.operation.indexOf(op) ==-1 || op === undefined){
	console.log("ERROR: invalid operation provided: " + op);
	usage();
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
		usage(op,collection);
	}
	else if (process.argv[i + 4] === undefined){
		console.log("ERROR: missing parameter");
		usage(op,collection);
	}
	args[ops[op][collection].args[i]] = process.argv[i + 4];
}


dbFunctions.connectAndInitializeDB().then(function(){
	var colParams = ops.collections[collection];
	var descriptors;
	if (op == 'import'){
		var docs;

		if (args.file.search(/.json$/) ==-1) {
			console.log('ERROR: File must be in the json format');
			usage(op,collection);
		}
		return Promise.resolve().then(function(){
			return fs.statAsync(path.resolve(args.file))
			.catch(function(){
				console.log('ERROR: File not found. Could not find ' + args.file);
				usage(op,collection);
			});
		}).then(function(){
			var objects;
			var sortedout;
			docs = require(path.resolve(args.file));
			/* Peform validation of the docs that are to be inserted into the new
			 * database */

			 //Check to ensure the document is an array;
			 assert(Object.prototype.toString.call(docs) == '[object Array]','The documents to be inserted must be in an array');
			 assert(docs.length > 0, args.file + " is an empty document.");

			 //Check to ensure the document is in the right format by going over each file
			for (var i = 0; i < docs.length; i++ ){
				if (collection !== 'dbsnp'){
					assert(Object.prototype.toString.call(docs[i]) == '[object Object]', "Documents to be inserted must be an object.");
				 	objects = Object.keys(docs[i]);

				 	//CHeck to ensure all the requqired parameters are present
				 	for (var j = 0; j < colParams.fields.length; j++ ){
				 		assert(objects.indexOf(colParams.fields[j].field) !== -1,'Missing required parameter: ' + colParams.fields[j].field + ' in json file at document ' + (i + 1));
				 		assert(Object.prototype.toString.call(docs[i][colParams.fields[j].field]) == colParams.fields[j].type, "Invalid data type for " + colParams.fields[j].field + " at document " + (i + 1)+ ". Expecting " + colParams.fields[j].type + " but found " + Object.prototype.toString.call(docs[i][colParams.fields[j].field]));
				 		objects.splice(objects.indexOf(colParams.fields[j].field),1);
				 		if (collection == 'recommendation') assert(docs[i].classes.length == docs[i].genes.length, "Genes and Predictor of effects are different lengths at document " + (i + 1) + ". Must be of equal length");	
				 	}
				} else {
					assert(Object.prototype.toString.call(docs[i]) == '[object String]');
					assert(docs[i].search(/^rs[0-9]+/) !== -1,"Invalid dbSNP marker name at line " + i);
				}
			 	//ALlow extra fields to be passed
			 	//assert(objects.length === 0, "Malformed entry at document " + (i + 1)+", additional fields found. " + colParams.fields.length + " fields expeceted, but found " + Object.keys(docs[i]).length + " extra fields.");

			 	// Passed all validation;

			 	if (collection == 'haplotype'){
			 		docs[i].markers = docs[i].markers.sort();
			 	} else if (collection == 'recommendation'){
			 		sortedout = utils.sortWithIndeces(docs[i].genes,docs[i].classes);
			 		docs[i].genes = sortedout.first;
			 		docs[i].classes = sortedout.second;
			 	} else if (collection == 'custommarkers'){
			 		docs[i].alt = docs[i].alt.sort();
			 		docs[i].type = 'custom';
			 		docs[i].date = new Date().toDateString();
			 	}
			
			}
		}).then(function(){
			//Get the gene decscriptors for the therapeutic effects;
			descriptors = {};
			return dbFunctions.find(constants.dbConstants.DRUGS.CLASSES.COLLECTION,{}).then(function(result){
				for (var i = 0; i < result.length; i++){
					descriptors[result[i]._id] = result[i].classes;
				}
			});
		}).then(function(){
			//Check to ensure it is not already in the database, if it is, exit with an error
			if (collection !== 'dbsnp'){
				var queryFields = [];
				for (var j = 0; j < colParams.fields.length; j++ ){
					if (colParams.fields[j].query)
						queryFields.push(colParams.fields[j].field);
				}
				//Ensure that the documents submitted are unique amongst themselves
				assert(searchForConflicts(queryFields,docs),'Conflicts were found in the submitted docs, please ensure each entry is a unique entry and then continue.');
				if (collection == 'haplotype') assert(searchForConflicts(['gene','markers'],docs),"Conflicts found in the markers, a unique marker combination is required for each haplotype per gene.");
			}

			/* loop over each document, and then make sure that tthey are not already in the database */
			return Promise.resolve(docs).each(function(doc,index){
				//Make sure if this is a recommendation then the f {};ields are eua
				var include = true;


				var query = {};
				if (collection !== 'dbsnp'){
					for (var j = 0; j < colParams.fields.length; j++ ){
						if (colParams.fields[j].query)
							query[colParams.fields[j].field] = doc[colParams.fields[j].field];
					}
				} else {
					query._id = doc;
				}
				//Check to see if an entry already exists
				return dbFunctions.findOne(colParams.collection,query).then(function(result){
					if (collection == 'dbsnp'){
						if (result) include = false;
					} else {
						assert(result == null && result == undefined, "An entry already exists in the databse for document " + (index + 1) + ".");
					}

				}).then(function(){
					/* We will not make any assumptions about there being a gene container for each entyr, if the gene container
					 * does not exists, throw an error informing the user to create a new container */
					 if (collection !== 'genes' && collection !== 'custommarkers' && collection !== 'dbsnp'){
						var query = {};
						var genes;
						if (collection != 'recommendation')	genes = [doc.gene];
						else genes = doc.genes;
						query[constants.dbConstants.DRUGS.ALL.ID_FIELD] = {$in:genes};
						return dbFunctions.find(constants.dbConstants.DRUGS.ALL.COLLECTION,query).then(function(result){
							//if the gene is missing, simple raise an error and exit instead of making any spculation about what
							//Type the gene is. This information can bee added separately
							assert(result.length > 0, "Missing all genes at doc " + (index + 1)+ " and there is no 'type' set. Please add genes separately and then continue.")


							var resGenes = result.map(function(item){
								return item[constants.dbConstants.DRUGS.ALL.ID_FIELD];
							});
							var types = result.map(function(item){
								return item[constants.dbConstants.DRUGS.ALL.TYPE];
							})
							var resClasses = collection == 'recommendation' ? doc.classes : [doc.class];
							for (var i = 0; i < genes.length; i++ ){
								assert(resGenes.indexOf(genes[i]) !== -1,"Gene: " + genes[i] + " missing, and there is no 'type' set. Please add genes separately")
							}

							if (collection !== 'haplotype'){
								for (i = 0; i < types.length; i++ ){
									assert(descriptors[types[i]].indexOf(resClasses[i]) !== -1, "An invalid Predictor of effect was found at document number " + (index + 1 ) + ". Please reveiw the document and ensure the predictor of effect is one of: " + descriptors[types[i]].join(', ') + '.');
								}
							}	
						});
					
					}

				}).then(function(){
					/* Special checks for haplotypes to ensure all the markers are present, if not, retrieve the markers for the
					 * databse, insert them and then continue */
					if (collection == 'haplotype'){
						return Promise.resolve(doc.markers).each(function(marker,index){
							return dbFunctions.findOne(colParams.marker_collection,{_id:marker}).then(function(found){
								if (!found) { //not found, therefore add the marker		
									if (marker.search(/^rs[0-9]+/) !== -1){
										return getRS(marker).then(function(result){
											assert(result.dbSnp.length !== 0,"Could not retrieve information for new marker " + marker + " from dbSnp, please manually put marker into the databse before proceeding");
											return dbFunctions.insert(colParams.marker_collection,result.dbSnp[0]);
										});
									} else {
										assert(false, marker + " is a custom marker that is not found in the database. Please add the marker and then continue");
									}

								}
							});
						});
					}
				}).then(function(){
					/* Everything is good, add the document and then update the gene document with the information */
					if (collection !== 'genes' && collection !== 'dbsnp'){
						return dbFunctions.insert(colParams.collection,doc).then(function(idoc){
							if (collection !== 'custommarkers'){
								var update = {$push:{}}
								update.$push[colParams.dosing_field] = idoc._id;
								
								var genes = collection == 'recommendation' ? idoc.genes : [idoc.gene];
								return Promise.resolve(genes).each(function(gene){
									var query = {};
									query[constants.dbConstants.DRUGS.ALL.ID_FIELD] = gene;
									return dbFunctions.update(constants.dbConstants.DRUGS.ALL.COLLECTION,query,update).then(function(){
										if (collection == 'haplotype'){
											return dbFunctions.addMarkerToGene(idoc.markers,idoc.gene);
										}
									});
								});
							}
						});
					} else if (collection == 'genes'){
						assert(descriptors[doc.type] !== undefined, "Invalid Gene Type for doc " + (index + 1));
						return dbFunctions.drugs.createNewDoc(doc.gene,doc.type);
					} else if (collection == 'dbsnp'){
						if (include){
							return getRS(doc).then(function(result){
								if (result.missing.length > 0 ){
									console.log("WARNING: could not retrieve information for " + doc + " from dbSnp.")
									warnings = true;
									return
								} else {
									return dbFunctions.insert(colParams.collection,result.dbSnp[0])
								}
							});
						} else {
							console.log("WARNING: dbsnp marker already detected, attempting to update marker");
							return dbFunctions.updatedbSnpPGXCoords(doc).then(function(result){
								assert(result.missing.length == 0, "marker " + doc + " could not be found in dbsnp and may no longer be supported. please remove from databsae and check dbsnp");
								if (result.changed.length > 0 ){
									console.log("WANRING: " + doc + " was out of date and has been updated");
									warnings = true;
								} else if (result.notchanged.length > 0 ) {
									console.log("WANRING: " + doc + " is already up to date. No changes were made");
									warnings = true;
								}
							});
						}
					}

				})
			})
		})
	} else if (op == 'export'){

	}

}).then(function(){
	if (warnings) console.log("\nSTATUS: completed all tasks with warnings. Exiting")
	else console.log("STATUS: completed all tasks. Exiting")
	dbFunctions.closeConnection(process.exit);
}).catch(function(err){
	console.log('\nERROR: ' + err.message);
	console.log(err.stack);
	dbFunctions.closeConnection();
	usage(op,collection);
});

