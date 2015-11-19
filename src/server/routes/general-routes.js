/* General desintation routes. This is called last when 
 * adding route information. these reoutes essentially
 * are what is handling serving page content to the browser.
 * @author Ron Ammar
 * @author Patrick Magee
 */
var Promise = require('bluebird');
var constants = require('../lib/conf/constants.json');
var utils = require('../lib/utils');
var dbConstants = constants.dbConstants,
	nodeConstants = constants.nodeConstants;

module.exports = function(app,logger,opts){
	utils.dbFunctions = app.dbFunctions;
	var configured;
	//==================================================================
	//Route to the home page, or the config page if it is not set
	//==================================================================
	app.get("/", utils.isLoggedIn, function(req, res) {
		/* Check if the server has already been configured. 
		 * Using a bit of promise voodoo to ensure we check the DB first, but only
		* when configured !== true, so as to reduce DB interactions. */	
		var promise= new Promise.resolve(configured);
		if (!configured) {
			promise= app.dbFunctions.isConfigured();
		}

		/* If server is not configured redirect to the config page. Use a boolean
		 * instead of checking the DB with each request. */
		promise.then(function(resolved_config) {
			if (resolved_config) {
				if (!configured) {
					configured= resolved_config;
				}
				var options = {default:true}
					/*code:{
						code: "$(document).ready(function(){templates.index({title:'PGX Webapp'}).then(function(renderedHtml){$('#main').html(renderedHtml);});});",
						type:"text/javascript"
					}
				}*/
				utils.render(req,res,options);
			} else {
				res.redirect('/config');
			}
		});
	});


	//==================================================================
	//config form
	//==================================================================
	/* When the server is first being set up, redirect the user to the config page
	 * instead of home if config == false */
	app.get("/config", utils.isLoggedIn, function(req,res){
		app.dbFunctions.getAdminEmail()
		.then(function(result){
			if (result === req.user.username)
				utils.render(req,res,{scripts:'config.js'});	
			else {
				if (configured === undefined){
					app.dbFunctions.isConfigured()
					.then(function(result){
						if ( result )
							utils.render(req,res,'notfound');
						else
							utils.render(req,res,{scripts:'config.js'});
					});
				} else {
					utils.render(req,res,'notfound');
				} 
			}
		});
	});

	/* update the config details in the admin collection */
	app.post("/config", utils.isLoggedIn, function(req,res){
		var configSettings= req.body;
		app.dbFunctions.update(dbConstants.DB.ADMIN_COLLECTION, {}, {$set: configSettings},undefined,req.user.username)
		.then(function(result){
			app.dbFunctions.isConfigured(true);
		}).then(function(result){
			res.send(JSON.stringify(true));
		});
	});
	
	app.get('/config/current', utils.isLoggedIn, function(req,res){
		app.dbFunctions.findOne(dbConstants.DB.ADMIN_COLLECTION,{},req.user.username).then(function(result){
			res.send(result);
		})
	})

	//==================================================================
	//Generic page routers
	//==================================================================

	//render status page
	app.get(['/statuspage'], utils.isLoggedIn, function(req,res){
		utils.render(req,res,{scripts:'status-page.js'});
	});

	/* render definitions page */
	app.get('/definitions',utils.isLoggedIn,function(req,res){
		utils.render(req,res,{definitions:true});
	})
	//==================================================================
	//Generic DB  / utility routes
	//==================================================================
	app.get("/database/patients/completed", utils.isLoggedIn, function(req,res){
		var username = req.user[dbConstants.USERS.ID_FIELD];
		app.dbFunctions.findAllPatients(username,true,{sort: {"completed": -1}})
		.then(function(result){
			res.send(result);
		});

	});

	/* Find ALL patients including those in the queue and failure db */
	app.use('/database/patients/all',utils.isLoggedIn, function(req,res){
		var username = req.user[dbConstants.USERS.ID_FIELD];
		app.dbFunctions.findAllPatients(username, false, {sort:{'added':-1}})
		.then(function(result){
			res.send(result);
		});
	});

	/* RETURN THE OWNER Of the queried object */
	app.post('/database/owner',utils.isLoggedIn,function(req,res){
		var user = req.user[dbConstants.USERS.ID_FIELD];
		var collection = req.body.collection;
		var query = req.body.query;
		app.dbFunctions.getOwner(collection,query)
		.then(function(result){
			if (result);
				var _o = {
					owner:result,
					isOwner:(user==result),
					user:user
				};
				res.send(_o);
		}).catch(function(err){
			console.log(err);
		});
	});

	/* checkt to see whether the content within the body is within the database
	 *  returns true/false */
	app.post('/database/checkInDatabase',utils.isLoggedIn,function(req,res){
		var options = req.body;
		app.dbFunctions.checkInDatabase(options.collection,options.field,options.value)
		.then(function(result){
			res.send(result);
		});
	});

	/* Suggestion engine
	 * takes a query term, a collection type, a max number of arguments
	 * and the gene then attempts to map them to the mapper object. Once it
	 * has successfully mapped it then attempts to build an intelligent
	 * search term of that will query the databse based on the passed criteria
	 * It returns a single array of the data that matches
	 */
	app.get('/database/suggestions',utils.isLoggedIn,function(req,res){
		var mapper = {
			marker : {
				col:dbConstants.PGX.COORDS.COLLECTION,
				field:dbConstants.PGX.COORDS.ID_FIELD
			},
			drugs : {
				col :dbConstants.DRUGS.DRUGS.COLLECTION,
				field:dbConstants.DRUGS.DRUGS.ID_FIELD
			},
			genes : {
				col : dbConstants.DRUGS.ALL.COLLECTION,
				field : dbConstants.DRUGS.ALL.ID_FIELD
			},
			haplotype : {
				col : dbConstants.PGX.GENES.COLLECTION,
				field : dbConstants.PGX.GENES.ID_FIELD,
				gene : dbConstants.PGX.GENES.GENE
			},
			users : {
				col : dbConstants.USERS.COLLECTION,
				field : dbConstants.USERS.ID_FIELD
			}
		}

		var term = req.query.term;
		var collection = req.query.col;
		var num = parseInt(req.query.num) || 20;
		var strict = req.query.strict !== 'true' ? 'i' : '';
		var multiple = req.query.multiple == 'true' ? 'g' : '';
		var gene = req.query.gene || "";

		if (mapper[collection] == undefined ){
			res.send([]);
			return;
		}


		var agg = [];
		var query = {};
		term = term.replace(/\*/g,'\\*').replace(/\+/g,'\\+')
		if (collection == "marker" ){
			var temp1 = {};
			var temp2 = {};
			temp1[mapper[collection].field] = {$regex:term}
			temp2['merged.from'] = {$regex:term};
			if (strict !== '') {
				temp1[mapper[collection].field].$options = strict;
				temp2['merged.from'].$options = strict;
			}
			query.$or = [temp1, temp2];
		} else {
			query[mapper[collection].field] = {$regex:term}
			if (strict !== '') query[mapper[collection].field].$options = strict;
			if (multiple !== '') query[mapper[collection].field].$options = multiple;
		}
		if (mapper[collection].gene) query[mapper[collection].gene] = gene;
		//Search for merged genes as well
		agg.push({$match:query})
		agg.push({$limit:num});
		agg.push({$group:{_id:null,matches:{$addToSet:'$' + mapper[collection].field},from:{$addToSet:'$merged.from'}}});
		return app.dbFunctions.aggregate(mapper[collection].col,agg).then(function(result){
			if (result.length > 0) res.send(result[0].matches.concat(result[0].from));
			else res.send([]);
		});

		

	});

	/* Route for looking up stored and formatted pubmed citations
	 * the pubmed ID is the access key contained in the url string in the form:
	 * id=[id]&id=[id2]&id=[id3]....
	 * returns the IDs in the database, or missing if they are not found
	 */
	app.get("/database/citations",utils.isLoggedIn,function(req,res){
		var ids = req.query.id;	
		var out = {
			missing:[],
			citations:{}
		};
		if (!ids){ //f no ids were passed, send an empyt object
			res.send(out);
			return
		} else if (Object.prototype.toString.call(ids) == '[object String]') ids = [ids];

		//Filter only unique id's;
		ids = ids.filter(function(value,index,self){
			return self.indexOf(value) === index;
		});

		var query  = {"_id":{$in: ids}}; //build query string
		app.dbFunctions.find(dbConstants.DRUGS.CITATIONS.COLLECTION,query)
		.then(function(result){
			var foundIds = [];
			if (!result || result.length !== 0 ){
				//Some results have been found. return which obj of found and missing;
				for (var i = 0 ; i < result.length; i++ ){
					out.citations[result[i]._id] = result[i].citation;
					foundIds.push(result[i]._id);
				}
				//Find out which ID's 
				if (foundIds.length !== ids.length){
					for (var i = 0; i < ids.length; i++ ){
						if (foundIds.indexOf(ids[i]) == -1){
							out.missing.push(ids[i]);
						}
					}
				}
			} else {
				out.missing = ids;
			}
			res.send(out);
			return;
		}).catch(function(err){
			req.flash('error', err);
			req.flash('message', err.message);
			res.redirect('/failure');
		});
	});

	/* Add a new citation to the databse for easier storage.
	 * citaitons are already retrieved and stored in the body content in the form
	 * {_id:pubmedID,citation:"citation string"}
	 * if the id already exists in the database it is not aded */
	app.post("/database/citations",utils.isLoggedIn,function(req,res){
		var citations = req.body;
		if (citations.length == 0) res.send(false);
		else {
			var ids = citations.map(function(cite){return cite._id});
			var query = {_id:{$in:ids}};
			app.dbFunctions.find(dbConstants.DRUGS.CITATIONS.COLLECTION,query)
			.then(function(result){
				//A result was found, need to remove the entry that it refers to
				if (result && result.length > 0){
					//Loop over each result and filter out the required 
					for (var i = 0; i < result.length; i++){
						citations = citations.filter(function(item){
							if (item._id != result[i]._id) return item
						});
					}
				}
				var toInsert = {
					collectionName : dbConstants.DRUGS.CITATIONS.COLLECTION,
					documents: citations
				};
				return app.dbFunctions.insertMany(toInsert).then(function(result){
					if (result)
						res.send(true);
					else
						res.send(false);
					return
				})
			}).catch(function(err){
				req.flash('error', err);
				req.flash('message', err.message);
				res.redirect('/failure');
			});
		}

	});



	//==================================================================
	//Handle 404 routes
	//==================================================================
	/* NOTE: This must always be the ABSOLUTE last route added,
	 * Otherwise It will redirect a legitimate route to the 404 page.
	 * Essentially its sayin, anything coming in will be sent to 404notfound
	 */
	app.get(/^\/(.+)/, function(req,res){
		utils.render(req,res,{type:'notfound'});
	});
};





