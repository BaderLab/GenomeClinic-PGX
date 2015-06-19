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
var dbFunctions = require('../models/mongodb_functions');
var logger = require('./logger');

var dbConstants = constants.dbConstants,
	nodeConstants = constants.nodeConstants;

function queue(){
	this.isRunning = false;
	this.queue = [];
}

//=======================================================================================
//variables

/* Add the incoming file with patientInformation to the queue
 * to await processing additionally, when it adds a file to the queue.
 * it also adds the patient name to the patient table ensuring no
 * duplicate entries occur
 */
queue.prototype.addToQueue = function(fileParams,req){
	var self = this;
	var patientFields = req.fields;
	var promise = new Promise(function(resolve,reject){
		var inputObj = {
			fileInfo: fileParams,
			req:req
		};
		var tempArr =[];
		self.splitInputFields(patientFields)
		.each(function(patient){
			logger('info',fileParams.name + "added to queue");
			var options = patient;
			var now = new Date();
			options[dbConstants.PATIENTS.FILE_FIELD] = fileParams.name;
			options[dbConstants.PATIENTS.DATE_ADDED] = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
			options[dbConstants.PATIENTS.READY_FOR_USE] = false;
			options[dbConstants.PATIENTS.ANNO_COMPLETE] = undefined;
			options[dbConstants.DB.OWNER_ID] = req.user[dbConstants.USERS.ID_FIELD];
			tempArr.push(options);
		}).then(function(){
			return Promise.each(tempArr,function(item){
				return dbFunctions.addPatient(item,req.user[dbConstants.USERS.ID_FIELD]).catch(function(err){
					logger('error',err,{action:'addPatient',user:req.user.username});
					dbFunctions.removePatient(item[dbConstants.PATIENTS.ID_FIELD],req.user[dbConstants.USERS.ID_FIELD]);
				});
			});
		}).then(function(result){
			inputObj.fields = result;
			self.queue.push(inputObj);
			logger('info','file added to annotation job queue',{action:'addToQueue',user:req.user.username,file:fileParams.name})
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
		logger('info','removed entry from annoation job queue',{action:'removeFirst',user:self.queue[0].req.user.username,file:self.queue[0].fileInfo.name});
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
	var req;
	//var promise = new Promise(function(resolve,reject){
	if (!self.isRunning)
		self.isRunning = true;

	self.first().then(function(params){
		fileInfo = params.fileInfo;
		fields = params.fields;
		req = params.req;
	}).then(function(){
		self.removeFirst();
	}).then(function(){
		var options = {
			input:'upload/vcf/' + fileInfo.name,
			patients:fields,
			req:req
		};
		return annotateFile(options);
	}).catch(function(err){
		logger('error',err,{user:req.user.username,target:fileInfo.name,action:'run'});
	}).done(function(){
		if (self.queue.length > 0){
			return self.run();
		} else {
			self.isRunning = false;
		}
	});
};


module.exports = queue;
