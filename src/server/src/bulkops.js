
/* Bulk Operations for the database
 * Perform bulk import and export operations on the database
 * allowing the user to input or export files in the JSON
 * form. The bulk operations take a single positional argument flaging either
 * import or export, followed by the specofoc functions for that seuqence */

var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var path = require('path');
var assert= require("assert");
var constants = require('./lib/conf/constants.json');
var dbFunctions = require("./models/mongodb_functions");
var utils = require('./lib/utils');
var getRS = require("./lib/getDbSnp");


/* ops object with the command line options, arguments and helptexts at each level. Additionally it containes information on
 * file and field validation for the import documents. 
 */
var ops = {
	operation : ['import','export'],
	helptxt : "Script to facilitate bulk operations for the PGX database",
	import : {
		helptxt : "Insert or update a large number of document at a single time from the specified json file, while ensuring databse validity",
		options : ['future','recommendation','haplotype','genes','custommarkers','dbsnp','patient'],
		usage : '\nbulkop.js import [collection]\n',
		future : {
			helptxt : "Insert or update future considerations. Takes a json array of unique documents and attempts to insert then or update the database if they can be updated.  Requires that the genes are already present in the database",
			args : ['file']
		},
		recommendation : {
			helptxt : "Insert or update drug recommendations in a gene wise manner. Takes a json array of unique documents. Requires that the genes are already present in the database",
			args : ['file']
		},
		haplotype : {
			helptxt : "Insert or update haplotypes in a gene wise manner, adding the markers to the database as well if they can. Reqires that the genes and custom markers are already present in the database",
			args : ['file']
		},
		genes : {
			helptxt : "Insert a new gene with a given type. Takes a json array of unique documents containing the gene name and the gene type. This function does not support updating",
			args : ['file']
		},
		custommarkers : {
			helptxt : "Insert or update a new custom marker. Takes a json array of unique documents containeing marker information.",
			args : ['file'] 
		},
		dbsnp : {
			helptxt : "Insert or update new dbsnp markers. Takes a json array of strings consisting of valid dbsnp markers",
			args : ['file']
		},
		patient : {
			helptxt : "Import a new patient VCF or PGX file from the command line. The patient name must be a unique entry. The user can optionally include a list of comma separated names, which must equal the total number of patients in the file",
			args : ['file','user'],
			opts : ['names'],
			possible : [['*']]	
		}

	},
	export : {
		options : ['future','recommendation','haplotype','genes','patients','markers','descriptors'],
		helptxt : "Export a large number of documents at a single time and save the output to a json file",
		usage:'\nbulkop.js export [collection] [file]',
		future : {
			helptxt:"Export all future considerations into a JSON array.\n\n\t-tsv\toutput in tsv format\n",
			args : ['outfile']
		},
		recommendation :{
			helptxt:"Export all Recommendations into a JSON aray.\n\n\t-tsv\toutput in tsv format\n",
			args : ['outfile']
		},
		haplotype : {
			helptxt:"Export all haplotypes into a JSON array.\n\n\t-tsv\toutput in tsv format\n",
			args : ['outfile']
		},
		genes :{
			helptxt:"Export all genes into a json array, however only export the gene name and the gene type.\n\n\t-tsv\toutput in tsv format\n",
			args : ['outfile']
		},
		descriptors :{
			helptxt:"Export the gene types into a json array.\n\n\t-tsv\toutput in tsv format\n",
			args : ['outfile']
		},
		patients : {
			helptxt:"Export all patients into a json array. If a patient identifier is provided export the information contained in the vcf document.\n\n\t-tsv\toutput in tsv format\n",
			args : ['outfile'],
			opts : [constants.dbConstants.PATIENTS.ID_FIELD],
			possible: [['*']],
		},
		markers : {
			helptxt:"Export all markers into a json array. If the optional 'type' parameter is provided return only the dbsnp or the custommarkers.\n\n\t-tsv\toutput in tsv format\n",
			args : ['outfile'],
			opts : ['type'],
			possible : [['custom','dbsnp']]
		},

	},
	update : {
		options : ['future','recommendation','haplotype','custommarkers'],
		usage : '\nbulkop.js update [collection]\n',
		future : {
			args : ['file']
		},
		recommendation : {
			args : ['file']
		},
		haplotype : {
			args : ['file']
		},
		custommarkers : {
			args : ['file'] 
		},
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
			],
			useId:true
		},
		dbsnp : {//No fields, simply takes an array
			collection : constants.dbConstants.PGX.COORDS.COLLECTION,
			useId:true
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
			],
			useId:false

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
			],
			useId:false
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
			useId:false
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
			],
			useId:false
		},
		descriptors :{
			collection : constants.dbConstants.DRUGS.CLASSES.COLLECTION,
			useId:true
		},
		patients : {
			collection : constants.dbConstants.PATIENTS.COLLECTION,
			useId:false
		},
		patient : {
			collection : constants.dbConstants.PATIENTS.COLLECTION,
			useId:false
		},
		markers : {
			collection:constants.dbConstants.PGX.COORDS.COLLECTION,
			useId:true
		}

	}
};



