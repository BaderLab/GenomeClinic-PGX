var Promise = require("bluebird");
var assert= require("assert");
var dbConstants = require("../lib/conf/constants.json").dbConstants;
var nodeConstants = require('../lib/conf/constants.json').nodeConstants;
var utils = require("../lib/utils");
//var dbConstants = require("../conf/constants.json").dbConstants;
//var nodeConstants = require('../conf/constants.json').nodeConstants;

module.exports = function(dbOperations){

	/* Change or check if the server has been configured.
	 * If changing the status of the configuration, use the set parameter.
	 * set === true, changes the configured status to true.
	 * If set is omitted, function returns the status as a boolean.
	 * Returns a promise. */
	utils.checkAndExtend(dbOperations,"isConfigured", function(set) {
		var _this = this;
		assert(Object.prototype.toString.call(set) == "[object Boolean]" || Object.prototype.toString.call(set) == "[object Undefined]","Invalid config set parameter");
		var promise= new Promise(function(resolve, reject) {
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