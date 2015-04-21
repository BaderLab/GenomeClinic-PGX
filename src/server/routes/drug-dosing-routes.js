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
	//==========================================================
	// Parameterd
	//==========================================================
	app.param('geneID',function(req,res,next,geneID){
		dbFunctions.checkInDatabase(constants.dbConstants.DRUGS.DOSING.COLLECTION,constants.dbConstants.DRUGS.DOSING.FIRST_GENE,geneID)
		.then(function(result){
			if (result)
				next();
			else
				utils.render(req,res,'notfound');
		});
	});	




	app.get(renderRoutes,utils.isLoggedIn, function(req,res){
		utils.render(req,res);
	});

	//==========================================================
	//Dosing main page routes 
	//==========================================================
	app.get('/dosing/current/:geneID/content',function(req,res){
		var options={};
		dbFunctions.drugs.getGeneDosing(req.params.geneID).then(function(result){
			var drugOutput = {};
			var drug;
			for ( var i=0; i<result.length; i++ ){
				drug = result[i].drug
				if (!drugOutput.hasOwnProperty(drug)){
					drugOutput[drug] = [];
				}
				drugOutput[drug].push(result[i]);
			}
			return options.drugs = drugOutput;
		}).then(function(){
			var query = [{$group:{_id:null,classes:{$push:'$' + constants.dbConstants.DRUGS.CLASSES.ID_FIELD}}}];
			return dbFunctions.aggregate(constants.dbConstants.DRUGS.CLASSES.COLLECTION,query);
			//add dropdown menu selections
		}).then(function(result){
			options.classes = result[0].classes;
			options.risk = ['Low','Medium','High'];
			options.gene = req.params.geneID;
		}).then(function(){
			res.send(options);
		});
	})
	app.get('/database/dosing/genes/:geneID',utils.isLoggedIn, function(req,res){
		dbFunctions.drugs.getGeneDosing(req.params.geneID).then(function(result){
			res.send(result);
		});
	});

	app.get('/database/dosing/genes', utils.isLoggedIn, function(req,res){
		dbFunctions.drugs.getGenes().then(function(result){
			res.send(result);
		});
	});
	

};