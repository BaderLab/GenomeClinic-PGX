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

	app.post("/pgx/report", utils.isLoggedIn, function(req,res){
		logger.info("Generating PGX report for " + req.body.patientID);
		genReport(req,res).catch(function(err){
			logger.error("Failed to generate report for " + req.body.patientID,err);
		});
	});


	//Send the report to the user, delete the report after it was sent.
	app.get('/pgx/download/:id',utils.isLoggedIn,function(req,res){

		var url = req.url
		var file = url.replace(/\/pgx\/download\//,"");
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

	//Genereate data to send to user for computing the PGX report. The actual computation
	//Is all done on the client side
	app.post("/pgx", utils.isLoggedIn, function(req,res){
		var currentPatientID= req.body[constants.dbConstants.PATIENTS.ID_FIELD];
		dbFunctions.getPGXVariants(currentPatientID)
		.then(function(result) {
			res.send(result);
		});
	});


	app.get(['/haplotypes','/haplotypes/new','/haplotypes/current/:hapid'],utils.isLoggedIn,function(req,res){
		utils.render(req,res);
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

	app.post('/haplotypes/current/:hapid',utils.isLoggedIn,function(req,res){

	});

	app.delete('/haplotypes/current/:hapid',utils.isLoggedIn,function(req,res){

	});

	app.post('/haplotypes/new',utils.isLoggedIn,function(req,res){

	});

};