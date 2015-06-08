var utils = require('../lib/utils');
var Promise = require('bluebird');
var fs = require('fs');
var constants = require("../lib/conf/constants.json");
var ObjectID = require("mongodb").ObjectID;
var genReport = require('../lib/genReport');
var dbFunctions = require("../models/mongodb_functions");

var dbConstants = constants.dbConstants;


/* Collection of routes associated with drug dosing recomendations
 * the report generation, and the ui modification of the recomendations
 *
 *@author Patrick Magee*/
module.exports = function(app,logger,opts){
	//Create a new blank document
	
	//Routes controlling the page navication
	//Navigating to any of these routes will cause the layout page to be rendered
	var renderRoutes = [
		'/dosing',
		'/dosing/current/:geneID',
		'/dosing/new',
		'/browsepatients/dosing/:patientID'
	];
	//==========================================================
	// Parameters
	//==========================================================
	/* Whenever geneID parameter is included in a url first ensure that the
	 * gene ID exists prior to loading information */
	app.param('geneID',function(req,res,next,geneID){
		dbFunctions.checkInDatabase(constants.dbConstants.DRUGS.ALL.COLLECTION,constants.dbConstants.DRUGS.ALL.ID_FIELD,geneID)
		.then(function(result){
			if (result)
				next();
			else
				utils.render(req,res,'notfound');
		});
	});	

	/* Whenever the uniqID is included in the url, ensure taht the UNIQUE ID 
	 * exists before continueing */
	app.param('uniqID',function(req,res,next,uniqID){
		var oID = new ObjectID(uniqID);
		var type = req.query.type;
		if (type === 'interaction'){
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
		} else if (type == 'recomendation'){
			dbFunctions.checkInDatabase(constants.dbConstants.DRUGS.FUTURE.COLLECTION,"_id",oID)
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

		}
	});


	/* Render the main web pages for dosing */
	app.get(renderRoutes,utils.isLoggedIn, function(req,res){
		utils.render(req,res);
	});

	//==========================================================
	//Dosing main page routes 
	//==========================================================
	/* Get the gene dosing recomendations for the specified gene */
	app.get('/database/dosing/genes/:geneID',utils.isLoggedIn, function(req,res){
		dbFunctions.drugs.getGeneDosing(req.params.geneID,req.user.username).then(function(result){
			res.send(result);
		});
	});

	/* get all of the current genes that have dosing recomendations */
	app.get('/database/dosing/genes', utils.isLoggedIn, function(req,res){
		dbFunctions.drugs.getGenes(req.user.username).then(function(result){	
			res.send(result);
		});
	});

	/* Get the recomendations based on the therapeutic classes of the genes within the 
	 * request body. The output is then arranged by drug. the drugs should then only have 
	 * a single recomendation */
	app.post('/database/dosing/genes',utils.isLoggedIn,function(req,res){
		var genes = req.body.genes;
		dbFunctions.drugs.getGeneDosing(genes,req.user.username).then(function(result){
			res.send(result);
		});
	});

	/* Get the therapeutic classes currently in the database */
	app.get('/database/dosing/classes',utils.isLoggedIn,function(req,res){
		var query = [{$group:{_id:null,classes:{$push:'$' + constants.dbConstants.DRUGS.CLASSES.ID_FIELD}}}];
		dbFunctions.aggregate(constants.dbConstants.DRUGS.CLASSES.COLLECTION,query,req.user.username).then(function(result){
			res.send(result);
		});
	});


	/* Update or create a new entry in the database for a specific gene. Depending on the type, the request can create a new 
	 * Interaciton (dosing recomendation) a new future recomendation, or a new haplotype association. Additionaly it can modify
	 * any of the existing as well. If the upadte is successfull the req is redirected to /success witha  message, however if it
	 * is not, it will be redirected to /failure
	 */

	app.post('/database/dosing/genes/:geneID/update',utils.isLoggedIn,function(req,res){
		var query,update,collection;
		var doc = req.body;
		var type = req.query.type;
		var id = ObjectID(req.query.id);
		var user = req.user.username;

		if (type == 'interaction') collection = dbConstants.DRUGS.DOSING.COLLECTION;
		else if (type == 'recomendation') collection = dbConstants.DRUGS.FUTURE.COLLECTION;
		else if (type == 'haplotype') collection = dbConstants.DRUGS.HAPLO.COLLECTION;

		var query = {_id:id};
		update = {$set:doc};
		dbFunctions.update(collection,query,update,undefined,user)
		.then(function(){
			req.flash('message','entry updated successfully');
			req.flash('statusCode','200');
			res.redirect('/success');
		}).catch(function(err){
			logger('error',err,{user:user});
			req.flash('error',err.toString());
			req.flash('message',err.message);
			req.flash('statusCode','500');
			res.redirect('/failure');
		});
	});

	app.post('/datase/dosing/genes/:geneID/new',utils.isLoggedIn,function(req,res){
		var query = {},collection,field;
		var doc = req.body;
		var gene = req.body.gene || req.body.genes; //it will either be an array of gene sor a single gene.
		var type = req.query.type;
		var user = req.user.username;
		
		if (type == 'interaction') {
			collection = dbConstants.DRUGS.DOSING.COLLECTION;
			field = dbConstants.DRUGS.ALL.RECOMENDATIONS;
			query[dbConstants.DRUGS.DOSING.GENES] = gene;
			query[dbConstants.DRUGS.DOSING.CLASSES] = req.body.classes;
			query[dbConstants.DRUGS.DOSING.DRUG] = req.body.drug;
		} else if (type == 'recomendation') {
			collection = dbConstants.DRUGS.FUTURE.COLLECTION;
			field = dbConstants.DRUGS.ALL.RECOMENDATIONS;
			query[dbConstants.DRUGS.FUTURE.ID_FIELD] = gene;
			query[dbConstants.DRUGS.FUTURE.CLASS] = req.body.class;
		} else if (type == 'haplotype') {
			collection = dbConstants.DRUGS.HAPLO.COLLECTION;
			field = dbConstants.DRUGS.ALL.RECOMENDATIONS;
			query[dbConstants.DRUGS.HAPLO.ID_FIELD] = gene;
			//If either the haplotype pair, or the therapeutic class for that gene is found we want
			//the search to return a new entry, so we do not overwrite the current entry;
			query.$or = [];
			var temp = {};
			temp[dbConstants.DRUGS.HAPLO.CLASS] = req.body.class;
			query.$or.push(temp);
			temp = {};
			temp[dbConstants.DRUGS.HAPLO.HAPLOTYPES] = req.body.haplotypes;
			query.$or.push(temp);
		}
		
		dbFunctions.findOne(collection,query,user).then(function(result){
			var newDoc;
			if (!result){
				dbFunctions.insert(collection,doc,user).then(function(result){
					newDoc = result;
					//now update the array of object ids in the ALL field
					var update = {$push:{}};
					var query = {};
					if (Object.prototype.toString.call(gene) == '[Object String]') gene = [gene];
					query[dbConstants.DRUGS.ALL.ID_FIELD] = {$in:gene};
					update.$push[field] = ObjectID(result._id);

					return dbFunctions.update(dbConstants.DRUGS.ALL.COLLECTION,query,update,{multi:true},user)
				}).then(function(){
					newDoc.statusCode = '200';
					newDoc.message = 'Successfully inserted document'
					res.send(newDoc);
				}).catch(function(err){
					logger('error',err,{user:user});
					req.flash('error',err.toString());
					req.flash('message',err.message);
					req.flash('statusCode','500');
					res.redirect('/failure');

				})
			} else {
				req.flash('message','Duplicate entry already exists');
				req.flash('statusCode','500');
				res.redirect('/failure');
			}
		});


	})
	

	/* Delete the entry corresponding to the type specified in the url. There are 4 defined 'Types'.
	 * All - removes the entire entry for the gene
	 * Haplotype - remove a single entry for a haplotype
	 * Future - remove a future dosing recomendation
	 * Interaction - removing a current dosing guideline.
	 */
	app.post('/database/dosing/genes/:geneID/delete',utils.isLoggedIn,function(req,res){
		var collection,user,query
		var type = req.query.type;
		var id = ObjectID(req.query.id);
		

		dbFunctions.drugs.removeEntry(id,type,user).then(function(result){
			req.flash('message','Entry Successfully removed from database');
			req.flash('statusCode','200');
			res.redirect('/success');
		}).catch(function(err){
			logger('error',err,{user:user});
			req.flash('error',err.toString());
			req.flash('message',err.message);
			req.flash('statusCode','500');
			res.redirect('/failure');

		});
	})
	/* Delete all entries corresponding to the current geneID. removes all drug recomendations
	 * for the specifi

	/* Initialize a new drug recomendation document. first checks to ensure there already is not
	 * A gene the same as newGene. if this returns false a new document is inserted with the value
	 * unitialized set to true. */
	app.post('/dosing/new/:newGene',utils.isLoggedIn,function(req,res){
		var newGene = req.params.newGene;
		dbFunctions.checkInDatabase(constants.dbConstants.DRUGS.ALL.COLLECTION,constants.dbConstants.DRUGS.ALL.ID_FIELD,newGene)
		.then(function(exists){
			if (!exists){
				dbFunctions.drugs.createNewDoc(newGene,req.user.username).then(function(result){
					if (result) {
						req.flash('statusCode','200');
						req.flash('message','Gene successfully inserted to dosing tables');
						res.redirect('/success');
					} else {
						logger('error',"Unable to create new document",{user:user});
						req.flash('statusCode','500');
						req.flash('error',"Unable to insert new document");
						req.flash('message','unable to insert new gene ' + newGene );
						res.redirect('/failure');
					}
				}).catch(function(err){
					logger('error',err,{user:user});
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
	
	/* Generate the dosing recomendation report */
	app.post('/browsepatients/dosing/:patientID/report', utils.isLoggedIn,function(req,res){
		var options = {
			top:'1cm',
			bottom:'1cm',
			left:'20px',
			rigth:'20px'
		};
		//Get future recomendations
		return genReport(req,res,req.params.patientID,constants.dbConstants.DRUGS.REPORT.DEFAULT,options)
	});

	/* Download the dosing recomendation report */
	app.get('/browsepatients/dosing/:patientID/download/:id',utils.isLoggedIn,function(req,res){
		var file = req.params.id;
		var path = constants.nodeConstants.TMP_UPLOAD_DIR + '/' + file;
		var user = req.user[constants.dbConstants.USERS.ID_FIELD];
		logger("info","Sending Report file: " + path + " to user: " + user,{user:user,action:'download',target:path}); 
		res.download(path,file,function(err){
			if (err){
				logger('error',err,{user:user});
			} else {
				var html = path.replace(/.pdf$/,'.html');
				fs.unlink(html,function(err){
					if (err)
						logger('error',err,{user:user,action:'fsunlink',target:html});
					else
						logger('info',"successfully removed report file: " + html,{user:user,action:'fsunlink',target:html});
				});
				fs.unlink(path,function(err){
					if (err)
						logger('error',err,{user:user,action:'fsunlink',target:path});
					else
						logger('info',"successfully removed report file: " + path,{user:user,action:'fsunlink',target:path});
				});
			}
		});

	});
};