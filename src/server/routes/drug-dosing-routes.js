var utils = require('../lib/utils'); var Promise = require('bluebird');
var fs = require('fs');
var constants = require("../lib/conf/constants.json");
var ObjectID = require("mongodb").ObjectID;
var genReport = require('../lib/genReport');
var dbFunctions = require("../models/mongodb_functions");

var dbConstants = constants.dbConstants;


/* Collection of routes associated with drug dosing recommendations
 * the report generation, and the ui modification of the recommendations
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
	];

	//==========================================================
	// Parameters
	//==========================================================
	/* Whenever geneID parameter is included in a url first ensure that the
	 * gene ID exists prior to loading information */
	app.param('geneID',function(req,res,next,geneID){
		var query = {};
		query[constants.dbConstants.DRUGS.ALL.ID_FIELD] = geneID;
		query.useDosing = true;
		dbFunctions.findOne(constants.dbConstants.DRUGS.ALL.COLLECTION, query)
		.then(function(result){
			if (result)
				next();
			else
				utils.render(req,res,{type:'notfound'});
		});
	});	

	/* Whenever the uniqID is included in the url, ensure taht the UNIQUE ID 
	 * exists before continueing */
	app.param('uniqID',function(req,res,next,uniqID){
		var oID = new ObjectID(uniqID);
		var type = req.query.type;
		if (type === 'recommendation'){
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
		} else if (type == 'future'){
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
		utils.render(req,res,{scripts:'dosing-page.js'});
	});

	app.get('/browsepatients/dosing/:patientID',utils.isLoggedIn,function(req,res){
		utils.render(req,res,{scripts:'patients.js'})
	})
	//==========================================================
	//Dosing main page routes 
	//==========================================================
	/* Get the gene dosing recommendations for the specified gene */
	app.get('/database/dosing/genes/:gene',utils.isLoggedIn, function(req,res){
		if (req.query.type == 'true'){
			var query = {};
			query[constants.dbConstants.DRUGS.ALL.ID_FIELD] = req.params.gene;
			dbFunctions.find(constants.dbConstants.DRUGS.ALL.COLLECTION,query,undefined,undefined,req.user.username)
			.then(function(result){
				if (result.length > 0) {
					res.send(result[0][constants.dbConstants.DRUGS.ALL.TYPE])
				} else{
					res.send(null)
				}
			});
		} else {
			dbFunctions.drugs.getGeneDosing(req.params.gene,req.user.username).then(function(result){
				res.send(result);
			});
		}
	});

	/* get all of the current genes that have dosing recommendations */
	app.get('/database/dosing/genes', utils.isLoggedIn, function(req,res){
		dbFunctions.drugs.getGenes(req.user.username,'Dosing').then(function(result){	
			res.send(result);
		});
	});

	/* Get the recomnendations based on the therapeutic classes of the genes within the 
	 * request body. The output is then arranged by drug. the drugs should then only have 
	 * a single recommendation */
	app.post('/database/dosing/genes',utils.isLoggedIn,function(req,res){
		var genes = req.body.genes;
		dbFunctions.drugs.getGeneDosing(genes,req.user.username).then(function(result){
			res.send(result);
		});
	});

	/* Get the Predicted Effect  currently in the database */
	app.get('/database/dosing/classes', utils.isLoggedIn, function(req,res){
		req.user = {}
		req.user.username = 'me';
		query = {};
		//if no query pasesd this will return ALL the classes for every type
		if (req.query.id){
			query['_id'] = {$in:req.query.id.split(',')};
		}
		
		dbFunctions.find(constants.dbConstants.DRUGS.CLASSES.COLLECTION,query,undefined,undefined,req.user.username).then(function(result){
			var o = {}
			if (result){
				for (var i = 0; i < result.length; i++ ){
					o[result[i]._id] = result[i];
				}
			}
			res.send(o);
		});
	});


	/* Update an entry based on the document's ObjectID. depending on the typ, it will either update the 
	 * interaction(recommendation) the future recommendation, or the haplotype association. The update function
	 * handles the sorting of the input array in order to allow for easier matching. 
	 */
	app.post('/database/dosing/genes/:geneID/update',utils.isLoggedIn,function(req,res){
		var query,update,collection;
		var doc = req.body;
		var type = req.query.type;
		var id = ObjectID(req.query.id);
		var user = req.user.username;

		if (type == 'recommendation') {
			collection = dbConstants.DRUGS.DOSING.COLLECTION;
		} else if (type == 'future'){ 
			collection = dbConstants.DRUGS.FUTURE.COLLECTION;
		} else if (type == 'haplotype') {
			if (doc.haplotypes) doc.haplotypes = doc.haplotypes.sort();
			collection = dbConstants.DRUGS.HAPLO.COLLECTION;
		}
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
	

	/* Enter a new entry for a interaction, a future recommendation or a haplotype association on a gene wise basis.
	 * The route will first ensure that the entry being inputted is a unique entry to begin with, If an entry with 
	 * the same fields is found, the route returns a failure with a failure message. If no similar entry is found,
	 * a single entry is inserted into the corresponding collection, the Object ID is then pushed to the appropriate
	 * array for the correspoing genes */
	app.post('/database/dosing/genes/:geneID/new',utils.isLoggedIn,function(req,res){
		var query = {},collection,field;
		var doc = req.body;
		var gene = req.body.gene || req.body.genes; //it will either be an array of gene sort a single gene.
		var type = req.query.type;
		var user = req.user.username;
		
		if (type == 'recommendation') {
			collection = dbConstants.DRUGS.DOSING.COLLECTION;
			field = dbConstants.DRUGS.ALL.RECOMMENDATIONS;
			var sortedOutput = utils.sortWithIndeces(gene,doc.classes);
			gene = sortedOutput.first;
			doc.classes = sortedOutput.second;
			query[dbConstants.DRUGS.DOSING.GENES] = gene;
			query[dbConstants.DRUGS.DOSING.CLASSES] = doc.classes;
			query[dbConstants.DRUGS.DOSING.DRUG] = doc.drug;
		} else if (type == 'future') {
			collection = dbConstants.DRUGS.FUTURE.COLLECTION;
			field = dbConstants.DRUGS.ALL.FUTURE;
			query[dbConstants.DRUGS.FUTURE.ID_FIELD] = gene;
			query[dbConstants.DRUGS.FUTURE.CLASS] = doc.class;
		} else if (type == 'haplotype') {
			collection = dbConstants.DRUGS.HAPLO.COLLECTION;
			field = dbConstants.DRUGS.ALL.HAPLO;
			query[dbConstants.DRUGS.HAPLO.ID_FIELD] = gene;
			//If either the haplotype pair, or the therapeutic class for that gene is found we want
			//the search to return a new entry, so we do not overwrite the current entry;
			query[dbConstants.DRUGS.HAPLO.HAPLOTYPES] = doc.haplotypes.sort();
			
		}
		/* Ensure this is a new 'unique entry' */
		dbFunctions.findOne(collection,query,user).then(function(result){
			var newDoc;
			if (!result){
				dbFunctions.insert(collection,doc,user).then(function(result){
					newDoc = result;
					//now update the array of object ids in the ALL field
					var update = {$push:{}};
					var query = {};
					if (Object.prototype.toString.call(gene) == '[object String]') gene = [gene];
					query[dbConstants.DRUGS.ALL.ID_FIELD] = {$in:gene};
					update.$push[field] = ObjectID(result._id);
					return dbFunctions.update(dbConstants.DRUGS.ALL.COLLECTION,query,update,{multi:true},user)
				}).then(function(result){
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
	 * Haplotype - remove a single entry for a haplotype.
	 * Future - remove a future dosing recommendation
	 * recommendation - removing a current dosing guideline.
	 * Since
	 */
	app.post('/database/dosing/genes/:geneID/delete',utils.isLoggedIn,function(req,res){
		var collection,user,query
		var type = req.query.type;
		var id = ObjectID(req.query.id);
		

		dbFunctions.drugs.removeEntry(id,type,'Dosing',user).then(function(result){
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
	

	/* Initialize a new drug recommendation document. first checks to ensure there already is not
	 * A gene the same as newGene. if this returns false a new document is inserted with the value
	 * unitialized set to true. */
	app.post('/database/dosing/new',utils.isLoggedIn,function(req,res){
		var newGene = req.query.gene;
		var type = req.query.type;
		var user = req.user.username
		var from = req.query.from;
		var opposite = from == 'Haplotype' ?  "Dosing" : "Haplotype";
		var query = {};
		query[constants.dbConstants.DRUGS.ALL.ID_FIELD] = newGene;
		dbFunctions.findOne(constants.dbConstants.DRUGS.ALL.COLLECTION,query)
		.then(function(result){
			if (!result){
				dbFunctions.drugs.createNewDoc(newGene,type,from,req.user.username).then(function(result){
				if (result) {
						req.flash('statusCode','200');
						req.flash('message','Gene successfully inserted to dosing tables');
						res.redirect('/success');
					} else {
						var err = new Error("Unable to create new document")
						logger('error',err,{user:user});
						req.flash('statusCode','501');
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
				//This gene is not currently being used at all by the source, therefore update the source

				if (!result['use' + from]){
					if (result['use' + opposite] && result.type !== type){
						var err = new Error("Unable to create new gene, Gene type entered does not match existing gene type");
						logger('error',err,{user:user})
						req.flash('statusCode', '500');
						req.flash('message',"Could not create new gene because the Gene already exists and is being used for " + opposite + " information. The Type provided for the new gene does not match the type in the existing gene");
						req.flash('error','Gene already exists');
						res.redirect('/failure');
					} else {
						var update = {$set:{}}
						update.$set['use' + from] = true;
						if (result.type !== type ) update.$set.type = type;
						return dbFunctions.update(constants.dbConstants.DRUGS.ALL.COLLECTION,query,update).then(function(){
							req.flash('statusCode','200');
							req.flash('message','Gene successfully inserted to dosing tables');
							res.redirect('/success');
						});
					}
				} else {
					var err = new Error("Unable to create new document,document already exists")
					logger('error',err,{user:user})
					req.flash('statusCode', '500');
					req.flash('message',"The Gene you supplied already exists, please provide another");
					req.flash('error','Gene already exists');
					res.redirect('/failure');
				}
			}
		});
	});
	

	/* Get the Metabolic Status's based on the haplotypes of an individual */

	app.post('/database/recommendations/haplotypes/get',utils.isLoggedIn,function(req,res){
		var doc = req.body;//array with the format [{haplotypes:[],gene:''}]
		var output = [];
		var user = req.user.username;		

		Promise.resolve(doc).each(function(item){
			var query = {};
			query[constants.dbConstants.DRUGS.ALL.ID_FIELD] = item.gene;
			return dbFunctions.findOne(constants.dbConstants.DRUGS.ALL.COLLECTION,query,user)
			.then(function(result){
				if (result){
					if (result[constants.dbConstants.DRUGS.ALL.HAPLO].length > 0){
						var query = {'_id':{$in:result[constants.dbConstants.DRUGS.ALL.HAPLO]}}
						query[constants.dbConstants.DRUGS.HAPLO.HAPLOTYPES] = item.haplotypes.sort();
						return dbFunctions.findOne(constants.dbConstants.DRUGS.HAPLO.COLLECTION,query,user)
						.then(function(hapDoc){
							if (hapDoc){
								output.push(hapDoc);
							} else {
								item.class = undefined;
								output.push(item);
							}
						});
					} else {
						item.class = undefined;
						output.push(item);
					}
				} else {
					item.class = undefined;
					output.push(item);	
				}
			});
		}).then(function(){
			res.send(output);
		});
	});
	

	/* When a drugRecommendation report is generated, the  server will remember all of the haplotype / therapeutic class
	 * combination pairs. It will automatically associate those pairst with the gene, and remove the current association 
	 * for that haplotype if there is one */
	app.post('/database/recommendations/haplotypes/set',utils.isLoggedIn, function(req,res){
		var doc = req.body;
		var user = req.user.username
		var query = {};
		
		var collection = dbConstants.DRUGS.HAPLO.COLLECTION;
		var field = dbConstants.DRUGS.ALL.HAPLO;
		query[dbConstants.DRUGS.HAPLO.ID_FIELD] = doc.gene;
		//If either the haplotype pair, or the therapeutic class for that gene is found we want
		//the search to return a new entry, so we do not overwrite the current entry;
		query[dbConstants.DRUGS.HAPLO.HAPLOTYPES] = doc.haplotypes.sort();
		dbFunctions.findOne(collection,query,user).then(function(result){
			var newDoc;
			if (!result){
				dbFunctions.insert(collection,doc,user).then(function(result){
					newDoc = result;
					var query = {};
					query[constants.dbConstants.DRUGS.ALL.ID_FIELD] = newDoc.gene;

					return dbFunctions.findOne(constants.dbConstants.DRUGS.ALL.COLLECTION,query,user);
				}).then(function(result){
					if (!result){
						return dbFunctions.drugs.createNewDoc(newDoc.gene,user)
					} else return result
				}).then(function(result){
					//now update the array of object ids in the ALL field
					var query = {_id:result._id};
					var update = {$push:{}};
					update.$push[field] = ObjectID(newDoc._id);
					return dbFunctions.update(dbConstants.DRUGS.ALL.COLLECTION,query,update,{multi:true},user)
				}).then(function(result){
					res.send(newDoc);
				}).catch(function(err){
					logger('error',err,{user:user});
					req.flash('statusCode','500');
					req.flash('error',err.toString());
					req.flash('message','unable to remove all entries relating to ' + newGene );
					res.redirect('/failure');

				});
			} else {
				var err = new Error("Unable to create new document,document already exists")
				logger('error',err,{user:user})
				req.flash('statusCode', '500');
				req.flash('message',"The Gene you supplied already exists, please provide another");
				req.flash('error','Gene already exists');
				res.redirect('/failure');
			}
		});
	})

	
	/* Generate the possible recommendations for a patient based on the haplotype profile of that patient 
	 * As well as the Metabolic status for the patient. return  all recommendations in a drug wise manner.
	 * Ideally, return only a single recommendation per drug. */
	app.post('/database/recommendations/recommendations/get',utils.isLoggedIn, function(req,res){
		var toGet = req.body; //(should be gene / clas object);
		var recIDS = [];
		var geneComb={};
		var recByDrug = {};
		var finalRecommendations = [];
		var user = req.user.username;

		for (var i = 0; i < toGet.length; i++ ){
			geneComb[toGet[i].gene] = toGet[i].class;
		}
		Promise.resolve(toGet).each(function(item){
			var query = {}
			query[constants.dbConstants.DRUGS.ALL.ID_FIELD] = item.gene;
			return dbFunctions.findOne(constants.dbConstants.DRUGS.ALL.COLLECTION,query,user)
			.then(function(result){
				if (result){
					recIDS = recIDS.concat(result[constants.dbConstants.DRUGS.ALL.RECOMMENDATIONS])
				}
			})
		}).then(function(){
			//get all recommendation documents for the current gene sets//
			var query = {'_id':{$in:recIDS}};
			return dbFunctions.find(constants.dbConstants.DRUGS.DOSING.COLLECTION,query,undefined,undefined,user);
		}).then(function(result){
			var set;
			//Cycle through the results and genereate a list of prospective candidates. always take the potential 
			//Recommendation that is reliant on more genes.
			for (var i = 0; i < result.length; i++ ){
				set = true;
				for (var j = 0; j < result[i][constants.dbConstants.DRUGS.DOSING.GENES].length; j++ ){
					if (geneComb[result[i][constants.dbConstants.DRUGS.DOSING.GENES][j]] != result[i][constants.dbConstants.DRUGS.DOSING.CLASSES][j]){
						set = false;
					}
				}
				if (set){
					if (recByDrug.hasOwnProperty(result[i][constants.dbConstants.DRUGS.DOSING.DRUG])){
						if (recByDrug[result[i][constants.dbConstants.DRUGS.DOSING.DRUG]][constants.dbConstants.DRUGS.DOSING.GENES].length < result[i][constants.dbConstants.DRUGS.DOSING.GENES].length ){
							recByDrug[result[i][constants.dbConstants.DRUGS.DOSING.DRUG]] = result[i];
						}
					} else {
						recByDrug[result[i][constants.dbConstants.DRUGS.DOSING.DRUG]] = result[i];
					}
				}

			}
			var keys = Object.keys(recByDrug);
			for ( i = 0; i < keys.length; i++ ){
				finalRecommendations.push(recByDrug[keys[i]]);
			}
		}).then(function(){
			res.send(finalRecommendations);
		});
	});
	
	/* Get all of the future recommendations */
	app.post('/database/recommendations/future/get',utils.isLoggedIn,function(req,res){
		var toGet = req.body;
		var user = req.user.username;
		var finalFuture = [];
		var genes = [];
		var query = {};
		for (var i = 0; i < toGet.length; i++ ){
			genes.push(toGet[i].gene);
		}
		query[constants.dbConstants.DRUGS.ALL.ID_FIELD] = {$in:genes};
		dbFunctions.find(constants.dbConstants.DRUGS.ALL.COLLECTION,query,undefined,undefined,user)
		.each(function(item){
			if (item[constants.dbConstants.DRUGS.ALL.FUTURE].length > 0){
				var futureIDs = item[constants.dbConstants.DRUGS.ALL.FUTURE];
				var mClass = toGet[genes.indexOf(item[constants.dbConstants.DRUGS.ALL.ID_FIELD])].class;
				var query = {'_id':{$in:futureIDs}};
				query[constants.dbConstants.DRUGS.FUTURE.CLASS] = mClass;
				return dbFunctions.findOne(constants.dbConstants.DRUGS.FUTURE.COLLECTION,query,user).then(function(result){
					if(result)
						finalFuture.push(result);
				});
			}
		}).then(function(result){
			res.send(finalFuture);
		});
	})
	
	/* Generate the dosing recommendation report */
	app.post('/browsepatients/dosing/:patientID/report', utils.isLoggedIn,function(req,res){
		var options = {
			top:'1cm',
			bottom:'1cm',
			left:'20px',
			rigth:'20px'
		};

		//get disclaimer
		dbFunctions.findOne(constants.dbConstants.DB.ADMIN_COLLECTION,{}).then(function(result){
			req.body.disclaimer = result.disclaimer;
			return genReport(req,res,req.params.patientID,constants.dbConstants.DRUGS.REPORT.DEFAULT,options,logger)
		});
	});

	/* Download the dosing recommendation report */
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