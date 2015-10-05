var connect = require("./mongodbConnect");
var Promise = require("bluebird");

var conx = new connect();
conx.connect('test','test').then(function(DB){
	DB.isConfigured()
	.then(function(x){
		console.log(x);
	}).then(function(){
		return DB.getAdminEmail()
	}).then(function(x){
		console.log(x);
	}).then(function(){
		return DB.findUserById("dev@dev.com");
	}).then(function(x){
		console.log(x);
	}).then(function(){
		return DB.validatePassword('dev@dev.com','123123');
	}).then(function(x){
		console.log(x);
	}).then(function(){
		return DB.generatePassword('dev@dev.com');
	}).then(function(x){
		console.log(x);
	}).then(function(){
		return DB.findAllPatientIds('dev@dev.com');
	}).then(function(x){
		console.log(x);
	}).then(function(x){
		return DB.findAllPatients('dev@dev.com');
	}).then(function(x){
		console.log(x);
	}).then(function(x){
		return DB.getPGXGenesForAnalysis('CYP2D6');
	}).then(function(x){
		console.log(x);
	}).then(function(){
		return DB.getPGXVariants();
	}).then(function(x){
		console.log(x);
	}).then(function(){
		process.exit(0);
	});
})
