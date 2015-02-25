/*
 * Frangipani genome annotation server that connects to genome storage servers
 * 
 * @author Ron Ammar, Patrick Magee
 */
var express= require("express");
var dbFunctions= require("./frangipani_node_modules/mongodb_functions");
var Promise= require("bluebird");
var dbConstants= require("./frangipani_node_modules/mongodb_constants");
var fs = Promise.promisifyAll(require('fs'));
var passport = require('passport');
var flash = require('connect-flash');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser= require("body-parser");
var mongoStore = require('connect-mongo')(session);


//=======================================================================
// Command Line Options
//=======================================================================
/* Control the behaviour of the server by modifying the defaul
 * value of these command line options. They can be passed when
 * the server is initially started */
var opts= require("nomnom")
	.option("portNumber", {
		abbr: "p",
		full: "port",
		default: 8080,
		help: "User-specifed port number"
	})
	.option("mongodbHost", {
		full: "mongodb-host",
		default: dbConstants.DB_HOST,
		help: "User-specifed MongoDB hostname",
		callback: function(mongodbHost) {
			dbConstants.DB_HOST= mongodbHost;
		}
	})
	.option("mongodbPortNumber", {
		full: "mongodb-port",
		default: dbConstants.DB_PORT,
		help: "User-specifed MongoDB port number",
		callback: function(mongodbPortNumber) {
			dbConstants.DB_PORT= parseInt(mongodbPortNumber);
		}
	})
	.option("gmail",{
		abr:'g',
		full: "gmail-account",
		default:undefined,
		help:"gmail account name to use for sending password recoveries. This will not be permanately stored",
	})
	.option('password',{
		abr:'W',
		full:'gmail-password',
		default:undefined,
		help:'please eneter gmail account password. This will not be permanately stored',

	})
	.option('oauth',{
		flag:true,
		abr:'O',
		help:'Use Google Oauth for authentication',
	})
	.option('nosignup',{
		flag:true,
		help:'Use signup form'
	})
	.option('norecover',{
		flag:true,
		help:'Use recover form'
	})
	.parse();
opts.signup =  !opts.nosignup;
opts.recover = !opts.norecover;

console.log("Server running on port " + opts.portNumber);



//=======================================================================
// Initialize Express Server
//=======================================================================
var app= express();


//=======================================================================
// Check if prequisite directories are made, if not create them
//=======================================================================
var prerequisiteDirectories= ["upload", "tmp"];
for (var i= 0; i < prerequisiteDirectories.length; ++i) {
	// using an immediately-invoked function expression to keep scope across iterations
	(function () {
		var currentDirectory= prerequisiteDirectories[i];
		fs.statAsync(currentDirectory).then(function(result){
			// directory already exists
		}).catch(function(err){
			console.log(currentDirectory + ' directory does not exist. Created.');
			return fs.mkdirAsync(currentDirectory);
		}).catch(function(err){
			console.log("Cannot create " + currentDirectory + " folder");
			console.log(err);
		});
	})();
}

//=======================================================================
// Connect and Initialzie the storage Database
//=======================================================================
dbFunctions.connectAndInitializeDB()
.catch(function(err) {
	console.error(err.toString());
	console.error(err.stack);
	console.log("Exiting due to connection error with DB server.");
	process.exit(1);
});




//=======================================================================
// Add Parsers
//=======================================================================
app.use(cookieParser());
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:false}))



//=======================================================================
// Set up Passport to use Authentication
//=======================================================================

require('./frangipani_node_modules/passport-config')(passport,dbFunctions)

console.log('mongodb://' + dbConstants.DB_HOST + ':' + dbConstants.DB_PORT + '/sessionInfo');

//=======================================================================
// Initialize the session Session
//=======================================================================
//In the future use a redis session to configure the session information
app.use(session({secret:'fragipani_app_server',
				 store: new mongoStore({
				 	url:'mongodb://' + dbConstants.DB_HOST + ':' + dbConstants.DB_PORT + '/sessionInfo'
				 }),
				 resave:false,
				 saveUninitialized:false}));


//=======================================================================
// Initialize Passport and session
//=======================================================================
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

//=======================================================================
// Serve Static Public Content (ie, dont need to be logged in to access)
//=======================================================================
app.use(express.static("public/", {index: false}));




//=======================================================================
// Add routes
//=======================================================================
require('./frangipani_node_modules/routes')(app,passport,dbFunctions,opts);




//=======================================================================
// Start Listening on the set port
//=======================================================================
app.listen(opts.portNumber);


//=======================================================================
// Exit Event
//=======================================================================
/* Listen for SIGINT events. These can be generated by typing CTRL + C in the 
 * terminal. */ 
process.on("SIGINT", function(){
	console.log("\nReceived interrupt signal. Closing connections to DB...");
	dbFunctions.closeConnection(function() {
		console.log("Bye!");
		process.exit(0);
	});
});