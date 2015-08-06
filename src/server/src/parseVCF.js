/* ParseVCF.js
 * In order to complete the file upload into the database, the output from 
 * Annovar must be parsed. To ensure the fastest possible parsing and more
 * Memory efficient method, this module was written.
 *
 * THe parseVCF object taktes two parameters when initiated: file and patients.
 * with severa; optional parameteres following. Some vcf files can be extemeely
 * large, therefore to facilitate file reading in an async manner, the parser
 * splits the file into chunks inserts them into a buffer, and then maps the 
 * parsed output to the header fields. Additionally, If multiple patients are 
 * provided, the parser automatically bulds the documents for each patient.
 * When the number of documents for each patient reaches just under 1000 (The current max)
 * of insertMany, the parser will attempt to insert the documents into the database.
 * It then clears the current document string to save memory
 * 
 * when the file reading is completed, all remaining documents are inserted and the file is
 * closed.
 * 
 *
 * @author Patrick Magee
*/
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var dbFunctions = require('../models/mongodb_functions');
var logger =  require('./logger');
var path = require('path');
var dbConstants = require('./conf/constants.json').dbConstants;




var params = {
	PGX : {
		headers : [
			'id',
			'ref',
			'alt',
		],
		mask : []
	},
	VCF : {
		headers : [
			'chrom',
			'pos',
			'id',
			'ref',
			'alt',
		],
		mask : [
			'qual',
			'filter',
			'info'
		],
	}
}


var ops = {
	user : undefined,
	file: undefined,
	patients : undefined,
	bufferSize : 10000000,
	bufferArray : [],
	oldString : "",
	mapper : {'static':{}},
	docMax : 5000,
	patientObj : {},
	stream : undefined,
	reading : false,
	numHeader : 0
}


/* Each patient is given a separate colleciton to store the genetic information in. Each collection
 * was already given a name when the patients were first inserted. This function will create the collection
 * for each patient, returning a promise when this has been accomplished/
 */
var setupCollections = function(){
	return Promise.resolve(ops.patients).each(function(patient){
		var logOpts = {user:+ops.user,target:patient[dbConstants.PATIENTS.ID_FIELD],action:'createCollection'};
		logger('info','creating patient collection',logOpts);
		var collectionName = patient[dbConstants.PATIENTS.COLLECTION_ID];
		return dbFunctions.createCollection(collectionName,ops.user);
	});
}
//==============================================================================================================
/* Create a read stream to read data from, and add event handlers to 
 * specific events. The read stream will pass chunks of a specific size
 * to the data field and drain the buffer. When incoming data is receieved
 * the stream is paused, and the chunk is added to an array. This is done 
 * because despite the stream being paused data could potentially be in the
 * process of being added. The bufferArray is then parsed and emptied using
 * the readAndParse function.
 * finally when the end of the file has been reached the remaining files are
 * inserted into the document
 */
var read = function(){
	var stream;
	logger("info","reading file",{user:ops.user,target:ops.file,action:'parseVCF'});
	var promise = new Promise(function(resolve,reject){
		stream = fs.createReadStream(ops.file,{'bufferSize':ops.bufferSize});
		//When data is received, stop the stream until the data is read and parsed
		stream.on('data',function(data){
			stream.pause();
			ops.bufferArray.push(data);
			if (!ops.reading){
				ops.reading = true;
				return readAndParse()
				.then(function(){
					stream.resume();
					ops.reading = false;
				}).catch(function(err){
					stream.destroy();
					reject(err);
				});
			}
		});

		stream.on('end',function(){
			var promise;
			//if there is any remaining itms in the string. add them
			if (ops.oldString !== ""){
				promise = parseChunk([ops.oldString])
				.then(function(){
					return Object.keys(ops.patientObj);
				});
			} else {
				promise = Promise.resolve(Object.keys(ops.patientObj));
			}

			return promise.each(function(patient){
				return checkAndInsertDoc(patient);
			}).then(function(){
				logger("info","file read successful, documents inserted into database",{user:ops.user,target:ops.file,action:'parseVCF'});
				var igArray = [];
				for (var patient in ops.patientObj){
					if (ops.patientObj.hasOwnProperty(patient)){
						igArray.push(ops.patientObj[patient].ignored + ops.numHeader);
					}
				}
			}).then(function(){
				logger('info','all jobs complete',{user:ops.user,target:ops.file,action:'parseVCF'});
				resolve('done');
			}).catch(function(err){
				reject(err);
			});
		})

		stream.on('error',function(err){
			logger('error',err,{user:ops.user,target:ops.file,action:'parseVCF'})
			stream.destroy();
			reject(err);
		});
	});
	return promise;
};
//==============================================================================================================
/* ONce the file has been open for reading, a new buffer is initialized and 
 * passed to the fs.readAsync function. It then converts the string back to utf-8 
 * encoding, checks to see if the string is a continuation of the old string, and 
 * then splits it into an array based on the new line character.
 * it then makes a call to the main parser function and upon reaching a specified number
 * of documents for each patients, inserts them into the connected database
 * 
 * returns a promise
 */
