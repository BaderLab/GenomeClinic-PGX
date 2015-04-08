/* A simple queuing system that allows for serial execution of 
 * the annovar annotations and insertion into the database.
 * Will accept additional files to be added to a queue however,
 * hold off performing any action on them, until the one ahead
 * of it is completed.
 * 
 * @author Patrick Magee
 */
var Promise = require('bluebird');
var constants= require("./conf/constants.json");
var annotateFile = require('./annotateAndAddVariants');
var fs = Promise.promisifyAll(require('fs'));

var dbConstants = constants.dbConstants,
	nodeConstants = constants.nodeConstants;



function queue(logger,dbFunctions){
	this.logger = (logger || require('./logger')('node'));
	this.dbFunctions = (dbFunctions || require('../models/mongodb_functions'));
}

//=======================================================================================
//variables
queue.prototype.isRunning = false;
queue.prototype.queue = [];

/* Add the incoming file with patientInformation to the queue
 * to await processing additionally, when it adds a file to the queue.
 * it also adds the patient name to the patient table ensuring no
 * duplicate entries occur
 */
queue.prototype.addToQueue = function(fileParams,patientFields,user){
	var self = this;
	var promise = new Promise(function(resolve,reject){
		var inputObj = {
			fileInfo: fileParams,
		};
		var tempArr =[];
		self.splitInputFields(patientFields)
		.each(function(patient){
			self.logger.info(fileParams.name + "added to queue");
			var options = patient;
			var now = new Date();
			options[dbConstants.PATIENTS.FILE_FIELD] = fileParams.name;
			options[dbConstants.PATIENTS.DATE_ADDED] = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
			options[dbConstants.PATIENTS.READY_FOR_USE] = false;
			options[dbConstants.PATIENTS.ANNO_COMPLETE] = undefined;
			options[dbConstants.DB.OWNER_ID] = user;
			tempArr.push(options);
		}).then(function(){
			inputObj.fields = tempArr;
			self.queue.push(inputObj);
		}).then(function(){
			resolve(self.queue);
		});

	});
	return promise;
};

//=======================================================================================
/* remove the first item from the queue */
queue.prototype.removeFirst = function(){
	var self = this;
	var promise = new Promise(function(resolve,reject){
		self.queue.shift();
		resolve(self.queue);
	});
	return promise;
};

//=======================================================================================
/* Grab the first entry from the queue and return the object */
queue.prototype.first = function(){
	var self = this;
	var promise = new Promise(function(resolve,reject){
		var outObj = self.queue[0];
		resolve(outObj);
	});
	return promise;
};

//=======================================================================================

/* the input fields on multi-patient forms start with an identified
 * ie. 0- or 1-  linking the incoming field with the patient
 * This appeard to be a limitation to the file-upload form query
 * So this will split the fields and determine which patient goes with what
 */
queue.prototype.splitInputFields = function(fields){
	var self = this;
	var promise = new Promise(function(resolve,reject){
		var tempObj = {};
		var outList = [];

		for (var field in fields){
			if (fields.hasOwnProperty(field)){
				var splitFields = field.split('-');
				if (!tempObj.hasOwnProperty(splitFields[0]))
					tempObj[splitFields[0]] = {};
				tempObj[splitFields[0]][splitFields[1]] = fields[field];
			}
		}
		for (var num in tempObj){
			if (tempObj.hasOwnProperty(num)){
				outList.push(tempObj[num]);
			}
		}
		resolve(outList);
	});
	return promise;
};

//=======================================================================================
/* Annotate the first file in the queue and add the contained patients
 * to the databse (possibly think of handing this off to the annotateAndAddvariants script)
 */
queue.prototype.run = function(){
	var self = this;
	var fileInfo;
	var fields;
	//var promise = new Promise(function(resolve,reject){
	if (!self.isRunning)
		self.isRunning = true;

	self.first().then(function(params){
		fileInfo = params.fileInfo;
		fields = params.fields;
	}).then(function(){
		self.removeFirst();
	}).then(function(){
		return fields;
	}).each(function(options){
		return self.dbFunctions.addPatient(options);
	}).then(function(result){
		var options = {
			input:'upload/vcf/' + fileInfo.name,
			patients:result
		};
		self.logger.info('running annotations on ' + options.input);
		return annotateFile(options);
	}).then(function(){
		self.logger.info('annotations complete');
	}).catch(function(err){
		self.logger.error(err);
	}).done(function(){
		if (self.queue.length > 0){
			return self.run();
		} else {
			self.isRunning = false;
		}
	});
		// do somehting here;
};


module.exports = queue;
