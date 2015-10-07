var Promise = require("bluebird");
var assert= require("assert");
var dbConstants = require("../lib/conf/constants.json").dbConstants;
var nodeConstants = require('../lib/conf/constants.json').nodeConstants;
//var dbConstants = require("../conf/constants.json").dbConstants;
//var nodeConstants = require('../conf/constants.json').nodeConstants;

module.exports = function(dbOperations){
	//=======================================================================================
	//Project functions
	//=======================================================================================
	/* Find all projects for a specific user and return the project within an array */
	dbOperations.prototype.findProjects = function(projectName, username){
		var query = {$or:[]};
		var _this = this;
		var fields = [dbConstants.PROJECTS.AUTH_USER_FIELD,dbConstants.DB.OWNER_ID];
		fields.forEach(function(item){
			var o = {};
			o[item] = username;
			query.$or.push(o);
		});

		if (projectName){
			query[dbConstants.PROJECTS.ID_FIELD] = projectName;
		}
		var resultArray;
		return this.find(dbConstants.PROJECTS.COLLECTION,query,undefined,undefined,username).then(function(result){
			resultArray = result;
			return resultArray;
		}).each(function(doc,index){
			var query = {};
			query[dbConstants.PROJECTS.ARRAY_FIELD] = doc[dbConstants.PROJECTS.ID_FIELD];
			return _this.count(dbConstants.PATIENTS.COLLECTION,query).then(function(result){
				resultArray[index].numPatients = result;
			});
		}).then(function(){
			return resultArray;
		});
	};

	/* Add a new project to the database under the passed user. the The options
	 * must contain the Project name, as well as the patients that are included 
	 * in the new project */
	dbOperations.prototype.addProject = function(options,user){
		assert(Object.prototype.toString.call(options) == '[object Object]',"Invalid options");
		//project info should have patient_id, details, and for future use, allowed users
		var projectInfo = options.project;
		projectInfo[dbConstants.PROJECTS.AUTH_USER_FIELD] = options.users;
		projectInfo[dbConstants.PROJECTS.DATE_ADDED] = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

		var patientTags = options.patients;
		var users = options.users;
		return this.insert(dbConstants.PROJECTS.COLLECTION, projectInfo, user).then(function(result){
			if (patientTags) {
				return Promise.each(patientTags, function(patient){
					return self.addProjectToPatient(projectInfo[dbConstants.PROJECTS.ID_FIELD],patient,user)
				});
			}	
		});
	};

	/*remove project from the collection, and remove the patient associations
	 * from all the patients in that project */
	dbOperations.prototype.removeProject = function(project,user){
		var _this = this;
		var query = {};
		query[dbConstants.PROJECTS.ID_FIELD] = project;
		return this.removeDocument(dbConstants.PROJECTS.COLLECTION,query,user)
		.then(function(){
			return _this.removePatientsFromProject(project,undefined,user);
		});
	};


	/* Add a new project to a patient by adding the project name to the tags field */
	dbOperations.prototype.addProjectToPatient = function(project,patient,user){
		assert(Object.prototype.toString.call(project) == "[object String]", "Invalid Project Name");
		assert(Object.prototype.toString.call(patient) == "[object String]", "Invalid Patient Name");

		var query = {};
		query[dbConstants.PATIENTS.ID_FIELD] = patient;
		doc = {};
		doc[dbConstants.PROJECTS.ARRAY_FIELD] = project;
		doc = {$addToSet:doc};
		return this.update(dbConstants.PATIENTS.COLLECTION, query, doc,undefined, user);
	};

	/* Remove the Tag for a project from one or more patients. Once the tag is remvoed the patient
	 * is no longer associated with the previous project in any way and will not show up in the project
	 * screen. */
	dbOperations.prototype.removePatientsFromProject = function(project, patients,user){
		var query = {};
		assert(Object.prototype.toString.call(project) == "[object String]", "Invalid Project Name");
		if (patients){
			assert(Object.prototype.toString.call(patients) == "[object Array]", "Patients must be an array");
			query[dbConstants.PATIENTS.ID_FIELD] = {$in:patients};
		} else {
			query[dbConstants.PROJECTS.ARRAY_FIELD] = project;
		}
		var doc = {};
		doc[dbConstants.PROJECTS.ARRAY_FIELD] = project;
		doc = {$pull:doc};
		var options = {multi:true};
		return this.update(dbConstants.PATIENTS.COLLECTION, query, doc, options, user).then(function(result){
			return true;
		});
	};

	/* When a  new patient is added to a project add the project to their 'tags' field, so that this patient
	 * will then be associated with the new project */
	dbOperations.prototype.addPatientsToProject = function(project, patients, user){
		assert(Object.prototype.toString.call(project) == "[object String]", "Invalid Project Name");
		assert(Object.prototype.toString.call(patients) == "[object Array]", "Patients must be an array");
		var query = {};
		query[dbConstants.PATIENTS.ID_FIELD] = {$in:patients};
		var doc = {};
		doc[dbConstants.PROJECTS.ARRAY_FIELD] = project;
		doc = {$addToSet:doc};
		var options = {multi:true};
		return this.update(dbConstants.PATIENTS.COLLECTION, query, doc, options, user).then(function(result){
			return true;
		});
	};
}