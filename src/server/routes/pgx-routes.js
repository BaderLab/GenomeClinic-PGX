/* Routes to handle the pgx app
 * @author Ron Ammar
 */
var utils = require('../lib/utils');
var Promise = require('bluebird');
var fs = require('fs');
var constants = require("../lib/conf/constants.json");
var genReport  = require('../lib/genReport');
var dbFunctions = require('../models/mongodb_functions');
var getRS = require('../lib/getDbSnp');
var ObjectId = require('mongodb').ObjectID;



module.exports = function(app,logger,opts){
	//==================================================================
	//PGX routes
	//==================================================================
	//Generate the report with the incoming data contained within the request.
	//This is done in order to properly format the printed output report

	//browse all patients and serve patient page
	var patientRenderRoutes = [
		'/browsepatients',
		'/browsepatients/id/:patientID'
	];
	var haplotypeRenderRoutes = [
		'/haplotypes',
		'/haplotypes/new',
		'/haplotypes/current/:hapid'
		
	];

	//send the bare template for all the routes and add the appropriate js to each template
	app.get(patientRenderRoutes,utils.isLoggedIn,function(req,res){
		utils.render(req,res,{scripts:'patients.js'});
	});

	app.get(haplotypeRenderRoutes,utils.isLoggedIn,function(req,res){
		utils.render(req,res,{scripts:'phase-page.js'});
	});

	app.get('/markers',utils.isLoggedIn,function(req,res){
		utils.render(req,res,{scripts:'markers-page.js'});
	});


	//Parameter Handlers. When these parameters are within the URL, use the callback they defined
	app.param('patientID',function(req,res,next,patientID){
		dbFunctions.checkInDatabase(constants.dbConstants.PATIENTS.COLLECTION,constants.dbConstants.PATIENTS.ID_FIELD,patientID)
		.then(function(result){
			if (result)
				next();
			else
				utils.render(req,res,{type:'notfound'});
		});
	});


	app.param('hapid',function(req,res,next,hapid){
		dbFunctions.checkInDatabase(constants.dbConstants.DRUGS.ALL.COLLECTION,constants.dbConstants.DRUGS.ALL.ID_FIELD,hapid)
		.then(function(result){
			if (result)
				next();
			else
				utils.render(req,res,{type:'notfound'});
		});
	});


	/* For the given patient, retieve all the PGx Variants from the server that relate
	 * to that patient */
	app.get("/database/pgx/:patientID", utils.isLoggedIn, function(req,res){
		dbFunctions.getPGXVariants(req.params.patientID,req.user.username)
		.then(function(result){
			res.send(result);
		});
	});
	
	/* Generate a pdf report of the PGx Analaysis for a specific patient. The req body contains all the information from the
	 * PGx analysis that was conducted on the server side */
	app.post("/browsepatients/id/:patientID/report", utils.isLoggedIn, function(req,res){
		var options = {
			top:'1cm',
			bottom:'1cm',
			left:'20px',
			rigth:'20px'
		};
		genReport(req,res,req.params.patientID,constants.dbConstants.PGX.REPORT.DEFAULT,options,logger)
	});


	/* Once the report has been generated with the previous path, the user is sent a link that they can use to
	 * download the report that was just genereated. This Route serves that report and then subsequently deletes the temp
	 * report afterwards
	 */
	app.get('/browsepatients/id/:patientID/download/:id',utils.isLoggedIn,function(req,res){
		var file = req.params.id;
		var path = constants.nodeConstants.TMP_UPLOAD_DIR + '/' + file;
		logger('info',"Sending Report file: " + path + " to user: " + req.user[constants.dbConstants.USERS.ID_FIELD],{user:req.user.username,action:'download'}); 
		res.download(path,file,function(err){
			if (err){
				logger("error",err,{user:req.user.username,target:path,action:'download'});
			} else {
				var html = path.replace(/.pdf$/,'.html');
				fs.unlink(html,function(err){
					if (err)
						logger("error",err,{user:req.user.username,target:html,action:'unlink'});
				});
				fs.unlink(path,function(err){
					if (err)
						logger("error",err,{user:req.user.username,target:path,action:'unlink'});
				});
			}
		});
	});

	/* using the hapID update a single Haplotype entry within the pgxGene database. this
	 * will update the specific entry with the contents of the req.body
	 */
	app.post('/haplotypes/current/:hapid',utils.isLoggedIn,function(req,res){
		dbFunctions.updatePGXGene(req.params.hapid,req.body,req.user.username)
		.then(function(result){
			//Flash Data
			res.redirect("/success");
		}).catch(function(err){
			//Flash Data
			res.redirect("/failure");
		});

	});


	/* Delete the specifie haplotype within the :hapid parameterd */
	app.post('/database/haplotypes/delete',utils.isLoggedIn,function(req,res){
		var gene = req.query.gene;
		var type = req.query.type;

		if (type == 'all'){
			dbFunctions.removePGXGene(gene,req.user.username)
			.then(function(result){
				console.log(result);
				if (result){
					res.redirect('/success');
				} else {
					res.redirect('/failure');
				}
			}).catch(function(err){
				console.log(err.stack);
				res.redirect('/failure');
			});
		} else {
			var id = ObjectId(req.query.id);
			dbFunctions.removePGXHaplotype(id,gene,req.user.username)
			.then(function(result){
				if (result)
					res.redirect('/success');
				else
					res.redirect('/failure');
			}).catch(function(err){
				console.log(err);
				req.flash('message',err.message);
				req.flash('error',err.stack);
				res.redirect('/failure');
			});
		}

	});


	/*Add a new haplotype. The body is already formatted in the correct manner and the entry is simply
	* inserted into the db.
	*/
	app.post('/database/haplotypes/new',utils.isLoggedIn,function(req,res){
		var name = req.query.id
		var gene = req.query.gene
		var query = {}
		query[constants.dbConstants.PGX.GENES.ID_FIELD] = name;
		query[constants.dbConstants.PGX.GENES.GENE] = gene;
		dbFunctions.findOne(constants.dbConstants.PGX.GENES.COLLECTION,query,req.user.username)
		.then(function(exists){
			if (exists){
				req.flash('message','Haplotype already exists');
				req.flash('error','haplotype already exists');
				res.redirect('/failure');
				return
			} else {
				var doc = {};
				doc[constants.dbConstants.PGX.GENES.ID_FIELD] = name;
				doc[constants.dbConstants.PGX.GENES.GENE] = gene;
				doc[constants.dbConstants.PGX.GENES.MARKERS] = []
				dbFunctions.insert(constants.dbConstants.PGX.GENES.COLLECTION,doc,req.user.username).then(function(result){
					if (result){
						result.status = 'ok';
						result.statusCode ='200';

						var update = {$push:{}};
						update.$push[constants.dbConstants.DRUGS.ALL.CURRENT_HAPLO] = result._id;

						var query = {};
						query[constants.dbConstants.DRUGS.ALL.ID_FIELD] = gene;

						dbFunctions.update(constants.dbConstants.DRUGS.ALL.COLLECTION,query,update,undefined,req.user.username)
						.then(function(updated){
							if (updated){
								res.send(result);
							} else {
								req.flash('message','Something went wrong when updating haplotype array for ' + gene);
								res.redirect('/failure');
							}
						});
				} else {
						req.flash('message','Something went wrong when adding the new haplotype');
						res.redirect('/failure');
					}
				}).catch(function(err){
					req.flash('message','Something went wrong when adding the new haplotype');
					res.redirect('/failure');
				})
			}
		
		});
	});
	
	/* update the markers that are associated with a gene for a haplotype. Either add or 
	 * removed the markers */
	app.post('/database/haplotypes/markers',utils.isLoggedIn,function(req,res){
		var added = req.body.added;
		var removed = req.body.removed;
		var gene = req.query.gene;

		Promise.resolve().then(function(){
			if (added.length > 0){
				return dbFunctions.addMarkerToGene(added,gene,req.user.username);
			}
			return true;
		}).then(function(result){
			if (removed.length){
				return dbFunctions.removeMarkerFromGene(removed,gene,req.user.username);
			}
			return true;
		}).then(function(){
			res.redirect('/success');
		}).catch(function(err){
			console.log(err.stack);
			req.flash('message',err.message);
			req.flash('error',err.stack);
			res.redirect('/failure');
		})

	});

	/* Update the haplotype for a specific Id */
	app.post('/database/haplotypes/update',utils.isLoggedIn,function(req,res){
		var doc = req.body;
		var query = {_id:ObjectId(doc._id)};
		delete doc._id;
		dbFunctions.update(constants.dbConstants.PGX.GENES.COLLECTION,query,doc,undefined,req.user.username)
		.then(function(result){
			if (result){
				res.redirect('/success')
			} else {
				res.redirect('/failure')
			}
		}).catch(function(err){
			req.flash('message',err.message);
			req.flash("error",err.stack);
			res.redirect('/failure');
		});
	});

	//Get a list of all the current haploytpes and geenes
	app.get('/database/haplotypes/getgenes',utils.isLoggedIn,function(req,res){
		dbFunctions.drugs.getGenes(req.user.username).then(function(result){	
			res.send(result);
		});
	})
		
	//get information for a specific gene and return it in the required format
	app.get('/database/haplotypes/getgenes/:gene',utils.isLoggedIn,function(req,res){
		var gene = req.params.gene;
		var query = {}
		var out = {};
		var incMarkers;
		query[constants.dbConstants.DRUGS.ALL.ID_FIELD] = gene
		dbFunctions.find(constants.dbConstants.DRUGS.ALL.COLLECTION,query,undefined,undefined,req.user.username)
		.then(function(result){
			var ids = result[0][constants.dbConstants.DRUGS.ALL.CURRENT_HAPLO];
			incMarkers = result[0][constants.dbConstants.DRUGS.ALL.MARKERS];
			return dbFunctions.find(constants.dbConstants.PGX.GENES.COLLECTION,{_id:{$in:ids}},undefined,undefined,req.user.username)
		}).then(function(result){
			out.haplotypes = result;
			var query = {$or:[{_id:{$in:incMarkers}},{asgenes:gene},{asgenes:{$size:0}}]};
			return dbFunctions.find(constants.dbConstants.PGX.COORDS.COLLECTION,query,undefined,undefined,req.user.username)
		}).then(function(result){
			out.amarkers = [] // all associated markers
			out.markers = incMarkers; // unique markers
			out.allMarkers = {}
			out.unMarkers =  []// unassociated markers
			for (var i = 0; i < result.length; i++){
				if (result[i].asgenes.length > 0 )
					out.amarkers.push(result[i]._id)
				else
					out.unMarkers.push(result[i]._id);

				out.allMarkers[result[i]._id] = result[i];
			}

			out.gene = gene;
			var marker;
			var temp = [];
			if (out.haplotypes.length > 0){
				for (var i = 0; i < out.haplotypes.length; i++ ){
					for (var j = 0; j < out.haplotypes[i].markers.length; j++ ){
						marker = out.haplotypes[i].markers[j]
						if (out.markers.indexOf(marker) == -1) out.markers.push(marker);
					}
				}
				out.markers = out.markers.sort();
				// For each haplotype add the information for markers
				for (var i = 0; i < out.haplotypes.length; i++ ){
					temp = [];
					for (var j = 0; j < out.markers.length; j++ ){
						//This marker is present in the current haplotype
						if (out.haplotypes[i].markers.indexOf(out.markers[j]) !== -1 ){
							//Check to see if the marker is an associated gene, or an 
							//Unassociated gene and then add that information to it
							if (out.allMarkers.hasOwnProperty(out.markers[j])){
								temp.push(out.allMarkers[out.markers[j]]);
							} else {
								out.error = {
									message:"Non-existant Marker found, please review Database",
									statusCode:"500"
								};
								res.send(out);
								return false;
							}

						} else {
							temp.push({
								_id:out.markers[j],
								dummy:true
							});
						}
						out.allMarkers[out.markers[j]].added = true;

					}
					out.haplotypes[i].markers = temp;
				}
				
			}


			if (out.unMarkers.length == 0 ){
				delete out.umMarkers
			} else {
			}

			if (out.amarkers == 0 ){
				delete out.amarkers
			}

			res.send(out);
			return;
		});
	});

	//Update the current marker
	app.post('/database/markers/update',utils.isLoggedIn,function(req,res){
		var marker = req.query.id;
		var type = req.query.type
		var info = req.body;
		var query = {};
		if (type == 'dbsnp'){
			dbFunctions.updatedbSnpPGXCoords(marker).then(function(result){
				res.send(result);
			}).catch(function(err){
				req.flash('error',err);
				req.flash('message',err.message);
				res.redirect('/falire');
			});
		} else if (type == 'custom'){

			query[constants.dbConstants.PGX.COORDS.ID_FIELD] = marker;
			dbFunctions.updatePGXCoord(marker,{$set:info},req.user.username)
			.then(function(result){
				if (result){

					res.redirect('/success');
				} else {
					res.redirect('/failure');
				}
			}).catch(function(err){
				res.redirect('/failure');
			});
		}
	});

	//Delete the seleceted marker
	app.post('/database/markers/delete',utils.isLoggedIn,function(req,res){
		var marker = req.query.id;
		dbFunctions.removePGXCoords(marker,req.user.username)
		.then(function(result){
			if (result){
				res.redirect('/success');
			} else
				res.redirect('/failure');
		});
	});

	//add a new marker
	app.post('/markers/new',utils.isLoggedIn,function(req,res){
		var type = req.query.type;
		dbFunctions.checkInDatabase(constants.dbConstants.PGX.COORDS.COLLECTION,'_id',req.body._id)
		.then(function(inDB){
			if (inDB){
				req.flash('error','duplicate entry');
				req.flash('message','Marker: ' + req._id + " already exists, either update the current marker are define a new name");
				res.redirect('/failure');	
			} else {
				if(type == 'custom'){
					dbFunctions.insert(constants.dbConstants.PGX.COORDS.COLLECTION,req.body,req.user.username)
					.then(function(result){
						if (result){
							result.statusCode = 200;
							result.message = "Successfully entered new Marker"
							res.send(result);
						} else {
							res.redirect('/failure');
						}
					}).catch(function(err){
						res.redirect('/failure');
					});
				} else if (type == 'dbsnp'){
					getRS(req.body._id).then(function(result){
						if (result.dbSnp.length === 0 ){
							logger('info','could not retrieve information from NCBI dbSNP for several markers', {action:'getRS',missing:result.missing.length});
							req.flash('message','could not retrieve information from NCBI dbSNP for marker: ' + req.body._id);
							res.redirect('/failure');
						} else {
							return dbFunctions.insert(constants.dbConstants.PGX.COORDS.COLLECTION,result.dbSnp[0],req.username)
							.then(function(insertedDoc){
								result.statusCode = 200;
								result.message = "Successfully entered new marker"
								res.send(insertedDoc);
							}).catch(function(err){
								logger('error',err,{action:'insert',target:constants.dbConstants.PGX.COORDS.COLLECTION,arguments:result.dbSnp[0]})
								res.redirect('/failure');
							});
						}
					}).catch(function(err){
						logger('error',err,{action:'getRS',target:'NCBI dbSNP'});
						req.flash('error',err);
						req.flash('message',err.message);
						res.redirect('/failure');
					});
				}
			}
		})
	});

	//==================================================================
	
	//Get ALL the markers
	app.get('/database/markers/getmarkers',utils.isLoggedIn,function(req,res){
		dbFunctions.getPGXCoords(undefined,req.user.username).then(function(result){
			if (result)
				res.send(result);
			else
				res.send(undefined);
		});
	});

	//get the specific marker
	app.get('/database/markers/getmarkers/:marker',utils.isLoggedIn,function(req,res){
		var marker = req.params.marker;
		dbFunctions.getPGXCoords(marker,req.user.username).then(function(result){
			if (result)
				res.send(result);
			else 
				res.send(undefined);
		});
	})
};