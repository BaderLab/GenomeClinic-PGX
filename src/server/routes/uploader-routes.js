/* Routes associated with uploading files to the server then initializing
 * their annotation 
 * @auhtor Patrick Magee */
var uploader = require("jquery-file-upload-middleware");
var Promise = require('bluebird');
var constants = require('../lib/conf/constants.json');
var utils = require('../lib/utils');
var dbConstants = constants.dbConstants,
	nodeConstants = constants.nodeConstants;


module.exports = function(app,logger,opts){
	var Queue = require('../lib/queue');
	var queue = new Queue(logger);
	queue.addDBInstance(app.dbFunctions);
	utils.dbFunctions = app.dbFunctions;
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
		fileInfo.user = req.user.username;
		fileInfo.action = "uploader";
		logger('info','Upload file recieved and added to queue',fileInfo)
		queue.addToQueue(fileInfo,req)
		.then(function(){
			if (!queue.isRunning)
				return queue.run();
		}).catch(function(err){
			logger('error',err,{action:'addToQueue',user:req.user.username});
		});
	});

	//Upload page routes
	//Scripts to append to upload page
	
	app.get('/upload',utils.isLoggedIn, function(req,res){
		var scripts = [
			'vendor/upload.vendor.min.js',
			'uploader.js'
		];
		utils.render(req,res,{scripts:scripts,upload:true});
	});

	app.use("/upload/vcf", utils.isLoggedIn, uploader.fileHandler());
};