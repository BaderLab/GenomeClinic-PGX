var utils = require('./lib/utils');
var uploader = require("jquery-file-upload-middleware");
var Promise = require('bluebird');
var costatnts = require('./lib/constants.json');
var utils = require('./lib/utils');


var dbConstants = constants.dbConstants,
	nodeConstants = constants.nodeConstants;


module.exports = function(app,dbFunctions,queue){
	//load dependencies
	if (!dbFunctions)
		var dbFunctions = require('mongodb_functions');
	if (!queue){
		var Queue = require('./queue');
		var queue = new Queue(null,dbFunctions);
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
		tmpDir:nodeConstant.TMP_UPLOAD_DIR,
		uploadDir:nodeConstant.VCF_UPLOAD_DIR,
		uploadUrl:'/upload/vcf'
	});
	/* Event Handler that is triggered upon successful completion of the file upload
	 * This handler facilitates the addition of annotation information adn the inclusion
	 * of the vcf file into the local database
	*/
	uploader.on('end',function(fileInfo,req,res){
		queue.addToQueue(fileInfo,req.fields,req.user[dbConstants.USER_ID_FIELD])
		.then(function(){
			if (!queue.isRunning)
				return queue.run();
		}).catch(function(err){console.log(err.toString())});
	})
	app.use("/upload/vcf", utils.isLoggedIn, uploader.fileHandler());
};