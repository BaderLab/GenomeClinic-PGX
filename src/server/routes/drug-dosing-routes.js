var utils = require('../lib/utils');
var Promise = require('bluebird');
var fs = require('fs');
var constants = require("../lib/conf/constants.json");
var genReport  = require('../lib/pgx-report');


module.exports = function(app,dbFunctions,logger){
	if (!dbFunctions)
		dbFunctions = rquire("../models/mongodb_functions");


	var renderRoutes = [
		'/dosing',
		'/dosing/current/:geneID',
		'/dosing/new'
	]

	app.use(renderRoutes,utils.isLoggedIn, function(req,res){
		utils.render(req,res);
	});


	//==========================================================
	//Dosing main page routes 
	//==========================================================

	app.use('/database/dosing/genes', function(req,res){
		dbFunctions.drugs.getGenes().then(function(result){
			res.send(result);
		});
	});
};