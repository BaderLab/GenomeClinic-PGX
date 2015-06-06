/* Node module for the annotaion, parsing and uploading of a vcf file to a
 * running database (currently set to mongodb). the input is first checked
 * to ensure proper file formats are uploaded, annoation paths are set
 * and the options provided are correct. Additionally currently the module
 * specifies the option table as a required option to provide a table name.
 * this will eventually be removed and changed to patientname with the table
 * name automatically being determined.
 *
 *
 * @author Patrick Magee
*/
var Promise = require("bluebird");
//var db = require("../frangipani_node_modules/DB");
var fs = Promise.promisifyAll(require('fs')); 
var path = require("path");
var glob = Promise.promisifyAll(require("glob"));
var child_process=Promise.promisifyAll(require('child_process'));
var dbConstants = require('./conf/constants.json').dbConstants;
var nodeConstants = require('./conf/constants.json').nodeConstants;
var logger = require('./logger');
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
	var user = options.req.user.username;
	//new promise to return
	var promise = new Promise(function(resolve,reject){
		var annovarPath, annodbStrin, dbusageString, 
			tempOutputFile,buildver,annovarIndex,shouldReject;
		var inputFile = nodeConstants.SERVER_DIR + '/' + options.input;

		//Check to see whether input file exists and if annovarPath exists
		logger('info','Beginning annotation pipeline',{user:user,target:inputFile,action:'annotateAndAddVariants'});
		dbFunctions.findOne(dbConstants.DB.ADMIN_COLLECTION,{},user)
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
			logger('info','renaming input file: ' + inputFile + 'to output: ' + newFile,{user:user,target:inputFile,action:'fs.renameAsync'})
			return fs.renameAsync(inputFile,newFile).then(function(){
				inputFile = newFile;
				tempOutputFile = inputFile + '.' + buildver + '_multianno.vcf';
			});

		}).then(function(){
			return fs.statAsync(annovarPath);
		}).then(function(){
			return options.patients;

		}).each(function(patient){
			logger('info','creating patient collection',{user:user,target:patient[dbConstants.PATIENTS.ID_FIELD],action:'createCollection'});
			//create newTable and raise exception if tablname already exists
			var collectionName = patient[dbConstants.PATIENTS.COLLECTION_ID];
			return dbFunctions.createCollection(collectionName,user);
		}).then(function(){
			var execPath = annovarPath + '/table_annovar.pl';
			var dbPath = annovarPath + "/humandb/";
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
			logger('info','running annovar',{user:user,target:inputFile,action:'table_annovar.pl',arguments:args});
			var promise = new Promise(function(resolve,reject){
				var ps = child_process.spawn(annovarCmd, args);
				ps.on('error',function(err){
					reject(err);
				});
				ps.on('exit',function(code){
					if (code === 0){
						logger('info','anovar annotations now complete. output saved to:' + tempOutputFile,{user:user,target:inputFile,action:'table_annovar.pl',arguments:args});
						resolve(code);
					} else {
						var err = new Error("annovar did not exit properly");
						logger('error',err,{user:user,target:inputFile,action:'table_annovar.pl',arguments:args});
						reject(err);
					}
				});
			});
			return promise;
		}).then(function(){
			//check to ensure the tempOutFile was created
			return fs.statAsync(tempOutputFile);
		}).then(function(){
			options.user = user;
			delete options.req;
			var args = [tempOutputFile,JSON.stringify(options)];
			var promise = new Promise(function(resolve, reject){
				var returnValue;
				var filePath = __dirname + '/parseVCF';
				var ps = child_process.fork(filePath,args,{silent:true});

				ps.on('error',function(err){
					logger('error',err,{user:user,target:tempOutputFile,action:'parseVCF',arguments:args});
					reject(err);
				});
				/*ps.stderr.on('data',function(data){
					var err = new Error(data.toString('utf-8'));
					err.message = ;
					logger('error',err.stack,{user:user,target:tempOutputFile,action:'parseVCF',arguments:args});
					reject(err);
					
				});*/
				ps.on('exit',function(code){
					if (code === 0){
						
						var result = require(tempOutputFile + '.json');
						resolve(result);
					} else {
						var err = new Error("parserVCF did not exist properly");
						logger('error',err,{user:user,target:tempOutputFile,action:'parseVCF',arguments:args});
						reject(err);
					}
				});
			});	
			return promise;
		}).then(function(result){
			//ensure the documents in the database have no data loss
			//by comparing the number of lines -1 in the original file
			//with a count of the number of lines in the database.
			//if even one of them is off, reject it.
			logger("info","comparing database entries to vcf to ensure lossless upload",{user:user,target:tempOutputFile,action:'wc',arguments:args});
			var countArray = result; // this is an array containing the number of ignored values for each file
			var args = ['-l',tempOutputFile];
			var promise = new Promise(function(resolve, reject){
				var ps = child_process.spawn('wc',args);
				ps.on('error',function(err){
					logger('error',err,{user:user,target:tempOutputFile,action:'wc',arguments:args})
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
							console.log('here-4');
							if (count + countArray[index] !== num){ // if this is not equal, reject by throwing a new error{
								var err  = new Error('Num of docuemnts in patient: ' + patientid + ' does not match with original file!' )
								logger('error',err,{user:user,target:tempOutputFile,action:'wc',arguments:args})
								reject(err);
							}
						});
					}).then(function(){
						//resolve and contine.
						resolve("correct");
					});
				});
			});
			return promise;		
		}).then(function(){
			return Promise.each(options.patients,function(patient){
				var indexes = {};
				indexes[dbConstants.VARIANTS.CHROMOSOME] = 1;
				indexes[dbConstants.VARIANTS.START] = 1;
				indexes[dbConstants.VARIANTS.ZYGOSITY] = 1;
				if (dbConstants.VARIANTS.STOP)
					indexes[dbConstants.VARIANTS.STOP] = 1;
				return dbFunctions.createIndex(patient[dbConstants.PATIENTS.COLLECTION_ID],indexes,user).then(function(){
					//add additional indexex
					Promise.each(annovarIndex,function(index){
						var indexOpts = {};
						indexOpts[index] = 1;
						return dbFunctions.createIndex(patient[dbConstants.PATIENTS.COLLECTION_ID],indexOpts,user);
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
			return dbFunctions.update(dbConstants.PATIENTS.COLLECTION, query,documents, insOptions,user);

		}).then(function(){
			logger("info","annovar annotations are complete and uploaded",{user:user,target:inputFile,action:'annotateAndAddVariants'});
		//}).catch(AnnovarError,function(err){
		//	logMessage(null,err.toString());
		}).catch(function(err){
			//Need more robust error handler here for solving issues
			logger('error',err,{user:user,target:inputFile,action:'annotateAndAddVariants',arguments:options})
			shouldReject = true;
			var pat;
			Promise.each(options.patients,function(patient){
				pat = patient;
				return dbFunctions.removePatient(patient[dbConstants.PATIENTS.ID_FIELD],user);
			}).catch(function(err){
				logger('error',err,{user:user,target:pat,action:'removePatient'});
			});

		}).done(function(){
			//Cleanup, remove files and close db connection
			return glob.globAsync(inputFile + "*")
			.each(function(file){
				logger('info','removing file',{user:user,target:file,action:'unlink'});
				return fs.unlinkAsync(file);
			}).then(function(){
			}).catch(function(err){
				logger('error',err,{user:user,action:'unlink'});
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

	
		








