	/* Logger configurations
 * Various configuration information for each type of logger. Additionally this module
 * exports a function that will initialize the specified loger version
 * @author Patrick Magee
 */
var callsite = require('callsite');

var winston = require("winston"),
	//constants = require('./conf/constants.json'),
	constants = require('../conf/constants.json'),
	fs = require('fs');
	traceback = require('traceback');
var nodeConstants = constants.nodeConstants

module.exports = function(logdir){
	/* ensure there are the appropriate directories */
	if(logdir) nodeConstants.LOG_DIR = logdir;

	try {
		fs.statSync(nodeConstants.LOG_DIR)
	} catch (err) {
		try {
			fs.mkdir(nodeConstants.LOG_DIR);
		} catch (err2){
			console.error("ERROR: Could not create log directies");
			console.error(err2.stack);
			process.exit(1);
		}
	}

	var logger = new (winston.Logger)({
			transports:[
				new (winston.transports.File)({
					name:'info-file',
					filename:nodeConstants.LOG_DIR + '/' + nodeConstants.INFO_LOG_PATH,
					level:'info'
				}),
				new (winston.transports.File)({
					name:'error-file',
					filename:nodeConstants.LOG_DIR + '/' + nodeConstants.ERR_LOG_PATH,
					level:'error'
				})
			]
		});


	/* ensure there are 



	/* opts = {
	 * 		action: <function name or action name>,	
	 * 		script: <script of origin>,
	 *      user: <user who called function>, // default is server call
	 *      target: <target of function.. ie collection>,
	 *      arguments: function arguments,
	 *
	 *      //Error only arguments
	 *      stack : <error stack trace>,
	 * 		error : <error name>
	 * }
	 */
	return function(level,message,opts){
		var cs = callsite()[1];	
		if (!level) level = 'info';
		if (!message) message = 'NA';
		if (!opts) opts = {};
		if (!opts.user) opts.user = 'server'; // server level event
		if (!opts.action ) opts.action = "Generic";//Generic Target
		opts.script = cs.getFileName();
		if (level == 'error'){
			opts.stack = message.stack;
			opts.error = message.name;
			message = message.message;

		}
		logger.log(level,message,opts);
	}
}