/* search an array and return the index taht matches a regex */
var regIndex = function(array,reg){
	for (var i = 0; i < array.length; i++ ){
		if (array[i].search(reg) !== -1 ){
			return i;
		}
	}

	return -1
}


/* Print the usage at the current level that the user has provided 
 * and exit the script */
var usage = function(op,col){
	var i;
	var usgStsring = '\nbulkops.js';
	//Either no operation provieded or there is a help flag passed
	if (!op || op == '-h' || op == 'help'){
		usgStsring += ' [operation]\n\n';
		usgStsring += ops.helptxt;
		usgStsring += '\n';
		usgStsring += "Please select from the following list\n\n";
		for (i = 0; i < ops.operation.length; i++ ){
			usgStsring += '\t' + (i + 1) + '. ' + ops.operation[i] + '\n';
		}
		usgStsring += '\n\thelp\t-h\tprovide this list';
	//If no collection is provided or the positional argument is help, print the help text
	} else if (!col || col == '-h' || col == 'help') {
		usgStsring += ' ' + op + ' [collection]\n\n';
		usgStsring += ops[op].helptxt;
		usgStsring += '\n';
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
		if (ops[op][col].opts){
			for (i = 0; i < ops[op][col].opts.length; i++ ){
				usgStsring += ' [' + ops[op][col].opts[i] + ']';
			}
		}

		usgStsring += '\n\n'
		usgStsring += ops[op][col].helptxt;

		//Print the contents of the possible parameters
		if (ops[op][col].possible){
			for (i = 0; i < ops[op][col].opts.length; i++){
				usgStsring += '\n\tOptions for '  +ops[op][col].opts[i] + ':\n\n'
				for (var j = 0; j < ops[op][col].possible[i].length; j++ ){
					usgStsring += '\t' + (j + 1) + '. '
					if (ops[op][col].possible[i][j] == '*') usgStsring += 'Any valid string';
					else usgStsring += ops[op][col].possible[i][j] + '\n';
				}
			}
		}
		usgStsring += '\n\n\thelp\t-h\tprovide this list';

	}

	console.log(usgStsring+'\n');
	process.exit(0);
};



/* Recursively search through an array in order to determine if there are any conflicts,
 * fields parameter is an array that indicates whtat must be a unique combination for 
 * the current entry */
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

//parse the operation from the command line, if the -h flag is provided then print the usage and exit
if ( op == '-h' || op == 'help'){
	usage(op);
} else if ( ops.operation.indexOf(op) ==-1 || op === undefined){
	console.error("ERROR: invalid operation provided: " + op);
	usage();
}

//parse the collection from the command line
var collection = process.argv[3];
if (collection == '-h' || collection == 'help'){
	usage(op,collection);
} else if (ops[op].options.indexOf(collection) === -1 || collection === undefined){
	console.error('ERROR: invalid collection provided: ' + collection);
	usage(op);
}


//Parse all additional arguments from the commandline and set them to a args object
//If there is a -tsv detected signal that there should be a tsv file expected

var args = {};
if (process.argv.indexOf('-tsv') !== -1){
	args.tsv = true;
	process.argv.splice(process.argv.indexOf('-tsv'),1);
}
var count = 4;
for (var i = 0; i < ops[op][collection].args.length; i++ ){
	if (process.argv[i+4] == '-h' || process.argv[i+4] == 'help'){
		usage(op,collection);
	}
	else if (process.argv[i + 4] === undefined){
		console.error("ERROR: missing parameter");
		usage(op,collection);
	}
	args[ops[op][collection].args[i]] = process.argv[i + 4];

	count++;
}

