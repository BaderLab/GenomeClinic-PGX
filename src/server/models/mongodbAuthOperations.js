/**
 * MonogoDB Functions extending the MongoDBAdvancedOperations for dealing with
 * user authentication, and users.
 * 
 * @author Patrick Magee
 */
var Promise = require("bluebird");
var assert= require("assert");
var dbConstants = require("../lib/conf/constants.json").dbConstants;
var nodeConstants = require('../lib/conf/constants.json').nodeConstants;
var bcrypt = require("bcrypt-nodejs");
var randomstring = require("just.randomstring");
var utils = require("../lib/utils");

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
	//Add a user to the database, encrypting the provided password and storing them in the users db
	utils.checkAndExtend(dbOperations,"addUser", function(user){
		assert(Object.prototype.toString.call(user[dbConstants.USERS.ID_FIELD]) == "[object String]",
			"Invalid Options");
		assert(Object.prototype.toString.call(user[dbConstants.USERS.PASSWORD_FIELD]) == "[object String]",
			"Invalid Options");
		//encrypt the password
		this.logger('info','adding new user to databse', {'user':user[dbConstants.USER_ID_FIELD]});
		user[dbConstants.USERS.PASSWORD_FIELD] = bcrypt.hashSync(user[dbConstants.USERS.PASSWORD_FIELD], bcrypt.genSaltSync(SALT), null);
		return this.insert(dbConstants.USERS.COLLECTION,user);
	});

	//Find a user by the provided ID and return all information related to them
	utils.checkAndExtend(dbOperations,"findUserById", function(id){
		assert(Object.prototype.toString.call(id) == "[object String]",
			"Invalid Options");
		var query = {};
		query[dbConstants.USERS.ID_FIELD] = id;
		return this.findOne(dbConstants.USERS.COLLECTION,query);
	});

	//Validate the password during signon in a secure manner.
	utils.checkAndExtend(dbOperations,"validatePassword", function(username,password){
		assert(Object.prototype.toString.call(username) == "[object String]",
			"Invalid Options");
		assert(Object.prototype.toString.call(password) == "[object String]",
			"Invalid Options");
		return this.findUserById(username).then(function(result){
			 return bcrypt.compareSync(password, result[dbConstants.USERS.PASSWORD_FIELD]);
		});
	});


	//Find the user by the google id
	utils.checkAndExtend(dbOperations,"findUserByGoogleId", function(id){
		assert(Object.prototype.toString.call(id) == "[object String]",
			"Invalid Options");
		var query = {};
		query[dbConstants.USERS.GOOGLE.ID_FIELD] = id;
		return this.findOne(dbConstants.USERS.COLLECTION,query);
	});

	//Add a google user, only used for Google OAUTH
	utils.checkAndExtend(dbOperations,"addUserGoogle",function(user){
		assert(Object.prototype.toString.call(user[dbConstants.USERS.GOOGLE.ID_FIELD]) == "[object String]",
			"Invalid Options");
		assert(Object.prototype.toString.call(user[dbConstants.USERS.GOOGLE.TOKEN_FIELD]) == "[object String]",
			"Invalid Options");
		assert(Object.prototype.toString.call(user[dbConstants.USERS.GOOGLE.NAME_FIELD]) == "[object String]",
			"Invalid Options");
		assert(Object.prototype.toString.call(user[dbConstants.USERS.GOOGLE.EMAIL_FIELD]) == "[object String]",
			"Invalid Options");
		assert(Object.prototype.toString.call(user[dbConstants.USERS.ID_FIELD]) == "[object String]",
			"Invalid Options");
		return this.insert(dbConstants.USERS.COLLECTION,user);
	});


	//When the password is lost and needs to be recovered, generate a random password, bcrypt it
	//And return the new password in an non-encrypted format
	utils.checkAndExtend(dbOperations,"generatePassword", function(user){
		assert(Object.prototype.toString.call(user) == "[object String]",
			"Invalid Options");

		var newPassowrd = randomstring(PWD_STRING_LEN);
		var encryptPassword = bcrypt.hashSync(newPassowrd,bcrypt.genSaltSync(SALT),null);
		var query = {};
		query[dbConstants.USERS.ID_FIELD] = user;
		newPass = {};
		newPass[dbConstants.USERS.PASSWORD_FIELD] = encryptPassword;
		var doc = {$set:newPass};
		return this.update(dbConstants.USERS.COLLECTION,query,doc,undefined,user).then(function(result){
			return newPassowrd;
		});
	});

	//Change the current users password
	utils.checkAndExtend(dbOperations,"changePassword", function(user, password){
		assert(Object.prototype.toString.call(user) == "[object String]",
			"Invalid Options");
		assert(Object.prototype.toString.call(password) == "[object String]",
			"Invalid Options");
		var encryptPassword = bcrypt.hashSync(password,bcrypt.genSaltSync(SALT),null);
		var doc = {};
		var query = {};
		query[dbConstants.USERS.ID_FIELD] = user;
		doc[dbConstants.USERS.PASSWORD_FIELD] = encryptPassword;
		doc = {$set:doc};
		this.logger('info','changing password for' + user,{action:'changePassword'});
		return this.update(dbConstants.USERS.COLLECTION,query,doc,undefined,user);
	});
};