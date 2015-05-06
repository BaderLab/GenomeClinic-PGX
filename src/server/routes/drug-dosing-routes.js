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
		dbFunctions.checkInDatabase(constants.dbConstants.DRUGS.DOSING.COLLECTION,constants.dbConstants.DRUGS.DOSING.FIRST_GENE,geneID)
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


	/* Render the main web pages for dosing */
	app.get(renderRoutes,utils.isLoggedIn, function(req,res){
		utils.render(req,res);
	});

	//==========================================================
	//Dosing main page routes 
	//==========================================================
	/* Load all of the dosing recomendation and content for the current
	 * gene within the url. The function returns a JSON object with the
	 * results ordered by drug name. additionally attached to the result 
	 * object is information on classes as well as risk levels */
	app.get('/dosing/current/:geneID/content',function(req,res){
		var options={};
		dbFunctions.drugs.getGeneDosing(req.params.geneID).then(function(result){
			var drugOutput = {};
			var drug;
			//arrange results by drug
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
			//Get all of the classes
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

	/* Add a new drug interaction to the current gene with a drug
	 * First it is checked wheather the current gene has been initialized or not. Unitialzed genes
	 * have no entries the document is updated in place instead of adding a new document.
	 * Next it is ensured thatt he new interaction is a unique interaction within the database
	 * if this check succeeeds a new document is added to the correspoinding drugRecomendation table
	 * the response is redirected to either success or failure paths */
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
		//Has previously been initialized, and therefore a new document will be added after it is checked whether or not there is current an existing matching entry
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
	
	/* Update a current dosing table using the uniqID id to correspond to a specific document
	 * within database. Once the drug recomendation document is found the properties are updated
	 * with those contained in the request body. The result is redirected to either a  success or a 
	 * failure url
	 */
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
		//ensure the updated entry does not already exists prior to inserting it
		dbFunctions.findOne(constants.dbConstants.DRUGS.DOSING.COLLECTION,query).then(function(result){
			if (result === null){
				var update = {$set:{},$unset:{}};
				//required fields
				update.$set[constants.dbConstants.DRUGS.DOSING.FIRST_GENE] = doc.pgx_1;
				update.$set[constants.dbConstants.DRUGS.DOSING.FIRST_CLASS] = doc.class_1;
				update.$set[constants.dbConstants.DRUGS.DOSING.RECOMENDATION] = doc.rec;
				update.$set[constants.dbConstants.DRUGS.DOSING.RISK] = doc.risk;

				//optional fields only added if they are present
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
	

	/* Delete the current Drug dosing recomendation corresponding to the uniqID.
	 */
	app.post('/database/dosing/genes/:geneID/deleteid/:uniqID',utils.isLoggedIn,function(req,res){
		var _id = new ObjectID(req.params.uniqID);
		dbFunctions.drugs.removeSingleEntry(_id)
		.then(function(){
			req.flash('statusCode','200')
			req.flash('message','successfully removed 1 entry related to ' + req.params.geneID);
			res.redirect('/success');
		}).catch(function(err){
			req.flash('statusCode','500');
			req.flash('error',err.toString());
			req.flash('message','unable to remove entries');
			res.redirect('/failure');
		});
	});


	/* Delete all entries corresponding to the current geneID. removes all drug recomendations
	 * for the specified gene */
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

	/* Initialize a new drug recomendation document. first checks to ensure there already is not
	 * A gene the same as newGene. if this returns false a new document is inserted with the value
	 * unitialized set to true. */
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


	/* Get the therapeutic classes currently in the database */
	app.get('/database/dosing/classes',utils.isLoggedIn,function(req,res){
		var query = [{$group:{_id:null,classes:{$push:'$' + constants.dbConstants.DRUGS.CLASSES.ID_FIELD}}}];
		dbFunctions.aggregate(constants.dbConstants.DRUGS.CLASSES.COLLECTION,query).then(function(result){
			res.send(result);
		});
	});

	/* Check to see if there is a dosing recomendation for the specified gene and haplotype combination
	 * if there is a haplotype then return the associated therapeutic class. If tehre is no haplotype
	 * return none.
	 */
	app.post('/database/dosing/classes/current',utils.isLoggedIn,function(req,res){
		var data = req.body;
		var output = {};
		Promise.each(data,function(item){
			var query = {$or:[]};
			var temp = {};
			temp[constants.dbConstants.DRUGS.DOSING.FIRST_HAP] = {
				allele_1:item.hap.allele_1,
				allele_2:item.hap.allele_2
			}
			query.$or.push(temp);
			temp[constants.dbConstants.DRUGS.DOSING.FIRST_HAP] = {
				allele_1:item.hap.allele_2,
				allele_2:item.hap.allele_1
			}
			query.$or.push(temp);
			query[constants.dbConstants.DRUGS.DOSING.FIRST_GENE] = item.gene; 
			return dbFunctions.findOne(constants.dbConstants.DRUGS.DOSING.COLLECTION,query).then(function(result){
				if (result){
					output[result[constants.dbConstants.DRUGS.DOSING.FIRST_GENE]] = {
						class:result[constants.dbConstants.DRUGS.DOSING.FIRST_CLASS]
					}
				}
			});
		}).then(function(){
			res.send(output);
		});
	});

	/* Get the recomendations based on the therapeutic classes of the genes within the 
	 * request body. The output is then arranged by drug. the drugs should then only have 
	 * a single recomendation */
	app.post('/database/dosing/recomendations/current',utils.isLoggedIn,function(req,res){
		var data = req.body;
		var query = {$in:[]}
		var out = [];
		var geneClass = {};
		Promise.each(data,function(item){
			geneClass[item.gene] = item.class;
			return dbFunctions.drugs.getGeneDosing(item.gene,item.class).then(function(result){
				out = out.concat(result);
			});
		}).then(function(){
			var drugArrOut = {};
			for (var i = 0; i < out.length; i++){
				if (out[i][constants.dbConstants.DRUGS.DOSING.SECOND_GENE]){
					if (geneClass[out[i].drug] == out[i][constants.dbConstants.DRUGS.DOSING.SECOND_GENE]) {
						if (!drugArrOut.hasOwnProperty(out[i].drug))
							drugArrOut[out[i].drug] = [];
						drugArrOut[out[i].drug].push(out[i]);
					}
				} else {
					if (!drugArrOut.hasOwnProperty(out[i].drug))
							drugArrOut[out[i].drug] = [];
					drugArrOut[out[i].drug].push(out[i]);
				}
			}
			res.send(drugArrOut);	
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
		logger.info("Generating PGX report for " + req.params.patientID);
		genReport(req,res,req.params.patientID,constants.dbConstants.DRUGS.REPORT.DEFAULT,options).catch(function(err){
			logger.error("Failed to generate report for " + req.params.patientID,err);
		});
	});

	/* Download the dosing recomendation report */
	app.get('/browsepatients/dosing/:patientID/download/:id',utils.isLoggedIn,function(req,res){
		var file = req.params.id;
		var path = constants.nodeConstants.TMP_UPLOAD_DIR + '/' + file;
		//req.flash('statusCode','500');
		//res.redirect('/failure');
		logger.info("Sending Report file: " + path + " to user: " + req.user[constants.dbConstants.USERS.ID_FIELD]); 
		res.download(path,file,function(err){
			if (err){
				logger.error("Report file: " + path + " failed to send to user:  " + req.user[constants.dbConstants.USERS.ID_FIELD],err);
			} else {
				var html = path.replace(/.pdf$/,'.html');
				//fs.unlink(html,function(err){
				//	if (err)
				//		logger.error("Failed to remove report file: " + html,err);
				//});
				//fs.unlink(path,function(err){
				//	if (err)
				//		logger.error("Failed to remove report file: " + path,err);
				//});
			}
		});

	});

};