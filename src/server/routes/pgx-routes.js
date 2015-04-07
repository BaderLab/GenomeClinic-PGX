/* Routes to handle the pgx app
 * @author Ron Ammar
 */
var utils = require('../lib/utils');
var Promise = require('bluebird');
var fs = require('fs');
var constants = require("../lib/conf/constants.json");
var genReport  = require('../lib/pgx-report');


module.exports = function(app,dbFunctions,logger){
	if (!dbFunctions)
		dbFunctions = rquire("../models/mongodb_functions");
	//==================================================================
	//PGX routes
	//==================================================================
	//Generate the report with the incoming data contained within the request.
	//This is done in order to properly format the printed output report

	//browse all patients and serve patient page
	var renderRoutes = [
		'/browsepatients',
		'/browsepatients/id/:patientID',
		'/haplotypes',
		'/haplotypes/new',
		'/haplotypes/current/:hapid'//,
		//'/markers'
	];

	app.get(renderRoutes,utils.isLoggedIn,function(req,res){
		utils.render(req,res);
	});


	//Parameter Handlers
	app.param('patientID',function(req,res,next,patientID){
		dbFunctions.checkInDatabase(constants.dbConstants.PATIENTS.COLLECTION,constants.dbConstants.PATIENTS.ID_FIELD,patientID)
		.then(function(result){
			if (result)
				next();
			else
				res.render(req,res,true);
		});
	});


	app.param('hapid',function(req,res,next,hapid){
		dbFunctions.checkInDatabase(constants.dbConstants.PGX.GENES.COLLECTION,constants.dbConstants.PGX.GENES.ID_FIELD,hapid)
		.then(function(result){
			if (result)
				next();
			else
				utils.render(req,res,true);
		});
	});


	app.get("/database/pgx/:patientID", utils.isLoggedIn, function(req,res){
		dbFunctions.getPGXVariants(req.params.patientID)
		.then(function(result){
			res.send(result);
		});
	});
	
	app.post("/browsepatients/id/:patiendID/report", utils.isLoggedIn, function(req,res){
		logger.info("Generating PGX report for " + req.params.patientID);
		genReport(req,res).catch(function(err){
			logger.error("Failed to generate report for " + req.body.patientID,err);
		});
	});

	//Send the report to the user, delete the report after it was sent.
	app.get('/browsepatients/id/:patientID/download/:id',utils.isLoggedIn,function(req,res){
		var file = req.params.id;
		var path = constants.nodeConstants.SERVER_DIR + '/' + constants.nodeConstants.TMP_UPLOAD_DIR + '/' + file;
		logger.info("Sending Report file: " + path + " to user: " + req.user[constants.dbConstants.USERS.ID_FIELD]); 
		res.download(path,file,function(err){
			if (err){
				logger.error("Report file: " + path + " failed to send to user:  " + req.user[constants.dbConstants.USERS.ID_FIELD],err);
			} else {
				var html = path.replace(/.pdf$/,'.html');
				fs.unlink(html,function(err){
					if (err)
						logger.error("Failed to remove report file: " + html,err);
				});
				fs.unlink(path,function(err){
					if (err)
						logger.error("Failed to remove report file: " + path,err);
				});
			}
		});
	});

	//app.get(['/haplotypes','/haplotypes/new','/haplotypes/current/:hapid'],utils.isLoggedIn,function(req,res){
	//	utils.render(req,res);
	//});
	app.post('/haplotypes/current/:hapid',utils.isLoggedIn,function(req,res){
		dbFunctions.updatePGXGene(req.params.hapid,req.body)
		.then(function(result){
			//Flash Data
			res.redirect("/success");
		}).catch(function(err){
			//Flash Data
			res.redirect("/failure");
		});

	});

	app.delete('/haplotypes/current/:hapid',utils.isLoggedIn,function(req,res){
		var id = req.params.hapid;
		dbFunctions.removePGXGene(id)
		.then(function(result){
			if (result){
				res.send(true);
			} else {
				res.send(false);
			}
		}).catch(function(err){
			res.redirect(false);
		});

	});

	app.post('/haplotypes/new',utils.isLoggedIn,function(req,res){
		dbFunctions.insert(constants.dbConstants.PGX.GENES.COLLECTION,req.body)
		.then(function(result){
			if (result){
				res.redirect('/success');
			} else {
				res.redirect('/failure');
			}
		}).catch(function(err){
			res.redirect('/failure');
		});
	});

	//app.get('/markers',utils.isLoggedIn,function(req,res){
	//	utils.render(req,res);
	//});

	app.post('/markers/current/:marker',utils.isLoggedIn,function(req,res){
		var marker = req.params.marker;
		var info = req.body;
		var query = {};
		query[constants.dbConstants.PGX.COORDS.ID_FIELD] = marker;
		dbFunctions.updatePGXCoord(marker,info)
		.then(function(result){
			if (result){
				res.redirect('/success');
			} else {
				res.redirect('/failure');
			}
		}).catch(function(err){
			res.redirect('/failure');
		});
	});
	app.post('/markers/new',utils.isLoggedIn,function(req,res){
		dbFunctions.insert(constants.dbConstants.PGX.COORDS.COLLECTION,req.body)
		.then(function(result){
			if (result){
				res.redirect('/success');
			} else {
				res.redirect('/failure');
			}
		}).catch(function(err){
			res.redirect('/failure');
		});
	});

	app.get('/markers*',utils.isLoggedIn,function(req,res){
		utils.render(req,res,'construction');
	});
};