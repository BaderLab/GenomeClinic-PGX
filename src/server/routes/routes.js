/* Main function which requires all other routes in order to modularize
 * the addition of routes.
 * @author Patrick Magee
 */
//var dbFunctions = require('../models/mongodb_functions');
module.exports = function(app,logger,opts,passport){
	//=======================================================================
	// Set the app to use handlebars as the rendering engine for rendering 
	// templates. this will not be done to render ALL the html, only render 
	// the navbar 
	//=======================================================================
	//=======================================================================
	//initialize the queing system for incoming file uploads
	//=======================================================================
	//each routes should have app,logger,opts,....

	require('./special-redirect-routes')(app,logger,opts);
	require('./auth-routes')(app,logger,opts,passport);
	require('./uploader-routes')(app,logger,opts);
	require('./pgx-routes')(app,logger,opts)
	require('./project-routes')(app,logger,opts);
	require('./drug-dosing-routes')(app,logger,opts)

	// General routes contains the path to the 404routes
	require('./general-routes.js')(app,logger,opts);
};




