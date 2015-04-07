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
	//Check Haplotypes
	//==================================================================
	app.get('/database/haplotypes/getgenes',utils.isLoggedIn,function(req,res){
		dbFunctions.getPGXGenes().then(function(result){
			if (result)
				res.send(result);
			else 
				res.send(undefined);
		}).catch(function(err){
			console.log(err);
		});
	});

	app.get('/database/haplotypes/getgenes/:gene',utils.isLoggedIn,function(req,res){
		var gene = req.params.gene;
		dbFunctions.getPGXGenes(req.params.gene).then(function(result){
			var out = {};
			if (result){
				out.gene = gene;
				var uniqIDS = [];
				var haplotypes = result[gene];
				for (var hap in haplotypes){
					if (haplotypes.hasOwnProperty(hap)){
						for (var i=0; i < haplotypes[hap].length; i++){
							if (uniqIDS.indexOf(haplotypes[hap][i]===-1));
								uniqIDS.push(haplotypes[hap][i]);
						}
					}
				}
				dbFunctions.getPGXCoords(uniqIDS).then(function(coords){
					var o,ho = {};
					if(coords){
						for (var hap in haplotypes){
							if (haplotypes.hasOwnProperty(hap)){
								for (var i=0; i < haplotypes[hap].length; i++){

									o = coords[haplotypes[hap][i]];
									if (o !== undefined){
										o.id = haplotypes[hap][i];
										haplotypes[hap][i] = o;
									}	
									
								}
								ho[hap] = {'markers':haplotypes[hap]};
							}
						}
						out.haplotypes = ho;
						res.send(out);
					} else {
						res.send(undefined);
					}
				});
			} else {
				res.send(undefined);
			}
		});
	});

	app.get('/database/markers/getmarkers',utils.isLoggedIn,function(req,res){
		dbFunctions.getPGXCoords().then(function(result){
			if (result)
				res.send(result);
			else
				res.send(undefined);
		});
	});


	app.get('/database/markers/getmarkers/:marker',utils.isLoggedIn,function(req,res){
		var marker = req.params.marker;
		dbFunctions.getPGXCoords(marker).then(function(result){
			if (result)
				res.send(result);
			else 
				res.send(undefined);
		});
	})


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
		console.log(req.body);
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