var readAndParse = function(chunk){	
	var promise = new Promise(function(resolve,reject){
		var chunk = ops.bufferArray[0];
		ops.bufferArray.shift();
		Promise.resolve().then(function(){
			return chunk.toString('utf-8');
		}).then(function(string){
			if (ops.oldString !== ""){
				string = ops.oldString + string;
			}
			splitString = string.split('\n');
			if (string.substr(string.length - 1) == "\n"){
				ops.oldString = "";
			}  else {
				ops.oldString = splitString.pop();
			}
			return splitString;
		}).then(function(stringArray){
			if (stringArray.length > 0 ){
				return parseChunk(stringArray).map(function(patient){
					if (ops.patientObj[patient].documents.length >= ops.docMax)
						return checkAndInsertDoc(patient);
				}).catch(function(err){
					reject(err);
				});
			}
		}).then(function(){
			if (ops.bufferArray.length > 0){
				return readAndParse();
			}
		}).then(function(){
			resolve('read chunk');
		});
	});
	return promise;
};

//==============================================================================================================
/* Annovar multi-anno parser. Takes an array as input that contains lines separated by the
 * new line character. It then breaks the line into its an array by splitting on tabbed or
 * white space. It uses a mapper to link the headers with specific rows, as well as the mapped
 * patients indexes. It then outputs an object that it pushes to each patient in the 
 * this.patientObj.documents array.
 *
 * return a promise, and an array of patient keys
 */
