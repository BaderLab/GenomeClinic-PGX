/* Node module for the annotaion, parsing and uploading of a vcf file to a
 * running database (currently set to mongodb). the input is first checked
 * to ensure proper file formats are uploaded, annoation paths are set
 * and the options provided are correct. Additionally currently the module
 * specifies the option table as a required option to provide a table name.
 * this will eventually be removed and changed to patientname with the table
 * name automatically being determined.
 *
 *
 * Written by Patrick Magee
*/
var Promise = require("bluebird");
//var db = require("../frangipani_node_modules/DB");
var fs = Promise.promisifyAll(require('fs')); 
var path = require("path");
var glob = Promise.promisifyAll(require("glob"));
var child_process=Promise.promisifyAll(require('child_process'));
var dbConstants = require('./conf/constants.json').dbConstants;
var logger = require('./anno_logger');
var dbFunctions = require('../models/mongodb_functions');

//var Parser = require('./parseVCF');


//Custom Errors for event handling
function InputError(message){
		this.name = "InputError";
		this.message = ( message || "" );
		Error.call(this);
		Error.captureStackTrace(this,this.constructor);
}
InputError.prototype = Object.create(Error.prototype);
InputError.prototype.constructor = InputError;

function AnnotationError(message){
		this.name = "AnnotationError";
		this.message = ( message || "" );
		Error.call(this);
		Error.captureStackTrace(this,this.constructor);
}
AnnotationError.prototype = Object.create(Error.prototype);
AnnotationError.prototype.constructor = AnnotationError;

function ParseError(message){
		this.name = "ParseError";
		this.message = ( message || "" );
		Error.call(this);
		Error.captureStackTrace(this,this.constructor);
}
ParseError.prototype = Object.create(Error.prototype);
ParseError.prototype.constructor = ParseError;

function AnnovarError(message){
	this.name = "AnnovarError";
	this.message = ( message || "" );
	Error.call(this);
	Error.captureStackTrace(this,this.constructor);
}
AnnovarError.prototype = Object.create(Error.prototype);
AnnovarError.prototype.constructor = AnnovarError;



/* annotateAndAddVariants:
 * Main function that facilitates the annotation of variants
 * as well as their addition to a databse. It takes a single parameter:
 * 'options' which is a js object that contains the following arguments:
 *
 * input: path to input file in vcf format. REQUIRED
 * patients: an array with objects corresponding to individual patients with a mapped table property
 * 
 */

