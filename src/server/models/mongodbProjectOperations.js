var Promise = require("bluebird");
var dbConstants = require("../lib/conf/constants.json").dbConstants;
var nodeConstants = require('../lib/conf/constants.json').nodeConstants;
var utils = require("../lib/utils");

//require errors
var MissingParameterError = require("../lib/errors/MissingParameterError");
var InvalidParameterError = require("../lib/errors/InvalidParameterError");

module.exports = function(dbOperations){
	//=======================================================================================
	//Project functions
	//=======================================================================================
	

	/* Find all projects for a specific user and return the project within an array */
	utils.checkAndExtend(dbOperations, "findProjects", function(projectName, username){
		var resultArray;
		var query = {$or:[]};
		var _this = this;
		var fields = [dbConstants.PROJECTS.AUTH_USER_FIELD,dbConstants.DB.OWNER_ID];

		var promise = Promise.resolve().then(function(){
			if (!username || !utils.isString(username))
				throw new InvalidParameterError("username is required and must be a string");
			fields.forEach(function(item){
				var o = {};
				o[item] = username;
				query.$or.push(o);
			});

			if (projectName){
				query[dbConstants.PROJECTS.ID_FIELD] = projectName;
			}

			
			return _this.find(dbConstants.PROJECTS.COLLECTION,query,undefined,undefined,username).then(function(result){
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
		});
		return promise;
	});

	/* Add a new project to the database under the passed user. the The options
	 * must contain the Project name, as well as the patients that are included 
	 * in the new project */
	utils.checkAndExtend(dbOperations, "addProject", function(options,user){
		var _this = this;
		var promise = Promise.resolve().then(function(){
			if (!options)
				throw new MissingParameterError("options parameter is required");
			if (!utils.isObject(options))
				throw new InvalidParameterError("options must be an object")


			//project info should have patient_id, details, and for future use, allowed users
			var projectInfo = options.project;
			projectInfo[dbConstants.PROJECTS.AUTH_USER_FIELD] = options.users;
			projectInfo[dbConstants.PROJECTS.DATE_ADDED] = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

			var patientTags = options.patients;
			var users = options.users;
			return _this.insert(dbConstants.PROJECTS.COLLECTION, projectInfo, user).then(function(result){
				if (patientTags) {
					return Promise.each(patientTags, function(patient){
						return _this.addProjectToPatient(projectInfo[dbConstants.PROJECTS.ID_FIELD],patient,user)
					});
				}	
			});
		});
		return promise;
	});

	/*remove project from the collection, and remove the patient associations
	 * from all the patients in that project */
	utils.checkAndExtend(dbOperations, "removeProject", function(project,user){
		var _this = this;
		var query = {};
		var promise = Promise.resolve().then(function(){
			if (!project)
				throw new MissingParameterError("Project name is required");
			if (!utils.isString(project))
				throw new InvalidParameterError("Prject name must be a string");
			query[dbConstants.PROJECTS.ID_FIELD] = project;
			return _this.removeDocument(dbConstants.PROJECTS.COLLECTION,query,user)
			.then(function(){
				return _this.removePatientsFromProject(project,undefined,user);
			});
		});
		return promise;
	});


	/* Add a new project to a patient by adding the project name to the tags field */
	utils.checkAndExtend(dbOperations, "addProjectToPatient", function(project,patient,user){
		var _this = this;
		var promise = Promise.resolve().then(function(){
			if (! project || ! patient)
				throw new MissingParameterError("Requried fields are missing");
			if (!utils.isString(project))
				throw new InvalidParameterError("project must be a valid string");
			if (!utils.isString(patient))
				throw new InvalidParameterError("project must be a valid string");

			var query = {};
			query[dbConstants.PATIENTS.ID_FIELD] = patient;
			doc = {};
			doc[dbConstants.PROJECTS.ARRAY_FIELD] = project;
			doc = {$addToSet:doc};
			return _this.update(dbConstants.PATIENTS.COLLECTION, query, doc,undefined, user);
		});
		return promise;
	});

	/* Remove the Tag for a project from one or more patients. Once the tag is remvoed the patient
	 * is no longer associated with the previous project in any way and will not show up in the project
	 * screen. */
	utils.checkAndExtend(dbOperations, "removePatientsFromProject", function(project, patients,user){
		var _this = this;
		var promise = Promise.resolve().then(function(){
			var query = {};
			if (!project)
				throw new MissingParameterError("Project name is required");
			if (!utils.isString(project))
				throw new InvalidParameterError("Project name must be a valid string");
			if (patients){
				if (!utils.isArray(patients))
					throw new InvalidParameterError("Patients must be an array");

				query[dbConstants.PATIENTS.ID_FIELD] = {$in:patients};
			} else {
				query[dbConstants.PROJECTS.ARRAY_FIELD] = project;
			}
			var doc = {};
			doc[dbConstants.PROJECTS.ARRAY_FIELD] = project;
			doc = {$pull:doc};
			var options = {multi:true};
			return _this.update(dbConstants.PATIENTS.COLLECTION, query, doc, options, user).then(function(result){
				return true;
			});
		});
		return promise;
	});

	/* When a  new patient is added to a project add the project to their 'tags' field, so that this patient
	 * will then be associated with the new project */
	utils.checkAndExtend(dbOperations, "addPatientsToProject", function(project, patients, user){
		var _this = this;
		var promise = Promise.resolve().then(function(){
			if (!project || !patients)
				throw new MissingParameterError("Required parameter is missing");
			if (!utils.isString(project))
				throw new InvalidParameterError("Project name must be a valid string");
			if (!utils.isArray(patients))
				throw new InvalidParameterError("Patients must be an array");
			var query = {};
			query[dbConstants.PATIENTS.ID_FIELD] = {$in:patients};
			var doc = {};
			doc[dbConstants.PROJECTS.ARRAY_FIELD] = project;
			doc = {$addToSet:doc};
			var options = {multi:true};
			return _this.update(dbConstants.PATIENTS.COLLECTION, query, doc, options, user).then(function(result){
				return true;
			});
		});
		return promise;
	})
}