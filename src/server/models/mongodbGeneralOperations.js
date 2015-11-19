var Promise = require("bluebird");
var dbConstants = require("../lib/conf/constants.json").dbConstants;
var nodeConstants = require('../lib/conf/constants.json').nodeConstants;
var utils = require("../lib/utils");

//errors
var InvalidParameterError = require("../lib/errors/InvalidParameterError");
var MissingParameterError = require("../lib/errors/MissingParameterError");


module.exports = function(dbOperations){

	/* Change or check if the server has been configured.
	 * If changing the status of the configuration, use the set parameter.
	 * set === true, changes the configured status to true.
	 * If set is omitted, function returns the status as a boolean.
	 * Returns a promise. */
	utils.checkAndExtend(dbOperations,"isConfigured", function(set) {
		var _this = this;
		var promise= new Promise(function(resolve, reject) {
			if (!utils.isBool(set) && set !== undefined )
				reject(new InvalidParameterError("Invalid config set parameter"));

			if (set === undefined) {  // Return config status
				_this.findOne(dbConstants.DB.ADMIN_COLLECTION, {})
					.then(function(doc) {
						resolve(doc[dbConstants.DB.SERVER_CONFIGURED_FIELD]);
					})
					.catch(function(err) {
						reject(err);
					});
			} else { // set config status
				var currentDocument= {};
				currentDocument[dbConstants.DB.SERVER_CONFIGURED_FIELD]= set;
				_this.update(dbConstants.DB.ADMIN_COLLECTION, {}, {$set: currentDocument})
					.then(function(doc) {
						resolve();
					})
					.catch(function(err) {
						reject(err);
					});
			}
		});
		return promise;
	});

	/* wrapper to retrieve the admin email from the server */
	utils.checkAndExtend(dbOperations, "getAdminEmail", function(){
		return this.find(dbConstants.DB.ADMIN_COLLECTION,{})
		.then(function(result){
			return result[0]['admin-email'];
		});
	});
}