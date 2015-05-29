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