//And parse optional arguments and ensure that the proper options are provided
if (ops[op][collection].opts){
	for (var i = 0; i < ops[op][collection].opts.length; i++ ){
		if (process.argv[i+count] == '-h' || process.argv[i+count] == 'help'){
			usage(op,collection);
		}
		else if ( process.argv[i + count] !== undefined && ops[op][collection].possible[i].indexOf(process.argv[i + count ]) == -1 && ops[op][collection].possible[i].indexOf('*') === -1){
			console.error("ERROR: Invalid option provided for optional parameter: " + ops[op][collection].opts[i]);
			usage(op,collection);
		}
		args[ops[op][collection].opts[i]] = process.argv[i + count];
	}	
}


/* Connect to the database */
dbFunctions.connectAndInitializeDB().then(function(){
	var colParams = ops.collections[collection];
	var descriptors;
	console.log("\nJOB: " + op.toUpperCase() )
	console.log("DATE: " + new Date().toDateString());

	/* the operation defined by the user was import */
	if (op == 'import'){
		var docs;
		var updated = 0;
		var added = 0;
		var skipped = 0;

		//ensure the appropriate file type
		if (args.tsv) console.log("MESSAGE: Unused parameter -tsv found, however the import method only takes json files");
		if (collection !== 'patient' && args.file.search(/.json$/) ==-1) {
			console.error('ERROR: File must be in the json format');
			usage(op,collection);
		} else if (collection == 'patient' &&  args.file.search(/(.vcf$|.tsv$)/) == -1){
			console.error("ERROR: File must be in .vcf or .tsv format.");
			usage(op,collection);
		}	


		/* if the collection defined is 'patient' the user will be directly uplaoding a .tsv or a .vcf file
		 * and adding a new patient to the server. The User patienst must be unique name s or the user must 
		 * provide unoique names for the user */
		if (collection == 'patient'){
			//Load the parser
			var parser = require('./lib/parseVCF');

			//set the extension 
			var ext;
			if (args.file.search(/.tsv$/) !== -1 ) ext = 'tsv';
			else if (args.file.search(/.vcf/) !== -1 ) ext = 'vcf';

			return Promise.resolve().then(function(){
				return fs.statAsync(path.resolve(args.file))
				.catch(function(){
					console.error('ERROR: File not found. Could not find ' + args.file);
					usage(op,collection);
				});
			}).then(function(){
				//Ensure the user provided exists in the db
				return dbFunctions.findUserById(args.user).then(function(result){
					assert(result !== null, "user could not be found. Please provide a valid user to associate the patients with.");
				});
			}).then(function(){
				//Preliminary Validation of inserted document
				return fs.readFileAsync(path.resolve(args.file),'utf8').then(function(file){
					var lines = file.split('\n');
					var found = false;
					var names;
					var i = 1;

					//Check to ensure the first line indicates a proper version of either a vcf or a tsv
					assert(lines[0].search(/^##fileformat=(VCF|PGX)v[0-9].[0-9]$/) !== -1, "invalid fileformat at line 1 of file: " + args.file + ". fileformat must be a PGX or VCF file format.");

					while (!found){
						//try to find the header lines
						if (lines[i].search(/^#[a-z]/i) !== -1 ){
							var line = lines[i].split('\t')
							//Try to find the names
							names  = line.splice(regIndex(line,/format/i) + 1 );
							assert(names.length > 0, "the file is not formatted properly and does not contain any patient information" );
							//If the user provided names for the patients in the file, then ensure those names equal the number of patients in the file
							if (args.names){
								args.names = args.names.split(',');
								assert(args.names.length == names.length, 'the number of names provided by the user does not equal the number of names in the provided file.' );
							} else {
								//if there are no patient names provided set the args.names to the names found in the file.
								args.names = names;
							}
							console.log("MESSAGE: " + args.names.length + " patients found in file " + args.file)
							found = true;
						}
						i++
					}
				});
			}).then(function(){
				//the names found in the file there have been validated.
				//Ensure that the patient_ids provided by the user or found in the file are unique.
				args.patientfields = [];
				return Promise.resolve(args.names).each(function(name){
					var query = {};
					query[constants.dbConstants.PATIENTS.ID_FIELD] = name;
					return dbFunctions.findOne(colParams.collection,query).then(function(result){
						assert (result == null , "A patient with the id " + name + " already exists. Please update the patient name appropriately");
						var temp = {};
						temp[constants.dbConstants.PATIENTS.ID_FIELD] = name;
						temp[constants.dbConstants.PATIENTS.FILE_FIELD] = path.resolve(args.file);
						temp[constants.dbConstants.PATIENTS.DATE_ADDED] = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
						temp[constants.dbConstants.PATIENTS.READY_FOR_USE] = false;
						temp[constants.dbConstants.PATIENTS.ANNO_COMPLETE] = undefined;
						temp[constants.dbConstants.DB.OWNER_ID] = args.user
						return dbFunctions.addPatient(temp,args.user).then(function(newpatient){
							temp[constants.dbConstants.PATIENTS.COLLECTION_ID] = newpatient.newCollection;
							args.patientfields.push(temp);
						});
					});
				});
			}).then(function(){
				//Parse the new files and insert them into the patient databsa
				console.log("MESSAGE: adding all patients to the databse");
				return parser(path.resolve(args.file),args.patientfields,args.user);
			}).then(function(){
				added++;
			})

		//The collection is not a patient collection and we will be uploading or updating the entries in the database
		} else {

			return Promise.resolve().then(function(){
				return fs.statAsync(path.resolve(args.file))
				.catch(function(){
					console.error('ERROR: File not found. Could not find ' + args.file);
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
				console.log("FILE: " + args.file);
				console.log("DOCUMENTS TO INSERT OR UPDATE: " + docs.length + '\n');
				 //Check to ensure the document is in the right format by going over each file
				for (var i = 0; i < docs.length; i++ ){
					if (collection !== 'dbsnp'){
						assert(Object.prototype.toString.call(docs[i]) == '[object Object]', "Documents to be inserted must be an object.");
					 	objects = Object.keys(docs[i]);

					 	//CHeck to ensure all the required parameters are present
					 	for (var j = 0; j < colParams.fields.length; j++ ){
					 		assert(objects.indexOf(colParams.fields[j].field) !== -1,'Missing required parameter: ' + colParams.fields[j].field + ', in json file at document ' + (i + 1) +". Please review the documentation on file format.");
					 		assert(Object.prototype.toString.call(docs[i][colParams.fields[j].field]) == colParams.fields[j].type, "Invalid data type for " + colParams.fields[j].field + " at document " + (i + 1)+ ". Expecting " + colParams.fields[j].type + " but found " + Object.prototype.toString.call(docs[i][colParams.fields[j].field]) +". Please review the documentation on file format.");
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
					var update = false;
					var searchId = false;


					var query = {};
					if (collection !== 'dbsnp'){
						if (colParams.useId){
							query._id = doc._id;	
						} else {
							if (doc._id) searchId = true;
							for (var j = 0; j < colParams.fields.length; j++ ){
								if (colParams.fields[j].query)
									query[colParams.fields[j].field] = doc[colParams.fields[j].field];
							}
						}
					} else {
						query._id = doc;
					}
					//Check to see if an entry already exists
					return dbFunctions.findOne(colParams.collection,query).then(function(result){
						if (collection == 'dbsnp'){
							if (result) include = false;
						}
						
						else {
							//If there is nothing found and there is an _id field present try searching with the id field
							if(!result && searchId && ops.update.options.indexOf(collection) !== -1){
								return dbFunctions.findOne(colParams.collection,{_id:ObjectId(doc._id)}).then(function(result){
									//found something an will attempt to update it
									if (result)
										update = true;
									//else it will attempt to insert the document
								})
							//Something was found
							} else if (result && ops.update.options.indexOf(collection) !== -1) {
								if (searchId){
									if (result._id != doc._id) {
										console.log("WARNING: Document found with matching paramenters to document " + (index + 1) + ", however _id field does not match. Ignoring input _id and updating database");
										delete doc._id;
										searchId = false;
									}

									//else the ids match

								}

								update = true;

							} else if (result){
								throw new Error("Existing entry already found at document " + (index + 1) + ", and current entry type does not support updating.")
							}
						}
					}).then(function(){
						/* We will not make any assumptions about there being a gene container for each entry, if the gene container
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
						if (update){
							var query = {};

							if (doc._id){
								if (!colParams.useId) doc._id = ObjectId(doc._id);
								query._id = doc._id;
								delete doc._id;
							} else {
								for (var j = 0; j < colParams.fields.length; j++ ){
									if (colParams.fields[j].query)
										query[colParams.fields[j].field] = doc[colParams.fields[j].field];
								}
							}

							return dbFunctions.update(colParams.collection,query,{$set:doc}).then(function(){
								updated++
							})
						} else {

							if (collection !== 'genes' && collection !== 'dbsnp'){
								return dbFunctions.insert(colParams.collection,doc).then(function(idoc){
									added++;
									if (collection !== 'custommarkers'){
										var update = {$push:{},$set{}}
										update.$push[colParams.dosing_field] = idoc._id;
										var from = collection == 'custommarkers' || collection == 'haplotype' ? 'useHaplotype' : 'useDosing';
										update.$set[from] = true;

										
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
											skipped++
											console.log("WARNING: could not retrieve information for " + doc + " from dbSnp.")
											warnings = true;
											return
										} else {
											added++
											return dbFunctions.insert(colParams.collection,result.dbSnp[0])
										}
									});
								} else {
									console.log("WARNING: dbsnp marker already detected, attempting to update marker");
									return dbFunctions.updatedbSnpPGXCoords(doc).then(function(result){
										assert(result.missing.length == 0, "marker " + doc + " could not be found in dbsnp and may no longer be supported. please remove from databsae and check dbsnp");
										if (result.changed.length > 0 ){
											updated++
											console.log("WANRING: " + doc + " was out of date and has been updated");
											warnings = true;
										} else if (result.notchanged.length > 0 ) {
											console.log("WANRING: " + doc + " is already up to date. No changes were made");
											warnings = true;
										}
									});
								}
							}
						}

					});
				});
			}).then(function(){
				console.log("\nSTATUS: ADDED " + added + " NEW DOCUMENTS");
				console.log("STATUS: UPDATED " + updated + " DOCUMENTS");
				console.log("STATUS: SKIPPED " + skipped + " DOCUMNETS");
			});
		}
	} else if (op == 'export'){
		if (!args.tsv && args.outfile.search(/.json$/) ==-1) {
			console.log('WANRING: Output file must be in json format. Outfile will have ".json" added');
			args.outfile += '.json';
		} else if(args.tsv && args.outfile.search(/.tsv$/) == -1){
			console.log("WARNING: -tsv flag given but specified outfile does not have a tsv extension. Outfile will have a'.tsv' added")
			args.outfile += ".tsv";
		}

		var fileExists;
		//Ensure that the file that is being created does not already exist
		return Promise.resolve().then(function(){
			return fs.statAsync(path.resolve(args.outfile)).then(function(){
				fileExists = true;
			}).catch(function(err){
				//the file does not exist
				fileExists = false;
			});
		}).then(function(){
			if (fileExists){
				console.error("ERROR: Output file already exsits. Will not overwrite")
				usage(op,collection);
			}
			//File does not exists an contiue
			var query = {};	
			var opParams = ops[op][collection].opts;
			var options = {};

			if (opParams){
				for (var i = 0; i < opParams.length; i++ ){
					if (args[opParams[i]]){
						query[opParams[i]] = args[opParams[i]];	
					}
				}
			}

			if (collection == 'genes'){
				options['gene'] = 1;
				options['type'] = 1;
				options._id = 0;
			}
			return dbFunctions.find(colParams.collection,query,options)
		}).then(function(result){

			if ( collection == 'patients' && args.patient_id){
				//The user wants information on a specific patien.
				var colId = result[0][constants.dbConstants.PATIENTS.COLLECTION_ID];
				return dbFunctions.find(colId,{},{_id:0}).then(function(result){
					return result;
				});
			}
			return result;
		}).then(function(result){
			if (result.length == 0){
				console.log("WARNING: NO DOCUMENTS WERE FOUND");
			} else {
				//Save the output in tsv format;
				if (args.tsv) {
					var outstring = "";
					var header = false;
					var keys;
					for (var i = 0; i < result.length; i++ ){
						if (!header){
							keys = Object.keys(result[i]);
							for (var key = 0; key < keys.length -1; key++ ){
								outstring+= keys[key] + '\t'
							}
							outstring += keys[key] + '\n'
							header = true;
						}
						for (var key = 0; key < keys.length-1; key++ ){
							outstring+= result[i][keys[key]].toString() + '\t';
						}
						outstring += result[i][keys[key]].toString() + '\n'
					}

					return fs.writeFileAsync(args.outfile, outstring);
				} else {	
					return fs.writeFileAsync(args.outfile,JSON.stringify(result,0,4))
				}
			}
		});
	}

}).then(function(){
	if (warnings) console.log("STATUS: completed all tasks with warnings. Exiting\n")
	else console.log("STATUS: completed all tasks. Exiting\n")
	dbFunctions.closeConnection(process.exit);
}).catch(function(err){
	console.error('\nERROR: ' + err.message);
	//console.log(err.stack);
	dbFunctions.closeConnection();
	usage(op,collection);
});

