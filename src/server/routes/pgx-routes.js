/* Routes to handle the pgx app
 * @author Ron Ammar
 */
var utils = require('../lib/utils');
var Promise = require('bluebird');
var fs = require('fs');
var constants = require("../lib/conf/constants.json");
var genReport  = require('../lib/genReport');
var dbFunctions = require('../models/mongodb_functions');


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
		dbFunctions.checkInDatabase(constants.dbConstants.PGX.GENES.COLLECTION,constants.dbConstants.PGX.GENES.ID_FIELD,hapid)
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
		genReport(req,res,req.params.patientID,constants.dbConstants.PGX.REPORT.DEFAULT,options)
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
	app.delete('/haplotypes/current/:hapid',utils.isLoggedIn,function(req,res){
		var id = req.params.hapid;
		dbFunctions.removePGXGene(id,req.user.username)
		.then(function(result){
			if (result){
				res.send(true);
			} else {
				res.send(false);
			}
		}).catch(function(err){
			res.redirect(false);
		});

	});


	/*Add a new haplotype. The body is already formatted in the correct manner and the entry is simply
	* inserted into the db.
	*/
	app.post('/haplotypes/new',utils.isLoggedIn,function(req,res){
		dbFunctions.insert(constants.dbConstants.PGX.GENES.COLLECTION,req.body,req.user.username)
		.then(function(result){
			if (result){
				res.redirect('/success');
			} else {
				res.redirect('/failure');
			}
		}).catch(function(err){
			res.redirect('/failure');
		});
	});

	//Get a list of all the current haploytpes and geenes
	app.get('/database/haplotypes/getgenes',utils.isLoggedIn,function(req,res){
		dbFunctions.getPGXGenes(undefined,req.user.username).then(function(result){
			if (result)
				res.send(result);
			else 
				res.send(undefined);
		}).catch(function(err){
			logger('error',err,{user:req.user.username,action:'getPGXGenes'});
		});
	});

	//get information for a specific gene and return it in the required format
	app.get('/database/haplotypes/getgenes/:gene',utils.isLoggedIn,function(req,res){
		var gene = req.params.gene;
		dbFunctions.getPGXGenes(req.params.gene,req.user.username).then(function(result){
			var out = {};
			if (result){
				out.gene = gene;
				var uniqIDS = [];
				var haplotypes = result[gene];
				for (var hap in haplotypes){
					if (haplotypes.hasOwnProperty(hap)){
						for (var i=0; i < haplotypes[hap].length; i++){
							if (uniqIDS.indexOf(haplotypes[hap][i]===-1));
								uniqIDS.push(haplotypes[hap][i]);
						}
					}
				}
				dbFunctions.getPGXCoords(uniqIDS,req.user.username).then(function(coords){
					var o,ho = {};
					if(coords){
						for (var hap in haplotypes){
							if (haplotypes.hasOwnProperty(hap)){
								for (var i=0; i < haplotypes[hap].length; i++){

									o = coords[haplotypes[hap][i]];
									if (o !== undefined){
										o.id = haplotypes[hap][i];
										haplotypes[hap][i] = o;
									}	
									
								}
								ho[hap] = {'markers':haplotypes[hap]};
							}
						}
						out.haplotypes = ho;
						res.send(out);
					} else {
						res.send(undefined);
					}
				});
			} else {
				res.send(undefined);
			}
		});
	});



	/*app.get('/TEST',function(req,res){
		dbFunctions.updateAllPGXCoords().then(function(result){
			console.log(result);
		});
	})
*/


	//Update the current marker
	app.post('/markers/current/:marker',utils.isLoggedIn,function(req,res){
		var marker = req.params.marker;
		var info = req.body;
		var query = {};
		query[constants.dbConstants.PGX.COORDS.ID_FIELD] = marker;
		dbFunctions.updatePGXCoord(marker,info,req.user.username)
		.then(function(result){
			if (result){

				res.redirect('/success');
			} else {
				res.redirect('/failure');
			}
		}).catch(function(err){
			res.redirect('/failure');
		});
	});

	//Delete the seleceted marker
	app.post('/markers/current/:marker/delete',utils.isLoggedIn,function(req,res){
		var marker = req.params.marker;
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
		dbFunctions.insert(constants.dbConstants.PGX.COORDS.COLLECTION,req.body,req.user.username)
		.then(function(result){
			if (result){
				res.redirect('/success');
			} else {
				res.redirect('/failure');
			}
		}).catch(function(err){
			res.redirect('/failure');
		});
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