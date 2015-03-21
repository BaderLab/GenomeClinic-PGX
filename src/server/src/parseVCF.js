/* ParseVCF.js
 * In order to complete the file upload into the database, the output from 
 * Annovar must be parsed. To ensure the fastest possible parsing and more
 * Memory efficient method, this module was written.
 *
 * THe parseVCF object taktes two parameters when initiated: file and patients.
 * with severa; optional parameteres following. Some vcf files can be extemeely
 * larege, therefore to facilitate file reading in an async manner, the parser
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
 * written by Patrick Magee
*/
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var dbFunctions = require('../models/mongodb_functions');
var logger =  require('./logger')('parser');
var path = require('path');
var dbConstants = require('./conf/constants.json').dbConstants;


/* Empty constructor for the parseVCF object */
var parseVCF = function(file,patients,bufferSize,mask){
	this.file = file;
	this.patients = patients;
	this.dbFunctions = dbFunctions;
	this.bufferSize = (bufferSize || 10000000);
	this.bufferArray = [];
	this.oldString = "";
	this.mapper = {'static':{},'anno':[]};
	this.docMax = 5000;
	this.patientObj = {};
	this.stream = undefined;
	this.reading = false;
	this.mask = (mask || ['qual','filter']);
	this.numHeader = 0;
	this.useDbSnpID = false;
	this.vcf = undefined;
};
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
parseVCF.prototype.read = function(){
	this.logMessage("commencing file read",null,{'bufferSize':this.bufferSize,'patients':this.patients,'docMax':this.docMax,'mask':this.mask});
	var self = this;
	var promise = new Promise(function(resolve,reject){
		self.stream = fs.createReadStream(self.file,{'bufferSize':this.bufferSize});
		self.stream.on('data',function(data){
			self.stream.pause();
			var promise = new Promise(function(resolve,reject){
				self.bufferArray.push(data);
				if (!self.reading){
					self.reading = true;
					self.readAndParse()
					.then(function(){
						self.stream.resume();
						self.reading = false;
						resolve(self.stream);
					});
				} else {
					resolve(self.stream);
				}
			});
			return promise;

		});

		self.stream.on('end',function(){
			var promise;
			//if there is any remaining itms in the string. add them
			if (self.oldString !== ""){
				promise = self.parseChunk([self.oldString])
				.then(function(){
					return Object.keys(self.patientObj);
				});
			} else {
				promise = Promise.resolve(Object.keys(self.patientObj));
			}
			promise.each(function(patient){
				return self.checkAndInsertDoc(patient);
			}).then(function(){
				self.logMessage("file read successful, documents inserted into database");
				var igArray = [];
				for (var patient in self.patientObj){
					if (self.patientObj.hasOwnProperty(patient)){
						igArray.push(self.patientObj[patient].ignored + self.numHeader);
					}
				}
				self.logMessage('Writing Number lines skipped to file ' + self.file + ".json");
				return fs.writeFileAsync(self.file + ".json",JSON.stringify(igArray));
			}).then(function(){
				self.logMessage('done all jobs');
				resolve('done');
			});
		});

		self.stream.on('error',function(err){
			self.logMessage(null,err);
			//self.stream.destroy();
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
parseVCF.prototype.readAndParse = function(chunk){
	var self = this;	
	var promise = new Promise(function(resolve,reject){
		var chunk = self.bufferArray[0];
		self.bufferArray.shift();
		Promise.resolve().then(function(){
			return chunk.toString('utf-8');
		}).then(function(string){
			if (self.oldString !== ""){
				string = self.oldString + string;
			}
			splitString = string.split('\n');
			if (string.substr(string.length - 1) == "\n"){
				self.oldString = "";
			}  else {
				self.oldString = splitString.pop();
			}
			return splitString;
		}).then(function(stringArray){
			if (stringArray.length > 0 )
				return self.parseChunk(stringArray).map(function(patient){
					if (self.patientObj[patient].documents.length >= self.docMax)
						return self.checkAndInsertDoc(patient);
			});
		}).then(function(){
			if (self.bufferArray.length > 0){
				return self.readAndParse();
			}
		}).then(function(){
			resolve('read chunk');
		}).catch(function(err){
			reject(err);
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
parseVCF.prototype.parseChunk = function(stringArray){
	var self = this;
	var line;
	var promise = new Promise(function(resolve,reject){
		//iterate over all strings that are include
		for (var i=0; i < stringArray.length ; i++ ){
			//Check to make sure the first entry equates to a vcf format
			if (stringArray[i] !== "" ){
				if (!self.vcf){
					version = parseFloat(stringArray[i].match(/VCFv.+/ig)[0].replace(/[a-z]+/ig,""));
					if (version < 4.1 || version  > 4.2)
						throw new Error ("Invalid vcf File format");
					else
						self.vcf = version;
				} else if (stringArray[i].search(/##INFO/i) !== -1 && stringArray[i].search(/annovar/i) !== -1){
					line = stringArray[i].toLowerCase().match(/id=[^,]+/i)[0].replace('id=','').replace('.','_');
					if (line == 'snp138'){
						self.useDbSnpID = true;
						self.mask.push('id');
					}
					self.mapper.anno.push(line);
					self.numHeader++;
				} else if (stringArray[i].search(/^#CHROM/i)!== -1) {
					self.numHeader++;
					var formatReached = false;
					var staticLine = stringArray[i].toLowerCase().split('\t');
					for (var j = 0; j < staticLine.length; j++ ){
						if(self.mask.indexOf(staticLine[j]) == -1){
							if (staticLine[j].search(/format/i)!== -1){
								self.mapper.format = j;
								formatReached = true;

							} else if (formatReached) {
								self.patientObj[self.patients[j - self.mapper.format - 1][dbConstants.PATIENTS.ID_FIELD]] = {'id':j,
											'collection':self.patients[j - self.mapper.format - 1][dbConstants.PATIENTS.COLLECTION_ID],
											'documents':[],
											'ignored':0,
											'insertCache':[]};

							} else if (staticLine[j].search(/info/i) !== -1){
								self.mapper.annofield = j;
							} else {
								self.mapper.static[staticLine[j].replace('#','')] = j;
 							}
 						}
					}
				} else if (stringArray[i].search(/^#/) === -1) {
					line = stringArray[i].toLowerCase().split('\t');
					var annoObj = self.convertAnnoString(line[self.mapper.annofield]);
					var annoList = self.mapper.anno;
					//loop over all of the patients included
					for (var patient in self.patientObj){
						var cont = true; 
						var currDoc = {};
						var ref,alt;
						var posModifier = 0;
						//check to make sure that patient exists
						if (self.patientObj.hasOwnProperty(patient)){
							//loop over all of the static fields ie. chr pos etc
							for (var field in self.mapper.static){
								if (self.mapper.static.hasOwnProperty(field)){
									var itemToInsert = line[self.mapper.static[field]].split(',');
									if (field.search('chr') === -1){ // we want to keep chr as a string so dont convert it
										itemToInsert = itemToInsert.map(convertNum);
									} else {
										field = 'chr';
									}

									if (field == 'ref'){
										ref = itemToInsert[0];
									}

									if (field == 'alt'){
										alt = itemToInsert;
									}
									//if the lenght of the final array is > 1 then insert the array otherwise insert the item
									currDoc[field] = (itemToInsert.length > 1 ? itemToInsert:itemToInsert[0]);
								}
							}

							var alleles = convertAlleles(ref,alt);
							currDoc.original_alt = alt;
							currDoc.original_ref = ref;
							currDoc.original_pos = currDoc.pos;
							currDoc.alt = alleles.alt;
							currDoc.ref = alleles.ref;
							currDoc.pos += alleles.posModifier;
							//Loop over all the items in the annovar annotation list
							for (var j=0; j < annoList.length; j++){
								//if the annotation is the annovar_date or annovar_end then dont include it
								if (annoList[j].search(/annovar(\.|_)date/i) == -1 && 
										annoList[j].search(/allele(\.|_)end/i) == -1){
									//currDoc[annoList[j]] = annoObj
									var itemToInsert = annoObj[annoList[j]];	
									itemToInsert = itemToInsert.map(function(item){
										if (item !== "."){
											if (isNaN(item))
												item = item.split(',');
											else
												item = [item];
											return (item.length > 1 ? item:item[0]);
										}
									});

									if(annoList[j] == 'snp138'){
										currDoc.id = (isArray(itemToInsert) ? itemToInsert[0]:itemToInsert);
									} else if (countUndefined(itemToInsert)){
										currDoc[annoList[j]] = (itemToInsert.length > 1 ? itemToInsert:itemToInsert[0]);
									}
								}
							}
						}

						//Add the format fields now, these are additional information including the genotype
						var formatMapper = [];
						var formatField = line[self.mapper.format].split(':');
						var formatRegex = new RegExp(line[self.mapper.format].replace(/[a-z0-9]+/gi,".*"),'i');
						var formatLine = line[self.patientObj[patient].id].split(':');
						if (line[self.patientObj[patient].id].match(formatRegex) === null){
							throw new Error("Invalid Genotype field found");
						}
						for (var j = 0; j < formatField.length; j++ ){
							var info = formatLine[j].split(/[\/|,]/);
							info = info.map(convertNum);
							if (formatField[j] == 'gt'){
								if (info.indexOf('.') != -1){
									self.patientObj[patient].ignored++;
									cont = false;
								} else {
									currDoc[dbConstants.VARIANTS.ZYGOSITY] = zygosity(info);
									currDoc[dbConstants.VARIANTS.RAW_GENOTYPE] = formatLine[j];
									currDoc[formatField[j]] = info;
									currDoc[dbConstants.VARIANTS.PHASING] = (formatLine[j].indexOf('|') != -1 || false);
								}
							} else if (cont){
								currDoc[formatField[j]] = (info.length == 1 ? info[0]:info);
							}
						}
						if (cont){
							self.patientObj[patient].documents.push(currDoc);
						}
					}
				} else {
					self.numHeader++;
				}
			}
		}
		resolve(Object.keys(self.patientObj));
	});
	return promise;
};

//==============================================================================================================
/* Upon completetion of the parsing, add any remaining entries into
 * the database. recursively calling itself until all entries are in
 */
parseVCF.prototype.cleanup = function(patient){
	var self = this;
	return this.checkAndInsertDoc(patient)
	.then(function(){
		if (self.patientObj[patient].documents.length > 0){
			self.cleanup(patient);
		}
	});
};

//==============================================================================================================
/* Insert up to this.docMax entries (default 999) into the connected database
 * for the specified patient. Additionally, remove from memory the documents 
 * that were inserted
 * returns a promise

 */
parseVCF.prototype.checkAndInsertDoc = function(patient){
	var self = this;
	var promise = new Promise(function(resolve,reject){
		var docsToInsert = self.patientObj[patient].documents;
		var options = {documents: docsToInsert,
				   collectionName:self.patientObj[patient].collection};
		
		dbFunctions.insertMany(options)
		.then(function(){
			self.patientObj[patient].documents = [];//self.patientObj[patient]['documents'].slice(ind);
			self.patientObj[patient].insertCache = [];
			resolve(self.patientObj[patient].documents.length);
		}).catch(function(err){
			console.log(err.stack);
		});
	});
	return promise;
};



parseVCF.prototype.convertAnnoString = function(string){
	var out = {};
	var line = string.split(';');
	for (var i = 0; i < line.length; i++ ){
		if ( line[i].match(/^\.$/) === null ){
			var inputLine = line[i].split('=');
			inputLine[0] = inputLine[0].replace('.','_');
			if (!out.hasOwnProperty(inputLine[0])){
				out[inputLine[0]] = [convertNum(inputLine[1])];
			} else {
				out[inputLine[0]].push(convertNum(inputLine[1]));
			}
		}
	}
	return out;
};


parseVCF.prototype.logMessage = function(message,err,obj){
	var file = path.basename(this.file);
	if (message){
		var text = "FILE: " + file + "\n" + message;
		logger.info(text,obj);
	} else if (err){
		logger.error(err,obj);
	}
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

//==============================================================================================================
//==============================================================================================================
// Run with command line arguments
//==============================================================================================================
//==============================================================================================================
var output;
var fileName = process.argv[2];
var patients = JSON.parse(process.argv[3]);
return dbFunctions.connectAndInitializeDB(true)
	.then(function(){
		var parser = new parseVCF(fileName,patients);
		return parser.read();
	}).catch(function(err){
		throw new Error(err);
	}).done(function(){
		return dbFunctions.closeConnection();
	});

//module.exports = parseVCF;
