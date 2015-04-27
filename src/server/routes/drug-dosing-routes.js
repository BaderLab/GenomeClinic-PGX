var utils = require('../lib/utils');
var Promise = require('bluebird');
var fs = require('fs');
var constants = require("../lib/conf/constants.json");
var genReport  = require('../lib/pgx-report');
var ObjectID = require("mongodb").ObjectID;


module.exports = function(app,dbFunctions,logger){
	if (!dbFunctions)
		dbFunctions = rquire("../models/mongodb_functions");


	var renderRoutes = [
		'/dosing',
		'/dosing/current/:geneID',
		'/dosing/new'
	];
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

	app.param('uniqID',function(req,res,next,uniqID){
		var oID = new ObjectID(uniqID);
		dbFunctions.checkInDatabase(constants.dbConstants.DRUGS.DOSING.COLLECTION,"_id",oID)
		.then(function(result){
			if (result) {
				next();
			} else {
				req.flash('statusCode', '404');
				req.flash('message','Could not find ID for table');
				req.flash('error','Entry not found');
				res.redirect('/failure');
			}
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
				drug = result[i].drug;
				if (!drugOutput.hasOwnProperty(drug)){
					drugOutput[drug] = [];
				}
				if (result[i].unitialized){
					options.unitialized = true;
				}
				drugOutput[drug].push(result[i]);
			}

			options.drugs = drugOutput;
			return options;
		}).then(function(){
			var query = [{$group:{_id:null,classes:{$push:'$' + constants.dbConstants.DRUGS.CLASSES.ID_FIELD}}}];
			return dbFunctions.aggregate(constants.dbConstants.DRUGS.CLASSES.COLLECTION,query);
			//add dropdown menu selections
		}).then(function(result){
			options.classes = result[0].classes;
			options.allRisk = ['Low','Medium','High'];
			options.gene = req.params.geneID;
		}).then(function(){
			res.send(options);
		});
	});

	app.post('/dosing/current/:geneID/new-interaction',utils.isLoggedIn, function(req,res){
		var unitialized = req.query.unitialized === 'true';
		var options,promise;
		var doc = req.body;
		var query = {};
		//If it is unitialized, replace the unitialized document with a new one.
		if ( unitialized ){
			var newDoc = {};
			query[constants.dbConstants.DRUGS.DOSING.FIRST_GENE] = req.params.geneID;
			query[constants.dbConstants.DRUGS.DOSING.UNITIALIZED] = true;
			newDoc.$unset = {unitialized:1};
			newDoc.$set = doc;
			
			promise = dbFunctions.update(constants.dbConstants.DRUGS.DOSING.COLLECTION,query,newDoc)
			.then(function(){
				return dbFunctions.findOne(constants.dbConstants.DRUGS.DOSING.COLLECTION, doc).then(function(result){
					if (result)
						options = result;
					else
						throw new Error("Could Not update unitialized document");
				});
			});
		} else {
			query[constants.dbConstants.DRUGS.DOSING.DRUG_FIELD] = doc.drug;
			query[constants.dbConstants.DRUGS.DOSING.FIRST_GENE] = req.params.geneID;
			query[constants.dbConstants.DRUGS.DOSING.FIRST_CLASS] = doc.class_1;
			query[constants.dbConstants.DRUGS.DOSING.SECOND_CLASS] = (doc.class_2 === undefined ? {$exists:false}:doc.class_2);
			query[constants.dbConstants.DRUGS.DOSING.SECOND_GENE] = (doc.class_2 === undefined ? {$exists:false}:doc.class_2);
			promise = dbFunctions.findOne(constants.dbConstants.DRUGS.DOSING.COLLECTION,query).then(function(result){
				if (result === null){
					return dbFunctions.insert(constants.dbConstants.DRUGS.DOSING.COLLECTION,doc)
					.then(function(result){
						options = result;
					});
				} else {
					throw new Error("Entry for the provided genes and therapeutic classes already exists within the database. Please modify the existing entry or change the parameters.");
				}
			});
		}

		//return the rest of the information
		promise.then(function(){
			var query = [{$group:{_id:null,classes:{$push:'$' + constants.dbConstants.DRUGS.CLASSES.ID_FIELD}}}];
			return dbFunctions.aggregate(constants.dbConstants.DRUGS.CLASSES.COLLECTION,query);
			//add dropdown menu selections
		}).then(function(result){
			options.classes = result[0].classes;
			options.allRisk = ['Low','Medium','High'];
			options.gene = req.params.geneID;
		}).then(function(){
			options.statusCode = 200;
			options.message = 'Item successfully inserted';
			res.send(options);
		}).catch(function(err){
			req.flash('error',err.toString());
			req.flash('message',err.message);
			req.flash('statusCode','500');
			res.redirect('/failure');
		});
	});
	
	//Update a current dosing table, but only if the update does not conflict with an already existant dosing table
	app.post('/database/dosing/genes/:geneID/update/:uniqID',utils.isLoggedIn,function(req,res){
		var doc = req.body;
		var query = {};
		var gene = req.params.geneID;
		var uniqID = req.params.uniqID;
		var oID = new ObjectID(uniqID);
		query[constants.dbConstants.DRUGS.DOSING.DRUG_FIELD] = doc.drug;
		query[constants.dbConstants.DRUGS.DOSING.FIRST_GENE] = doc.pgx_1;
		query[constants.dbConstants.DRUGS.DOSING.FIRST_CLASS] = doc.class_1;
		query[constants.dbConstants.DRUGS.DOSING.SECOND_CLASS] = (doc.class_2 === undefined ? {$exists:false}:doc.class_2);
		query[constants.dbConstants.DRUGS.DOSING.SECOND_GENE] = (doc.pgx_2 === undefined ? {$exists:false}:doc.pgx_2);
		query._id = {$ne:oID};
		dbFunctions.findOne(constants.dbConstants.DRUGS.DOSING.COLLECTION,query).then(function(result){
			if (result === null){
				var update = {$set:{},$unset:{}};
				//required fields
				update.$set[constants.dbConstants.DRUGS.DOSING.FIRST_GENE] = doc.pgx_1;
				update.$set[constants.dbConstants.DRUGS.DOSING.FIRST_CLASS] = doc.class_1;
				update.$set[constants.dbConstants.DRUGS.DOSING.RECOMENDATION] = doc.rec;
				update.$set[constants.dbConstants.DRUGS.DOSING.RISK] = doc.risk;

				//optional required,ents
				if (doc.pgx_2 === undefined ) update.$unset[constants.dbConstants.DRUGS.DOSING.SECOND_GENE]=1;
				else update.$set[constants.dbConstants.DRUGS.DOSING.SECOND_GENE]=doc.pgx_2;
				if (doc.class_2 === undefined) update.$unset[constants.dbConstants.DRUGS.DOSING.SECOND_CLASS]=1;
				else update.$set[constants.dbConstants.DRUGS.DOSING.SECOND_CLASS]=doc.class_2;
				if (doc.hap_1 === undefined) update.$unset[constants.dbConstants.DRUGS.DOSING.FIRST_HAP]=1;
				else update.$set[constants.dbConstants.DRUGS.DOSING.FIRST_HAP]=doc.hap_1;
				if (doc.pgx_2 === undefined ) update.$unset[constants.dbConstants.DRUGS.DOSING.SECOND_HAP]=1;
				else update.$set[constants.dbConstants.DRUGS.DOSING.SECOND_HAP]=doc.hap_2;
				return dbFunctions.update(constants.dbConstants.DRUGS.DOSING.COLLECTION,{_id:oID},update)
				.then(function(result){
					req.flash('statusCode','200');
					req.flash('message','Item successfully updated');
					res.redirect("/success");
				}).catch(function(err){
					req.flash('statusCode','500');
					req.flash('message',err.message);
					req.flash('error',err.toString());
					res.redirect('/failure');
				});
			} else {
				req.flash('statusCode','202');
				req.flash('message',"Entry for the provided genes and therapeutic classes already exists within the database. Please modify the existing entry or change the parameters.");
				req.flash('error',"Error: Duplicate Entry");
				res.redirect('/failure');
			}
		});


	});
	
	app.post('/database/dosing/genes/:geneID/deleteid/:uniqID',utils.isLoggedIn,function(req,res){
		var _id = new ObjectID(req.params.uniqID);
		dbFunctions.drugs.removeSingleEntry(_id)
		.then(function(){
			req.flash('statusCode','200')
			req.flash('message','successfully removed 1 entry related to ' + req.params.geneID);
			res.redirect('/success');
		}).catch(function(err){
			console.log(err.stack);
			req.flash('statusCode','500');
			req.flash('error',err.toString());
			req.flash('message','unable to remove entries');
			res.redirect('/failure');
		});
	});

	app.post('/database/dosing/genes/:geneID/deleteall',utils.isLoggedIn,function(req,res){
		var gene = req.params.geneID;
		dbFunctions.drugs.removeGeneEntry(gene)
		.then(function(){
			req.flash('statusCode','200');
			req.flash('message','successfully deleted all dosing recomendations for ' + gene);
			res.redirect('/success');
		}).catch(function(err){
			req.flash('statusCode','500');
			req.flash('error',err.toString());
			req.flash('message','unable to remove all entries relating to ' + gene );
			res.redirect('/failure');
		});
	});

	app.post('/dosing/new/:newGene',utils.isLoggedIn,function(req,res){
		var newGene = req.params.newGene;
		var newDoc = {unitialized:true};
		newDoc[constants.dbConstants.DRUGS.DOSING.FIRST_GENE] = newGene;
		dbFunctions.checkInDatabase(constants.dbConstants.DRUGS.DOSING.COLLECTION,constants.dbConstants.DRUGS.DOSING.FIRST_GENE,newGene)
		.then(function(exists){
			if (!exists){
				dbFunctions.insert(constants.dbConstants.DRUGS.DOSING.COLLECTION, newDoc)
				.then(function(result){
					if (result) {
						req.flash('statusCode','200'),
						req.flash('message','Gene successfully inserted to dosing tables');
						res.redirect('/success');
					} else {
						req.flash('statusCode','500');
						req.flash('error',"Unable to insert new document");
						req.flash('message','unable to insert new gene ' + newGene );
						res.redirect('/failure');
					}
				}).catch(function(err){
					req.flash('statusCode','500');
					req.flash('error',err.toString());
					req.flash('message','unable to remove all entries relating to ' + newGene );
					res.redirect('/failure');
				});
			} else {
				req.flash('statusCode', '500');
				req.flash('message',"The Gene you supplied already exists, please provide another");
				req.flash('error','Gene already exists');
				res.redirect('/failure');
			}
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