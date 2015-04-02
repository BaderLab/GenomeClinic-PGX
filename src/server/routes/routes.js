/* Main function which requires all other routes in order to modularize
 * the addition of routes.
 * @author Patrick Magee
 */
var Queue = require('../lib/queue');
module.exports = function(app,passport,dbFunctions,opts,logger){
	if (!dbFunctions)
		dbFunctions = require("../models/mongodb_functions");
	if (!logger)
		logger = require('../lib/logger')('node');


	//=======================================================================
	// Set the app to use handlebars as the rendering engine for rendering 
	// templates. this will not be done to render ALL the html, only render 
	// the navbar 
	//=======================================================================
	//=======================================================================
	//initialize the queing system for incoming file uploads
	//=======================================================================
	var queue = new Queue(logger,dbFunctions);
	require('./special-redirect-routes')(app);
	require('./auth-routes')(app,passport,dbFunctions,logger,opts);
	require('./db-routes')(app,dbFunctions,queue);
	require('./uploader-routes')(app,dbFunctions,queue);
	require('./pgx-routes')(app,dbFunctions,logger);
	require('./project-routes')(app,dbFunctions,queue);
	// General routes contains the path to the 404routes
	require('./general-routes.js')(app,dbFunctions);
};




