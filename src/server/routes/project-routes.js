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
	var renderPages = [
		'/projects',
		'/projects/new',
		'/projects/current/:projectID'
	]

	app.get(renderPages, utils.isLoggedIn, function(req,res){
		utils.render(req,res);
	});

	//==================================================================
	//req param handlers
	//==================================================================
	app.param('projectID',function(req,res,next,projectID){
		dbFunctions.checkInDatabase(constants.dbConstants.PROJECTS.COLLECTION,constants.dbConstants.PROJECTS.ID_FIELD,projectID)
		.then(function(result){
			if (result)
				next();
			else
				utils.render(req,res,true);
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
	app.get('/database/projects/:projectID',utils.isLoggedIn,function(req,res){
		var username = req.user[dbConstants.USERS.ID_FIELD];
		dbFunctions.findProjects(req.params.projectID,username)
		.then(function(result){
			res.send(result);
		});
	});


	//FInd patients linked to a project
	app.get("/database/projects/:projectID/patients", utils.isLoggedIn, function(req,res){
		var project,exclude,promise;
		var username = req.user[dbConstants.USERS.ID_FIELD];
		var query = {};
		exclude = ('true' === req.query.exclude);
		project = req.params.projectID;
		if (exclude){
			promise =  dbFunctions.findAllPatientsNinProject(project,username,{sort:{'completed':-1}});
		} else {
			promise = dbFunctions.findAllPatientsInProject(project,{sort:{'completed':-1}});
		}
		promise.then(function(result){
			res.send(result);
		});
	});


	/* remove patients from a  project */
	app.post('/database/projects/:projectID/removepatients',utils.isLoggedIn,function(req,res){
		var project = req.params.projectID
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

	app.post('/database/projects/:projectID/addpatients',utils.isLoggedIn,function(req,res){
		var project = req.params.projectID;
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
	app.post('/projects/new',utils.isLoggedIn,function(req,res){
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
	app.post('/database/projects/:projectID/delete',utils.isLoggedIn,function(req,res){
		var query = {};
		query[dbConstants.PROJECTS.ID_FIELD] = req.params.projectID;
		dbFunctions.findOne(dbConstants.PROJECTS.COLLECTION,query)
		.then(function(result){
			/*This line essentailly gives any user the ability to modify the current project so long as they are
			 *Listed as an authorized user for that project. However once they remove a patient, if they are not
			 *The original owner, once they remove that patient they will not have access to it  This is a temp
			 *Fix until we come up with a better Idea for how the permissions should work. */
			if (result.owner == req.user[dbConstants.USERS.ID_FIELD] || result.users.indexOf(req.user[dbConstants.USERS.ID_FIELD]) !== -1){
				dbFunctions.removeProject(req.params.projectID).then(function(result){
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
	app.post('/projects/current/:projectID',utils.isLoggedIn,function(req,res){
		var query = {};
		query[dbConstants.PROJECTS.ID_FIELD] = req.params.projectID;
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
};