function annotateAndAddVariants(options){
	var annodbString,annovarPath,dbusageString,annovarIndex,buildver;
	var logMessage = function(message,err,obj){
		if (message){
			var text = "FILE: " + options.input + "\n " + message;
			logger.info(text,obj);
		} else if (err){
			logger.error(err,obj);
		}
	};
	//new promise to return
	var promise = new Promise(function(resolve,reject){
		var annovarPath, annodbStrin, dbusageString, 
			tempOutputFile,buildver,annovarIndex,shouldReject;
		var inputFile = path.resolve(options.input);

		//Check to see whether input file exists and if annovarPath exists
		logMessage("beginning annotations pipeline");
		dbFunctions.findOne(dbConstants.DB.ADMIN_COLLECTION,{})
		.then(function(result){
			annodbString = result[dbConstants.ANNO.DBS].join(',');
			annovarPath = result[dbConstants.ANNO.PATH];
			dbusageString = result[dbConstants.ANNO.USAGE].join(',');
			annovarIndex = result[dbConstants.ANNO.INDEX_FIELDS];
			buildver = result[dbConstants.ANNO.BUILD_VER];

		}).then(function(){
			return fs.statAsync(inputFile);
		}).then(function(result){
			var newFile = inputFile.replace(/\(|\)/g,"").replace(/\s/,"_");
			logMessage('ranaming input: ' + inputFile + ' to output: ' + newFile);
			return fs.renameAsync(inputFile,newFile).then(function(){
				inputFile = newFile;
				tempOutputFile = inputFile + '.' + buildver + '_multianno.vcf';
			});

		}).then(function(){
			logMessage("checking annovar path");
			return fs.statAsync(annovarPath);
		}).then(function(){
			return options.patients;
		}).each(function(patient){
			//create newTable and raise exception oif tablname already exists
			logMessage('collection created for patient: ' + patient[dbConstants.PATIENTS.ID_FIELD] + ' COLLECTION: ' + patient[dbConstants.PATIENTS.COLLECTION_ID]);
			var collectionName = patient[dbConstants.PATIENTS.COLLECTION_ID];
			return dbFunctions.createCollection(collectionName);
		}).then(function(){
			var execPath = path.resolve(annovarPath + '/table_annovar.pl');
			var dbPath = path.resolve(annovarPath + "/humandb/");
			var annovarCmd = execPath;
			var args = [
				inputFile,
				dbPath,
				'-buildver',
				buildver,
				'-operation',
				dbusageString,
				'-nastring',
				'.',
				'-protocol',
				annodbString,
				'-vcfinput',
				'-remove',
				'-dot2underline'
			];

			//run annovar command as a child process
			logMessage('running annovar with commands', null,{cmds:args});
			var promise = new Promise(function(resolve,reject){
				var ps = child_process.spawn(annovarCmd, args);
				ps.on('error',function(err){
					console.log(err);
					reject(err);
				});
				ps.on('exit',function(code){
					if (code === 0){
						logMessage('anovar annotations now complete');
						resolve(code);
					} else {
						logMessage('annovar Did not exit properly');
						reject(code);
					}
				});
			});
			return promise;
		}).then(function(){
			//check to ensure the tempOutFile was created
			return fs.statAsync(tempOutputFile);
		}).then(function(){
			logMessage("parsing annotated vcf file: " + tempOutputFile + " and adding to DB");
			var args = [tempOutputFile,JSON.stringify(options.patients)];
			var promise = new Promise(function(resolve, reject){
				var returnValue;
				var filePath = __dirname + '/parseVCF';
				var ps = child_process.fork(filePath,args,{silent:true});

				ps.on('error',function(err){
					logMessage(null,err.stack);
					reject(err);
				});

				//retrieve the json array printed to stdout from ther ParseVCF

				ps.stderr.on('data',function(data){
					console.log(data.toString('utf-8'));
					logMessage(null,"ERR: " + data.toString('utf-8'));
					reject(data.toString('utf-8'));
					
				});
				ps.on('exit',function(code){
					if (code === 0){
						logMessage("parser exited correctly, reading program output");
						var result = require(tempOutputFile + '.json');
						resolve(result);
					} else {
						logMessage(null,"parser did not exit properly");
						reject(code);
					}
				});
			});	
			return promise;
		}).then(function(result){
			//ensure the documents in the database have no data loss
			//by comparing the number of lines -1 in the original file
			//with a count of the number of lines in the database.
			//if even one of them is off, reject it.
			logMessage("comparing databse entry to annotated vcf file");
			var countArray = result; // this is an array containing the number of ignored values for each file
			var args = ['-l',tempOutputFile];
			var promise = new Promise(function(resolve, reject){
				var ps = child_process.spawn('wc',args);
				ps.on('error',function(err){
					reject(err);
				});

				//when the process returns data;
				ps.stdout.on('data',function(data){
					var string = data.toString('utf-8');
					//extract the number
					string = string.split(/\s+/);
					string = string.filter(function(item){
						if (!isNaN(item))
							return(item);
					});
					num = parseInt(string[0]);

					//for each patient, determing the count of documents ion the collection
					Promise.each(options.patients,function(patient,index){
						patientid = patient[dbConstants.PATIENTS.ID_FIELD];
						collectionid = patient[dbConstants.PATIENTS.COLLECTION_ID];
						return dbFunctions.count(collectionid).then(function(count){

							if (count + countArray[index] !== num) // if this is not equal, reject by throwing a new error
								reject(new Error('Num of docuemnts in patient: ' + patientid + ' does not match with original file!' ));
						});
					}).then(function(){
						//resolve and contine.
						resolve("correct");
					});
				});
			});
			return promise;		
		}).then(function(){
			logMessage("addding indexes to newly created collections",{'optionalIndexes':annovarIndex});
			return Promise.each(options.patients,function(patient){
				var indexes = {};
				indexes[dbConstants.VARIANTS.CHROMOSOME] = 1;
				indexes[dbConstants.VARIANTS.START] = 1;
				indexes[dbConstants.VARIANTS.ZYGOSITY] = 1;
				if (dbConstants.VARIANTS.STOP)
					indexes[dbConstants.VARIANTS.STOP] = 1;
				return dbFunctions.createIndex(patient[dbConstants.PATIENTS.COLLECTION_ID],indexes).then(function(){
					//add additional indexex
					Promise.each(annovarIndex,function(index){
						var indexOpts = {};
						indexOpts[index] = 1;
						return dbFunctions.createIndex(patient[dbConstants.PATIENTS.COLLECTION_ID],indexOpts);
					});
				});
			});
		}).then(function(){
			//Update the patient table
			var patient_list = options.patients.map(function(obj){
				return obj[dbConstants.PATIENTS.ID_FIELD];
			});
			var query = {};
			query[dbConstants.PATIENTS.ID_FIELD] = {$in:patient_list};
			var documents = {$set:{}};
			documents.$set[dbConstants.PATIENTS.ANNO_COMPLETE] = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
			documents.$set[dbConstants.PATIENTS.READY_FOR_USE] = true;
			var insOptions = {multi:true};
			return dbFunctions.update(dbConstants.PATIENTS.COLLECTION, query,documents, insOptions);

		}).then(function(){
			logMessage("completed annotation and uploaded entries to db");
		//}).catch(AnnovarError,function(err){
		//	logMessage(null,err.toString());
		}).catch(function(err){
			//Need more robust error handler here for solving issues
			logMessage(null,err.stack);
			shouldReject = true;
			Promise.each(options.patients,function(patient){
				return dbFunctions.removePatient(patient[dbConstants.PATIENTS.ID_FIELD])
			}).catch(function(err){
				logMessage(null,"Error removing entries from database",{err:err});
			});

		}).done(function(){
			//Cleanup, remove files and close db connection
			logMessage("cleaning up directory");
			return glob.globAsync(inputFile + "*")
			.each(function(file){
				return fs.unlinkAsync(file);
			}).then(function(){
				logMessage("all files removed successfully");
			}).catch(function(err){
				logMessage(null,"could not remove files",{err:err});
			}).then(function(){
				if (shouldReject)
					reject();
				else
					resolve('Completed Annotation and uploaded entries');
			});

		});
	});
	
	return promise;
}

module.exports = annotateAndAddVariants;

	
		








