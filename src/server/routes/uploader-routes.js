/* Routes associated with uploading files to the server then initializing
 * their annotation 
 * @auhtor Patrick Magee */
var utils = require('../lib/utils');
var uploader = require("jquery-file-upload-middleware");
var Promise = require('bluebird');
var constants = require('../lib/conf/constants.json');

var dbConstants = constants.dbConstants,
	nodeConstants = constants.nodeConstants;


module.exports = function(app,dbFunctions,queue){
	//load dependencies
	if (!dbFunctions)
		dbFunctions = require('../models/mongodb_functions');
	if (!queue){
		var logger = require('../lib/logger')('node');
		var Queue = require('../lib/queue');
		queue = new Queue(logger,dbFunctions);
	}
	//==================================================================
	//UPLOADER
	//==================================================================
	/* jquery-file-upload-middlware routs
	 * The jquery file upload middleware handles the bulf ot the work when it comes to the file
	 * Upload. The jquery-file-upload plugin emits an ajax call and then the middleware handles 
	 * the response. It has automatic event handlers for listeing to cancellations (aka aborts)
	 * and failures. In these scenarios it will automatically delete the incomplete file.
	 * additionally it also has handlers for file success and file download
	*/


	//Configure the uploader to tell it what directories to use
	uploader.configure({
		tmpDir:nodeConstants.TMP_UPLOAD_DIR,
		uploadDir:nodeConstants.VCF_UPLOAD_DIR,
		uploadUrl:'/upload/vcf'
	});
	/* Event Handler that is triggered upon successful completion of the file upload
	 * This handler facilitates the addition of annotation information adn the inclusion
	 * of the vcf file into the local database
	*/
	uploader.on('end',function(fileInfo,req,res){
		queue.addToQueue(fileInfo,req.fields,req.user[dbConstants.USERS.ID_FIELD])
		.then(function(){
			if (!queue.isRunning)
				return queue.run();
		}).catch(function(err){console.log(err.toString());});
	});

	//Upload page routes
	app.get('/upload',utils.isLoggedIn, function(req,res){
		utils.render(req,res);
	});

	app.use("/upload/vcf", utils.isLoggedIn, uploader.fileHandler());
};