var parseChunk = function(stringArray){
	var line;
	var promise = new Promise(function(resolve,reject){
		//iterate over all strings that are include;
		for (var i=0; i < stringArray.length ; i++ ){

			//Check to make sure the first entry equates to a vcf format
			if (stringArray[i] !== "" ){
				if (!ops.format){
					ops.numHeader++;
					if (stringArray[i].search(/##fileformat=PGX/) !== -1 ){
						ops.format = 'PGX';
					} else if (stringArray[i].search(/##fileformat=VCF/) !== -1 ){
						ops.format = 'VCF';
					}
					if (!ops.format) {
						throw new Error("Invalid file format. File must be of VCF or TSV format")
						reject("Invalid file format. File must be of VCF or TSV format");
					}
				} else if (stringArray[i].search(/##INFO/i) !== -1 ) {
					ops.numHeader++;
				} else if (stringArray[i].search(/^#[a-z]/i)!== -1){
					ops.numHeader++;
					var formatReached = false;
					var staticLine = stringArray[i].toLowerCase().split('\t');
					for (var j = 0; j < staticLine.length; j++ ){
						if(params[ops.format].mask.indexOf(staticLine[j]) == -1){
							if (staticLine[j].search(/format/i)!== -1){
								ops.mapper.format = j;
								formatReached = true;

							} else if (formatReached) {
								ops.patientObj[ops.patients[j - ops.mapper.format - 1][dbConstants.PATIENTS.ID_FIELD]] = {'id':j,
											'collection':ops.patients[j - ops.mapper.format - 1][dbConstants.PATIENTS.COLLECTION_ID],
											'documents':[],
											'ignored':0,
											'insertCache':[]};
							} else {
								ops.mapper.static[staticLine[j].replace('#','')] = j;
 							}
 						}
					}

					if (!formatReached){
						reject("Format field is missing.");
					}

					for (var j = 0; j < params[ops.format].headers.length; j++ ){
						if ( ops.mapper.static[params[ops.format].headers[j]] == undefined ){
							reject("Rquired field missing for the specified file type: "  + params[ops.format].headers[j]);
						}
					}
				} else if (stringArray[i].search(/^#/) === -1) {
					line = stringArray[i].split('\t');
					for (var patient in ops.patientObj){
						if (line[ops.mapper.static.id] === '.' || line[ops.mapper.static.id] === '') cont = false;

						var cont = true; 
						var currDoc = {};
						var ref,alt;
						var posModifier = 0;
						var toString = true;
						//check to make sure that patient exists
						if (ops.patientObj.hasOwnProperty(patient)){
							//loop over all of the static fields ie. chr pos etc
							for (var field in ops.mapper.static){
								if (ops.mapper.static.hasOwnProperty(field)){
									toString = true;
									var itemToInsert = line[ops.mapper.static[field]].split(',');
									if (field.search('chr') === -1){ // we want to keep chr as a string so dont convert it
										// For whatever reason, the files have a space at this location occasionally
										if (field == 'id')  itemToInsert.replace(/\s/,'');
										itemToInsert = itemToInsert.map(convertNum);
									} else {
										field = 'chr';
									}

									if (field == 'ref'){
										ref = itemToInsert[0];
									}

									if (field == 'alt'){
										alt = itemToInsert;
										toString = false;
									}
									//if the lenght of the final array is > 1 then insert the array otherwise insert the item
									if (toString) currDoc[field] =(itemToInsert.length > 1 ? itemToInsert:itemToInsert[0]);
								}
							}

							if ( currDoc['id'] == '.' || currDoc['id'] == undefined ) {
								//Ignore this file
								cont = false;
							}
							var alleles = convertAlleles(ref,alt);
							currDoc.original_alt = alt;
							currDoc.original_ref = ref;
							currDoc.alt = alleles.alt;
							currDoc.ref = alleles.ref;
							if (ops.format == 'VCF' ){
								currDoc.original_pos = currDoc.pos;
								currDoc.pos += alleles.posModifier;
							}
							//Loop over all the items in the annovar annotation list
						}

						//Add the format fields now, these are additional information including the genotype
						if (cont){
							var formatMapper = [];
							var formatField = line[ops.mapper.format].split(':');
							var formatRegex = new RegExp(line[ops.mapper.format].replace(/[a-z0-9]+/gi,".*"),'i');
							var formatLine;


							try {
								formatLine = line[ops.patientObj[patient].id].split(':');
							} catch (err) {
								reject("An error occured while parsing " + ops.file + ". Format line does not appear to be formed correctly")
							}

							if (line[ops.patientObj[patient].id].match(formatRegex) === null){
								reject("Invalid Genotype field found");
							}

							for (var j = 0; j < formatField.length; j++ ){
								var info = formatLine[j].split(/[\/|,]/);
								info = info.map(convertNum);

								if (formatField[j].toLowerCase() == 'gt'){
									if (info.indexOf('.') != -1){
										ops.patientObj[patient].ignored++;
										cont = false;
									} else {
										currDoc[dbConstants.VARIANTS.ZYGOSITY] = zygosity(info);
										currDoc[dbConstants.VARIANTS.RAW_GENOTYPE] = formatLine[j];
										currDoc[formatField[j].toLowerCase()] = info;
										currDoc[dbConstants.VARIANTS.PHASING] = (formatLine[j].indexOf('|') != -1 || false);
									}
								} else if (cont){
									currDoc[formatField[j]] = (info.length == 1 ? info[0]:info);
								}
							}
						}
						if (cont){
							//make it so there is not an array of items for the alt call but only a single item
							for (var p =0; p < currDoc.gt.length; p++ ){
								currDoc['a' + p] = currDoc.gt[p] == 0 ? currDoc.ref:currDoc.alt[currDoc.gt[p] - 1];
							} 

							ops.patientObj[patient].documents.push(currDoc);
						}

					} 
				} else {
					ops.numHeader++;
				}
			}
		}
		resolve(Object.keys(ops.patientObj));
	});
	return promise;	
};

//==============================================================================================================
/* Upon completetion of the parsing, add any remaining entries into
 * the database. recursively calling itself until all entries are in
 */
var cleanup = function(patient){
	return checkAndInsertDoc(patient)
	.then(function(){
		if (ops.patientObj[patient].documents.length > 0){
			cleanup(patient);
		}
	});
};

/* When a file has finished parsing, the database must be updated to indicate that it has successfully
 * completed. Update the database for each patient, addoing a date, showing that the file has finished
 */
var setComplete = function(){
	var patient_list = ops.patients.map(function(obj){
		return obj[dbConstants.PATIENTS.ID_FIELD];
	});
	var query = {};
	query[dbConstants.PATIENTS.ID_FIELD] = {$in:patient_list};
	var documents = {$set:{}};
	documents.$set[dbConstants.PATIENTS.ANNO_COMPLETE] = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
	documents.$set[dbConstants.PATIENTS.READY_FOR_USE] = true;
	var insOptions = {multi:true};
	return dbFunctions.update(dbConstants.PATIENTS.COLLECTION, query,documents, insOptions, ops.user);
}

/* When an error has been encountered we want to remoev the patient from the current database,
 * adding them to the Fail collection. */
var fail = function(err){
	logger('error',err,{user:ops.user,target:ops.file,action:'parseVCF'})
	var pat;
	Promise.each(ops.patients,function(patient){
		pat = patient;
		return dbFunctions.removePatient(patient[dbConstants.PATIENTS.ID_FIELD],ops.user);
	}).catch(function(err){
		logger('error',err,{user:ops.user,target:pat,action:'removePatient'});
	});

}

/* remnove the vcf file from the server */
var removeFile = function(){
	logger('info','removing file',{user:ops.user,target:ops.file,action:'unlink'});
	return fs.unlinkAsync(ops.file).catch(function(err){
		logger('error',err,{user:ops.user,action:'unlink'});
	});		
}

//==============================================================================================================
/* Insert up to this.docMax entries (default 999) into the connected database
 * for the specified patient. Additionally, remove from memory the documents 
 * that were inserted
 * returns a promise

 */
var checkAndInsertDoc = function(patient){
	var promise = new Promise(function(resolve,reject){
		var options = {
			documents: ops.patientObj[patient].documents,
			collectionName:ops.patientObj[patient].collection
		};
		return dbFunctions.insertMany(options,ops.user)
		.then(function(){
			ops.patientObj[patient].documents = [];
			ops.patientObj[patient].insertCache = [];
			resolve(ops.patientObj[patient].documents.length);
		});
	});
	return promise;
};


//==============================================================================================================
/* helper function for determinging if a funcion is an array. Taken from user Raynos from stack overflow
*/


//simple function to test if object is an array
var isArray = function(obj){
	return Object.prototype.toString.call(obj) === '[object Array]';
};


if (typeof String.prototype.startsWith != 'function') {
   String.prototype.startsWith = function (str){
	   return this.slice(0, str.length) == str;
    };
}

if (typeof String.prototype.endsWith != 'function') {
    String.prototype.endsWith = function (str){
      return this.slice(-str.length) == str;
    };
}


//Convert a string to a number OR leave as a string if it cannot be converted
var convertNum = function(str){
	if (isNaN(str)){
		return str;
	} else { 
		return Math.round(str*1000)/1000;
	} 
};


// Convert the genotype into a easy to read zygosity
var zygosity = function(arr){
	all1 = arr[0];
	all2 = arr[1];
	if (all1 != all2){
		return 'hetero';
	} else if (all1 === 0){
		return 'homo_ref';
	} else {
		return 'homo_alt';
	}
};

/* cound the number of undefined items within the array,
 * if the number  == length of array return false,
 * else return true */
var countUndefined = function(arr){
	var count = 0;
	for (var i=0; i < arr.length; i++ ){
		if (arr[i] === undefined){
			count++;
		}
	}
	if (count == arr.length)
		return false;
	else
		return true;
};

/* The vcf format of genotypes is not very intuitive. in order to more intuitively display
 * the variant information, variants are converted to more accurately portray insertion and
 * deletions. Additionally, the position is fixed so that it now refers to the appropriate
 * position referenced by dbSNP.
 */

 //THIS MUST BE LOOKED INTO....
var convertAlleles = function(ref,alt){
	var tempRefAllele, tempModifier,
		tempAlts = [],
		tempRefs = [],
		tempModifierArray =[];  //the priority will be to assign a value to the ref. tehrefore if there is an INSERTION
								    //AND deletion, the default will be to add an allele to the INSERTIO
	tempAlts = alt.map(function(item){
		if (ref.length > item.length){ // deletion
			tempRefs.push(ref.slice(item.length));
			tempModifierArray.push(item.length);
			return '-';
		} else if (ref.length < item.length){ //insertion
			tempRefs.push('-');
			tempModifierArray.push(ref.length - 1);
			return item.slice(ref.length);
		} else {// else they are the same length, so nothing happends
			tempRefs.push(ref[ref.length-1]);
			tempModifierArray.push(0);
			return item[item.length-1];
		}
	});

	/* Search through the tempRef allele area. the logic here
	 * is to try and find the longest ref allele, that is not
	 * '-'. if the only allele found however is '-', that is what
	 * is taken. this sets the ref allele to be used for all other 
	 * alleles */
	for (var j=0; j < tempRefs.length; j++){
		if (!tempRefAllele){
			tempRefAllele = tempRefs[j];
			tempModifier = tempModifierArray[j];
		} else {
			if (tempRefs[j] != '-'){
				if (tempRefAllele == '-'){
					tempRefAllele = tempRefs[j];
					tempModifier = tempModifierArray[j];
				} else if (tempRefAllele != tempRefs[j] && tempRefAllele.length < tempRefs[j].length){
					tempRefAllele = tempRefs[j];
					tempModifier = tempModifierArray[j];
				}
			}
		}
	}

	/* Make the final modifactions of the alt alleles based on the chosen ref allele
	*/
	var finalAlts = tempAlts.map(function(item,index){
		if (tempRefs[index]== '-' && tempRefAllele != '-'){
			item = tempRefAllele + item;
			return item;
		} else if (tempRefAllele.length != tempRefs[index].length){
			item = tempRefAllele.substring(0,tempRefAllele.length - tempRefs[index].length)  + item;
			return item;
		} else {
			return item;
		}
	});

	//return an object with the information on the ref/alt and number of shifted bases
	return {ref:tempRefAllele,alt:(finalAlts.length > 1 ? finalAlts:finalAlts[0]),posModifier:tempModifier};
};


//Reset the page options
var resetOps = function(){
	ops = {
		user : undefined,
		file: undefined,
		patients : undefined,
		bufferSize : 10000000,
		bufferArray : [],
		oldString : "",
		mapper : {'static':{}},
		docMax : 5000,
		patientObj : {},
		stream : undefined,
		reading : false,
		numHeader : 0,
		format : undefined,
		file : undefined,
		user : undefined
	}
}
//==============================================================================================================
//==============================================================================================================
// Wrapper to run all the functions as a pipeline
//==============================================================================================================
//==============================================================================================================

var run = function(file, patients, user,remove){

	ops.file = file;
	ops.user = user;
	ops.patients = patients;
	return setupCollections().then(function(){
		return read()
	}).then(function(){
		return setComplete();
	}).catch(function(err){
		return fail(err)
	}).then(function(){
		if (remove){
			return removeFile();
		}
	}).then(function(){
		resetOps();
	});
};

module.exports = run;
