/**
 * MonogoDB Functions extending the MongoDBAdvancedOperations for dealing with
 * user authentication, and users.
 * 
 * @author Patrick Magee
 */
var Promise = require("bluebird");
var dbConstants = require("../lib/conf/constants.json").dbConstants;
var nodeConstants = require('../lib/conf/constants.json').nodeConstants;
var bcrypt = require("bcrypt-nodejs");
var randomstring = require("just.randomstring");
var utils = require("../lib/utils");

//errors
var InvalidParameterError = require("../lib/errors/InvalidParameterError");
var MissingParameterError = require("../lib/errors/MissingParameterError");

//Constant variables
var SALT = 8;
var PWD_STRING_LEN = 10;

/**
 * Anonymous function called immediately upon requiringthe this script. it takes a single
 * parameter, the mongodbAdvancedOperations wrapper class and then extends the prototype
 * of the wrapper to include all the enclosed functions
 * @param {mongodbAdvancedOperations} 
 *
 */ 
module.exports = function(dbOperations){
	//=======================================================================================
	//Login functions
	//=======================================================================================
	/**
	 * Add a user to the database, encrypting the provided password and storing them in the users db
	 * @param user An object with the new user credentials
	 * @returns returns a promise
	 * @throws MissingParameterError
	 * @throws InvalidParameterError
	 */
	utils.checkAndExtend(dbOperations,"addUser", function(user){
		var _this = this;
		var promise = Promise.resolve().then(function(){
			if (!user || !user[dbConstants.USERS.ID_FIELD] || !user[dbConstants.USERS.PASSWORD_FIELD])
				throw new MissingParameterError("missing required parameter");
			if (!utils.isObject(user))
				throw new InvalidParameterError("user parameter must be an object");
			if (!utils.isString(user[dbConstants.USERS.ID_FIELD]) || !utils.isString(user[dbConstants.USERS.PASSWORD_FIELD]))
				throw new InvalidParameterError("user name and password must be valid strings");
			//encrypt the password
			_this.logger('info','adding new user to databse', {'user':user[dbConstants.USER_ID_FIELD]});
			user[dbConstants.USERS.PASSWORD_FIELD] = bcrypt.hashSync(user[dbConstants.USERS.PASSWORD_FIELD], bcrypt.genSaltSync(SALT), null);
			
			return _this.insert(dbConstants.USERS.COLLECTION,user)
		});
		return promise;
	});

	/* Find a user by their ID
	 * @params id String of the user Id
	 * @return promise with settled value of the user
	 * @throws MissingParameterError
	 * @throws InvalidParameterError
	 */
	utils.checkAndExtend(dbOperations,"findUserById", function(id){
		var _this = this;
		var promise = Promise.resolve().then(function(){
			if (!id)
				throw new MissingParameterError("id required");
			if (!utils.isString(id))
				throw new InvalidParameterError("Id field must be a string");
			var query = {};
			query[dbConstants.USERS.ID_FIELD] = id;
			return _this.findOne(dbConstants.USERS.COLLECTION,query);
		});
		return promise;
	});

	/*
	 * Validate a user's password agaisnt that stored in the database
	 * @param username the user identifier
	 * @param password
	 * @returns true / false
	 * @throws MissingParameterError
	 * @throws InvalidParameterError
	 */
	utils.checkAndExtend(dbOperations,"validatePassword", function(username,password){
		var _this = this;
		var promise = Promise.resolve().then(function(){
			if (!username || !password )
				throw new MissingParameterError("missing required paramter");
			if (!utils.isString(username) || !utils.isString(password))
				throw new InvalidParameterError("Username and password must be valid strings");

			return _this.findUserById(username)
		}).then(function(result){
			return bcrypt.compareSync(password, result[dbConstants.USERS.PASSWORD_FIELD]);
		});
		return promise;
	});


	//Find the user by the google id
	utils.checkAndExtend(dbOperations,"findUserByGoogleId", function(id){
		var _this  = this;
		var promise = Promise.resolve().then(function(){
			if (!id)
				throw new MissingParameterError("id required");
			if (!utils.isString(id))
				throw new InvalidParameterError("Id must be a valid string");
			var query = {};
			query[dbConstants.USERS.GOOGLE.ID_FIELD] = id;
			return _this.findOne(dbConstants.USERS.COLLECTION,query);
		});
		return promise;
	});

	//Add a google user, only used for Google OAUTH
	utils.checkAndExtend(dbOperations,"addUserGoogle",function(user){
		var _this  = this;
		var promise = Promise.resolve().then(function(){
			if (!user || !user[dbConstants.USERS.GOOGLE.ID_FIELD] || ! user[dbConstants.USERS.GOOGLE.TOKEN_FIELD] || 
				!user[dbConstants.USERS.GOOGLE.NAME_FIELD] || !user[dbConstants.USERS.GOOGLE.EMAIL_FIELD] || !user[dbConstants.USERS.ID_FIELD])
				throw new MissingParameterError("missing required parameter");
			if (!utils.isObject(user))
				throw InvalidParameterError("user paramter must be an object");
			if (!utils.isString(user[dbConstants.USERS.GOOGLE.ID_FIELD]) || !utils.isString(user[dbConstants.USERS.GOOGLE.TOKEN_FIELD]) || 
				!utils.isString(user[dbConstants.USERS.GOOGLE.NAME_FIELD]) || !utils.isString(user[dbConstants.USERS.GOOGLE.EMAIL_FIELD]) || !utils.isString(user[dbConstants.USERS.ID_FIELD]))
				throw new InvalidParameterError("Parameters must be a string");

			return this.insert(dbConstants.USERS.COLLECTION,user);
		});
		return promise;
	});


	//When the password is lost and needs to be recovered, generate a random password, bcrypt it
	//And return the new password in an non-encrypted format
	utils.checkAndExtend(dbOperations,"generatePassword", function(user){
		var _this  = this;
		var promise = Promise.resolve().then(function(){
			if (!user)
				throw new MissingParameterError("user required");
			if (!utils.isString(user))
				throw new InvalidParameterError("user name must be a valid string");

			var newPassowrd = randomstring(PWD_STRING_LEN);
			var encryptPassword = bcrypt.hashSync(newPassowrd,bcrypt.genSaltSync(SALT),null);
			var query = {};
			query[dbConstants.USERS.ID_FIELD] = user;
			newPass = {};
			newPass[dbConstants.USERS.PASSWORD_FIELD] = encryptPassword;
			var doc = {$set:newPass};
			return _this.update(dbConstants.USERS.COLLECTION,query,doc,undefined,user).then(function(result){
				return newPassowrd;
			});
		});
		return promise;
	});

	/**
	 * Update a users password to the new password supplied
	 * @oaram username
	 * @param password new password
	 * @return promise of the update status
	 * @throws MissingParameterError
	 * @throws InvalidParameterError
	 */
	utils.checkAndExtend(dbOperations,"changePassword", function(user, password){
		var _this  = this;
		var promise = Promise.resolve().then(function(){
			if (!user || !password)
				throw new MissingParameterError("Missing required paramter");
			if (!utils.isString(user) || !utils.isString(password))
				throw new InvalidParameterError("user and password must be valid strings");
			
			var encryptPassword = bcrypt.hashSync(password,bcrypt.genSaltSync(SALT),null);
			var doc = {};
			var query = {};
			query[dbConstants.USERS.ID_FIELD] = user;
			doc[dbConstants.USERS.PASSWORD_FIELD] = encryptPassword;
			doc = {$set:doc};
			_this.logger('info','changing password for' + user,{action:'changePassword'});
			return _this.update(dbConstants.USERS.COLLECTION,query,doc,undefined,user);
		});
		return promise;
	});
};