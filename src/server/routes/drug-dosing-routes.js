var utils = require('../lib/utils');
var Promise = require('bluebird');
var fs = require('fs');
var constants = require("../lib/conf/constants.json");
var ObjectID = require("mongodb").ObjectID;
var genReport = require('../lib/genReport');



/* Collection of routes associated with drug dosing recomendations
 * the report generation, and the ui modification of the recomendations
 *
 *@author Patrick Magee*/
module.exports = function(app,dbFunctions,logger){
	//Ensure the dbfunctions module is loaded
	if (!dbFunctions)
		dbFunctions = rquire("../models/mongodb_functions");

	//Create a new blank document
	createNewDoc = function(gene){
		var promise = new Promise(function(resolve,reject){
			var newDoc = {};
			newDoc[constants.dbConstants.DRUGS.DOSING.ID_FIELD] = gene;
			newDoc[constants.dbConstants.DRUGS.DOSING.RECOMENDATIONS] = {};
			newDoc[constants.dbConstants.DRUGS.DOSING.HAPLO] = {};
			newDoc[constants.dbConstants.DRUGS.DOSING.FUTURE] = {};
			return dbFunctions.insert(constants.dbConstants.DRUGS.DOSING.COLLECTION,newDoc)
			.then(function(result){
				resolve(result);
			}).catch(function(err){
				reject(err);
			})
		});

		return promise;
	}
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
		dbFunctions.checkInDatabase(constants.dbConstants.DRUGS.DOSING.COLLECTION,constants.dbConstants.DRUGS.DOSING.ID_FIELD,geneID)
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
		dbFunctions.drugs.getGeneDosing(req.params.geneID).then(function(result){
			res.send(result);
		});
	});

	/* get all of the current genes that have dosing recomendations */
	app.get('/database/dosing/genes', utils.isLoggedIn, function(req,res){
		dbFunctions.drugs.getGenes().then(function(result){
			res.send(result);
		});
	});

	/* Get the recomendations based on the therapeutic classes of the genes within the 
	 * request body. The output is then arranged by drug. the drugs should then only have 
	 * a single recomendation */
	app.post('/database/dosing/genes',utils.isLoggedIn,function(req,res){
		var genes = req.body.genes;
		dbFunctions.drugs.getGeneDosing(genes).then(function(result){
			res.send(result);
		});
	});

	/* Get the therapeutic classes currently in the database */
	app.get('/database/dosing/classes',utils.isLoggedIn,function(req,res){
		var query = [{$group:{_id:null,classes:{$push:'$' + constants.dbConstants.DRUGS.CLASSES.ID_FIELD}}}];
		dbFunctions.aggregate(constants.dbConstants.DRUGS.CLASSES.COLLECTION,query).then(function(result){
			res.send(result);
		});
	});


	/* Update or create a new entry in the database for a specific gene. Depending on the type, the request can create a new 
	 * Interaciton (dosing recomendation) a new future recomendation, or a new haplotype association. Additionaly it can modify
	 * any of the existing as well. If the upadte is successfull the req is redirected to /success witha  message, however if it
	 * is not, it will be redirected to /failure
	 */
	app.post('/database/dosing/genes/:geneID/update',utils.isLoggedIn,function(req,res){
		var doc = req.body;
		var string,query,update;
		var type = req.query.type;
		var newdoc = req.query.newdoc == "true" ? true : false;
		var backstring;

		//Add or update a dosing recomednation
		if (type == "interaction"){
			query = {};
			update = {$set:{}};
			var updateObj = {};

			//Generate the query string. You can search through nested objectes by conecting a string with dots and setting as the query in mongodb
			string = constants.dbConstants.DRUGS.DOSING.RECOMENDATIONS + '.' + doc.drug + '.' + doc.class_1;
			if (doc.class_2 && doc.pgx_2){
				//In this case we are going to serach through the secondary parameter, as well as serach in the reverse direction, since a secondary gene is included
				string += ".secondary." +  doc.pgx_2 + "." + doc.class_2;
				backstring = constants.dbConstants.DRUGS.DOSING.RECOMENDATIONS + '.' + doc.drug + '.' + doc.class_2 + '.secondary.' + doc.pgx_1 + '.' + doc.class_1;
			}
			//Set the query for the gene and then reqrieve the gene informatino
			query[constants.dbConstants.DRUGS.DOSING.ID_FIELD] = req.params.geneID;
			dbFunctions.drugs.getGeneDosing(req.params.geneID).then(function(result){
				//generate the document that is to be updated
				var obj = utils.createNestedObject(string,result,doc);

				//if his is a new document and the incoming obj is not new, reject it
				if (newdoc && !obj.isNew){
					// this is a terminal document meaning that the therapeutic classs already exists adn this is an update
					req.flash('statusCode','202');
					req.flash('message',"Entry for the provided genes and therapeutic classes already exists within the database. Please modify the existing entry or change the parameters.");
					req.flash('error',"Error: Duplicate Entry");
					res.redirect('/failure');
					
				} else {
					//update the entry
					update.$set[obj.depth]  = obj.cont;
					dbFunctions.update(constants.dbConstants.DRUGS.DOSING.COLLECTION,query,update)
					.then(function(){
						if (backstring){
							//similarily if there is a second interaciton, update (or create if necessary) the corresponding relationship
						 	query[constants.dbConstants.DRUGS.DOSING.ID_FIELD] = doc.pgx_2;
						 	dbFunctions.drugs.getGeneDosing(doc.pgx_2).then(function(result){
						 		if (!result){
						 			return createNewDoc(doc.pgx_2).then(function(){
						 				return dbFunctions.drugs.getGeneDosing(doc.pgx_2);
						 			})
								} else {
									return result;
								}
							}).then(function(result){
						 		var obj = utils.createNestedObject(backstring,result,doc);
						 		var update = {$set:{}};
						 		update.$set[obj.depth] = obj.cont;
						 		return dbFunctions.update(constants.dbConstants.DRUGS.DOSING.COLLECTION,query,update);
							});
						}	
					}).then(function(){
						req.flash('message','entry updated successfully');
						req.flash('statusCode','200');
						res.redirect('/success');
					}).catch(function(err){
						req.flash('error',err.toString());
						req.flash('message',err.message);
						req.flash('statusCode','500');
						res.redirect('/failure');
					});
				}
			});

		// This is a future recomendation.
		} else if (type == 'recomendation'){
			//first check to ensure that the entry is unique;
			string = constants.dbConstants.DRUGS.DOSING.FUTURE + '.' + doc.Therapeutic_Class;
			query = {};
			query[constants.dbConstants.DRUGS.DOSING.ID_FIELD] = req.params.geneID;
			query[string] = {$exists:true};

			dbFunctions.findOne(constants.dbConstants.DRUGS.DOSING.COLLECTION,query)
			.then(function(result){
				// if this is supposed to be a new doc inform the user an entry already exists
				if ( newdoc === true && result !== null ){
					req.flash('statusCode','202');
					req.flash('message',"Entry for the provided genes and therapeutic classes already exists within the database. Please modify the existing entry or change the parameters.");
					req.flash('error',"Error: Duplicate Entry");
					res.redirect('/failure');
				} else {
					//update the document with a new entry
					query = {};
					query[constants.dbConstants.DRUGS.DOSING.ID_FIELD] = req.params.geneID;
					update = {$set:{}};
					update.$set[string] = doc.future[doc.Therapeutic_Class];
					return dbFunctions.update(constants.dbConstants.DRUGS.DOSING.COLLECTION,query,update)
					.then(function(){
						req.flash('statusCode', '200');
						req.flash('message', "Entry successfully added");
						res.redirect('/success');
					});
				}
			}).catch(function(err){
				req.flash('statusCode','500');
				req.flash('message','An error was encountered when attempting to insert the new entry into the database');
				req.flash('error',err.toString());
				res.redirect('/failure');
			});

		// this is the ahplotype associations
		} else if (type == "haplotype") {
			string = constants.dbConstants.DRUGS.DOSING.HAPLO + '.' + doc.class;
			query = {};
			query[constants.dbConstants.DRUGS.DOSING.ID_FIELD] = req.params.geneID;
			query[string] = {$exists:true};

			//check to se eif the entry exists
			dbFunctions.findOne(constants.dbConstants.DRUGS.DOSING.COLLECTION,query).then(function(result){
				//if this is a new doc and a result wass found inform the user that it already exsits
				if (result !== null && newdoc === true){
					req.flash('statusCode','202');
					req.flash('message',"Entry for the provided genes and therapeutic classes already exists within the database. Please modify the existing entry or change the parameters.");
					req.flash('error',"Error: Duplicate Entry");
					res.redirect('/failure');
				} else {
					//update
					query = {};
					query[constants.dbConstants.DRUGS.DOSING.ID_FIELD] = req.params.geneID;
					update = {$set:{}};
					update.$set[string] = doc.haplotypes[doc.class];	
					return dbFunctions.update(constants.dbConstants.DRUGS.DOSING.COLLECTION,query,update)
					.then(function(result){
						req.flash('statusCode','200');
						req.flash('message','Entry Successfully Added');
						res.redirect('/success');
					});
				}
			}).catch(function(err){
				req.flash('statusCode','500');
				req.flash('message','An error was encountered when attempting to insert the new entry into the database');
				req.flash('error',err.toString());
				res.redirect('/failure');
			});
		}
	});
	

	/* Delete the entry corresponding to the type specified in the url. There are 4 defined 'Types'.
	 * All - removes the entire entry for the gene
	 * Haplotype - remove a single entry for a haplotype
	 * Future - remove a future dosing recomendation
	 * Interaction - removing a current dosing guideline.
	 */
	app.post('/database/dosing/genes/:geneID/delete',utils.isLoggedIn,function(req,res){
		var type = req.query.type;
		var doc = req.body;
		var promise, message;
		var string,backstring,query,update;
		if (type === 'all'){
			promise = dbFunctions.drugs.removeGeneEntry(req.params.geneID).then(function(result){
				message = 'Successfully removed single ' + type + ' entry for ' + req.params.geneID;
				return result;
			});
			
		} else {
			promise = dbFunctions.drugs.getGeneDosing(req.params.geneID).then(function(geneObj){
				query = {};
				query[constants.dbConstants.DRUGS.DOSING.ID_FIELD] = req.params.geneID;
				if (type == 'interaction'){
					string = constants.dbConstants.DRUGS.DOSING.RECOMENDATIONS +'.' + doc.drug + '.' + doc.class_1;
					if (doc.pgx_2){
						string += '.secondary.' + doc.pgx_2  + '.' + doc.class_2
						backstring = constants.dbConstants.DRUGS.DOSING.RECOMENDATIONS + '.' + doc.drug +'.' + doc.class_2 + '.secondary.' + doc.pgx_1 + doc.class_1;						
					}
				} else if (type == 'recomendation'){
					string = constants.dbConstants.DRUGS.DOSING.FUTURE + '.' + doc.Therapeutic_Class;
				} else if (type == 'haplotype'){
					string = constants.dbConstants.DRUGS.DOSING.HAPLO + '.' + doc.Therapeutic_Classl;
				}

				update = utils.createNestedObject(string,geneObj,{},true);
				return dbFunctions.update(constants.dbConstants.DRUGS.DOSING.COLLECTION,query,update)
				.then(function(result){
					if (backstring){
						return dbFunctions.drugs.getGeneDosing(doc.pgx_2).then(function(result){
							update = utils.createNestedObject(backstring,result,{},true);
							query[constants.dbConstants.DRUGS.DOSING.ID_FIELD] = doc.pgx_2;
							return dbFunctions.update(constants.dbConstants.DRUGS.DOSING.COLLECTION,query,update);
						})
					} else {
						return result;
					}
				}).then(function(result){
					message = "Successfully removed entries from database";
					return result;
				});
			});
		}

		promise.then(function(){
			req.flash('statusCode','200');
			req.flash('message',message);
			res.redirect('/success');
		}).catch(function(err){
			req.flash('statusCode','500');
			req.flash('error',err.toString());
			req.flash('message','unable to remove entries');
			res.redirect('/failure');
		});
	});
	/* Delete all entries corresponding to the current geneID. removes all drug recomendations
	 * for the specifi

	/* Initialize a new drug recomendation document. first checks to ensure there already is not
	 * A gene the same as newGene. if this returns false a new document is inserted with the value
	 * unitialized set to true. */
	app.post('/dosing/new/:newGene',utils.isLoggedIn,function(req,res){
		var newGene = req.params.newGene;
		dbFunctions.checkInDatabase(constants.dbConstants.DRUGS.DOSING.COLLECTION,constants.dbConstants.DRUGS.DOSING.ID_FIELD,newGene)
		.then(function(exists){
			if (!exists){
				createNewDoc(newGene).then(function(result){
					if (result) {
						req.flash('statusCode','200');
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
	
	/* Generate the dosing recomendation report */
	app.post('/browsepatients/dosing/:patientID/report', utils.isLoggedIn,function(req,res){
		var options = {
			top:'1cm',
			bottom:'1cm',
			left:'20px',
			rigth:'20px'
		};
		//Get future recomendations
		logger.info("Generating PGX report for " + req.params.patientID);
		return genReport(req,res,req.params.patientID,constants.dbConstants.DRUGS.REPORT.DEFAULT,options)
		.catch(function(err){
			logger.error("Failed to generate report for " + req.params.patientID,err);
		});
	});

	/* Download the dosing recomendation report */
	app.get('/browsepatients/dosing/:patientID/download/:id',utils.isLoggedIn,function(req,res){
		var file = req.params.id;
		var path = constants.nodeConstants.TMP_UPLOAD_DIR + '/' + file;
		logger.info("Sending Report file: " + path + " to user: " + req.user[constants.dbConstants.USERS.ID_FIELD]); 
		res.download(path,file,function(err){
			if (err){
				logger.error("Report file: " + path + " failed to send to user:  " + req.user[constants.dbConstants.USERS.ID_FIELD],err);
			} else {
				var html = path.replace(/.pdf$/,'.html');
				fs.unlink(html,function(err){
					if (err)
						logger.error("Failed to remove report file: " + html,err);
					else
						logger.info("successfully removed report file: " + html);
				});
				fs.unlink(path,function(err){
					if (err)
						logger.error("Failed to remove report file: " + path,err);
					else
						logger.info("successfully removed report file: " + path);
				});
			}
		});

	});
};