	/* Logger configurations
 * Various configuration information for each type of logger. Additionally this module
 * exports a function that will initialize the specified loger version
 * @author Patrick Magee
 */

var winston = require("winston"),
	nodeConstants = require('./conf/constants.json').nodeConstants;


module.exports = function(useage){
	var logger;
	if (useage == 'node'){
		logger = new (winston.Logger)({
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
	} else if (useage == "parser"){
		logger  = new (winston.Logger)({
			transports:[
				new (winston.transports.File)({
					name:'info-file',
					filename:nodeConstants.LOG_DIR + '/' + nodeConstants.PARSE_INFO_LOG_PATH,
					level:'info'
				}),
				new (winston.transports.File)({
					name:'error-file',
					filename:nodeConstants.LOG_DIR + '/' + nodeConstants.PARSE_ERR_LOG_PATH,
					level:'error'
				})
			]
		});
	} else if (useage == "annotation"){
		logger  = new (winston.Logger)({
			transports:[
				new (winston.transports.File)({
					name:'info-file',
					filename:nodeConstants.LOG_DIR + '/' + nodeConstants.ANNO_INFO_LOG_PATH,
					level:'info'
				}),
				new (winston.transports.File)({
					name:'error-file',
					filename:nodeConstants.LOG_DIR + '/' + nodeConstants.ANNO_ERR_LOG_PATH,
					level:'error'
				})
			]
		});
	} else if (useage == "db"){
		logger  = new (winston.Logger)({
			transports:[
				new (winston.transports.File)({
					name:'info-file',
					filename:nodeConstants.LOG_DIR + '/' + nodeConstants.DB_INFO_LOG_PATH,
					level:'info'
				}),
				new (winston.transports.File)({
					name:'error-flie',
					filename:nodeConstants.LOG_DIR + '/' + nodeConstants.DB_ERR_LOG_PATH,
					level:'error'
				})
			]
		});
	}
	return logger;
};