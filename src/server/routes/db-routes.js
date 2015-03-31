/* Routes related to modifying or retrieving information
 * from the linked database. Contains functions for Projects
 * Patients, etc.
 * @author Patrick Magee
 * @author Ron Ammar
 */
var utils = require('../lib/utils');
var Promise= require("bluebird");
var constants = require('../lib/conf/constants.json');

var nodeConstant = constants.nodeConstants,
	dbConstants = constants.dbConstants;

module.exports = function(app,dbFunctions,queue){
	if (!dbFunctions)
		dbFunctions = require("../models/mongodb_functions");
	if (!queue){
		var logger = require('../lib/logger')('node');
		var Queue = require("../lib/queue");
		queue = new Queue(logger,dbFunctions);
	}

	//==================================================================
	//Database find routes
	//==================================================================

	app.use("/database/getPatients", utils.isLoggedIn, function(req,res){
		var username = req.user[dbConstants.USERS.ID_FIELD];
		dbFunctions.findAllPatientIds(username)
		.then(function(result){
			var fieldsArray = [];
			queue.queue.map(function(item){
				fieldsArray = fieldsArray.concat(item.fields);
			});
			return result.concat(fieldsArray);
		}).then(function(result){
			res.send(result);
		});
	});





	//==================================================================
	//Projects Routes
	//==================================================================

	/* retrieve ALl projects for a given user */
	app.get('/database/projects',utils.isLoggedIn, function(req,res){
		var username = req.user[dbConstants.USERS.ID_FIELD];

		dbFunctions.findProjects(undefined,username)
		.then(function(result){
			res.send(result);
		});
	});

	/* find information on a specific project */
	app.post('/database/projects',utils.isLoggedIn,function(req,res){
		var username = req.user[dbConstants.USERS.ID_FIELD];
		var project;
		if (req.body){
			project = req.body[dbConstants.PROJECTS.ID_FIELD];
		}

		dbFunctions.findProjects(project,username)
		.then(function(result){
			res.send(result);
		});
	});

	/* remove patients from a  project */
	app.post('/database/projects/removepatients',utils.isLoggedIn,function(req,res){
		var project = req.body.project;
		var patients = req.body.patients;
		dbFunctions.removePatientsFromProject(project,patients)
		.then(function(success){
			if (success){
				req.flash('statusCode','200');
				res.redirect('/success');
			}
		}).catch(function(err){
			console.log(err);
			req.flash('error',err);
			res.redirect('/failure');
		});
	});

	/* add patients to a project
	*/

	app.post('/database/projects/addpatients',utils.isLoggedIn,function(req,res){
		var project = req.body.project;
		var patients = req.body.patients;
		dbFunctions.addPatientsToProject(project,patients)
		.then(function(success){
			if (success){
				req.flash('statusCode','200');
				res.redirect('/success');
			}
		}).catch(function(err){
			console.log(err);
			req.flash('error',err);
			res.redirect('/failure');
		});
	});


	/* add a project
	 */
	app.post('/database/projects/add',utils.isLoggedIn,function(req,res){
		req.body.project[dbConstants.DB.OWNER_ID] = req.user[dbConstants.USERS.ID_FIELD];
			dbFunctions.addProject(req.body)
			.then(function(){
				req.flash('redirectURL','/projects');
				req.flash('statusCode','200');
				res.redirect('/success');
			}).catch(function(err){
				console.log(err);
				req.flash('error',err);
				res.redirect('/failure');
			});
	});

	/* delete the project, but only if the request is submitted by
	 * the owner of the project */
	app.post('/database/projects/delete',utils.isLoggedIn,function(req,res){
		var query = {};
		query[dbConstants.PROJECTS.ID_FIELD] = req.body.project;
		dbFunctions.findOne(dbConstants.PROJECTS.COLLECTION,query)
		.then(function(result){
			/*This line essentailly gives any user the ability to modify the current project so long as they are
			 *Listed as an authorized user for that project. However once they remove a patient, if they are not
			 *The original owner, once they remove that patient they will not have access to it  This is a temp
			 *Fix until we come up with a better Idea for how the permissions should work. */
			if (result.owner == req.user[dbConstants.USERS.ID_FIELD] || result.users.indexOf(req.user[dbConstants.USERS.ID_FIELD]) !== -1){
				dbFunctions.removeProject(req.body.project).then(function(result){
					req.flash('redirectURL','/projects');
					req.flash('statusCode','200');
					res.redirect('/success');
				}).catch(function(err){
					req.flash('error',err);
					res.redirect('/failure');
				});
			} else {
				req.flash('error','Sorry, for security reasons only the original owner of the project may delete it');
				res.redirect('/failure');
			}
		});
	});

	/* update a project */
	app.post('/database/project/update',utils.isLoggedIn,function(req,res){
		var query = {};
		query[dbConstants.PROJECTS.ID_FIELD] = req.body.project;
		dbFunctions.findOne(dbConstants.PROJECTS.COLLECTION,query)
		.then(function(result){
			/*This line essentailly gives any user the ability to modify the current project so long as they are
			 *Listed as an authorized user for that project. However once they remove a patient, if they are not
			 *The original owner, once they remove that patient they will not have access to it  This is a temp
			 *Fix until we come up with a better Idea for how the permissions should work. */
			if (result.owner == req.user[dbConstants.USERS.ID_FIELD] || result.users.indexOf(req.user[dbConstants.USERS.ID_FIELD]) !== -1){
				dbFunctions.update(dbConstants.PROJECTS.COLLECTION,query,{$set:req.body.update})
				.then(function(result){
					req.flash('redirectURL','/projects');
					req.flash('statusCode','200');
					res.redirect('/success');
				}).catch(function(err){
					req.flash('error',err);
					res.redirect('/failure');
				});
			} else {
				req.flash('error','Sorry, for security reasons only the original owner of the project may modify it');
				res.redirect('/failure');
			}
		});
	});

	//==================================================================
	//Patient Routes
	//==================================================================
	//Find only the completed patients
	app.get("/database/patients/completed", utils.isLoggedIn, function(req,res){
		var username = req.user[dbConstants.USERS.ID_FIELD];
		dbFunctions.findAllPatients(username,true,{sort: {"completed": -1}})
		.then(function(result){
			res.send(result);
		});

	});


	//FInd patients linked to a project
	app.post("/database/patients/project", utils.isLoggedIn, function(req,res){
		var project,exclude,promise;
		var username = req.user[dbConstants.USERS.ID_FIELD];
		var query = {};
		if (req.body.exclude){
			promise =  dbFunctions.findAllPatientsNinProject(req.body.project,username,{sort:{'completed':-1}});
		} else {
			promise = dbFunctions.findAllPatientsInProject(req.body.project,{sort:{'completed':-1}});
		}
		promise.then(function(result){
			res.send(result);
		});
	});


	/* Find ALL patients including those in the queue and failure db */
	app.use('/database/patients/all',utils.isLoggedIn, function(req,res){
		var username = req.user[dbConstants.USERS.ID_FIELD];
		dbFunctions.findAllPatients(username, false, {sort:{'completed':-1}})
		.then(function(result){
			//append all the 
			var fieldsArray = [];
			for (var i=queue.queue.length-1; i>= 0; i--){
				for ( var j=0; j < queue.queue[i].fields.length; j++){
					if (queue.queue[i].fields[j][dbConstants.DB.OWNER_ID] == username)
						fieldsArray.push(queue.queue[i].fields[j]);
				}
			}
			return fieldsArray.concat(result);
		}).then(function(result){
			res.send(result.sort(function(a,b){
				a = a.added.split(/\s/);
				b = b.added.split(/\s/);
				if (a[0] < b[0]){
					return 1;
				} else if (a[0] > b[0]) {
					return -1;
				} else {
					if (a[1] < b[1])
						return 1;
					else if (a[1] > b[1])
						return -1;
					return 0;
				}
			}));
		});
	});


	//==================================================================
	//Check Haplotypes
	//==================================================================
	app.get('/databse/haplotypes/getGenes',utils.isLoggedIn,function(req,res){
		dbFunctions.getPGXGenes().then(function(result){
			if (result)
				res.send(result);
			else 
				res.send(undefined);
		}).catch(function(err){
			console.log(err);
		});
	});

	//==================================================================
	//Generic Database routes
	//==================================================================
	// get the owner of a document
	app.post('/database/owner',utils.isLoggedIn,function(req,res){
		var user = req.user[dbConstants.USERS.ID_FIELD];
		var collection = req.body.collection;
		var query = req.body.query;
		dbFunctions.getOwner(collection,query)
		.then(function(result){
			if (result);
				var _o = {
					owner:result,
					isOwner:(user==result),
					user:user
				};
				res.send(_o);
		}).catch(function(err){
			console.log(err);
		});
	});

	/* checkt to see whether the content within the body is within the database
	 *  returns true/false */
	app.post('/database/checkInDatabase',utils.isLoggedIn,function(req,res){
		var options = req.body;
		if (options.collection == dbConstants.PATIENTS.COLLECTION && options.field == dbConstants.PATIENTS.ID_FIELD){
			for (var i=queue.queue.length-1; i>= 0; i--){
				for ( var j=0; j < queue.queue[i].fields.length; j++){
					if(queue.queue[i].fields[dbConstants.PATIENTS.ID_FIELD] == options.value){
						res.send(true);
						return true;
					}

				}
			}
		}
		dbFunctions.checkInDatabase(options.collection,options.field,options.value)
		.then(function(result){
			res.send(result);
		});
	});
};