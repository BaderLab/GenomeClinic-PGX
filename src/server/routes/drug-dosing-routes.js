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

	app.post('/dosing/current/:geneID/new-interaction',function(req,res){
		var doc = req.body;
		var query = {};
		query[constants.dbConstants.DRUGS.DOSING.DRUG_FIELD] = doc.drug;
		query[constants.dbConstants.DRUGS.DOSING.FIRST_GENE] = req.params.geneID;
		query[constants.dbConstants.DRUGS.DOSING.FIRST_CLASS] = doc.class_1;
		query[constants.dbConstants.DRUGS.DOSING.SECOND_CLASS] = (doc.class_2 === undefined ? {$exists:false}:doc.class_2);
		query[constants.dbConstants.DRUGS.DOSING.SECOND_GENE] = (doc.class_2 === undefined ? {$exists:false}:doc.class_2);
		dbFunctions.findOne(constants.dbConstants.DRUGS.DOSING.COLLECTION,query).then(function(result){
			if (result == null){
				dbFunctions.insert(constants.dbConstants.DRUGS.DOSING.COLLECTION,doc)
				.then(function(result){
					req.flash('statusCode','200');
					req.flash('message','Item successfully inserted');
					res.redirect('/success');
				}).catch(function(err){
					req.flash('error',err.toString());
					res.flash('message','unable to insert item into database');
					res.flash('statusCode','500')
					res.redirect('/failure');
				});
			} else {
				req.flash('error','Item Exists alread');
				req.flash('statusCode','202');
				res.redirect('/failure')
			};
		});
	});

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