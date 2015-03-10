/*
 * Frangipani genome annotation server that connects to genome storage servers
 * 
 * @author Ron Ammar, Patrick Magee
 */
var express= require("express"),
	Promise= require("bluebird"),
	fs = Promise.promisifyAll(require('fs')),
	passport = require('passport'),
	flash = require('connect-flash'),
	cookieParser = require('cookie-parser'),
	session = require('express-session'),
	bodyParser= require("body-parser"),
	mongoStore = require('connect-mongo')(session),
	https = require('https'),
	http = require('http'),
	morgan = require('morgan'),
	cons = require('consolidate'),
	constants = require('../conf/constants.json');


var dbConstants = constants.dbConstants;
var nodeConstants = constants.nodeConstants;

//=======================================================================
// Command Line Options
//=======================================================================
/* Control the behaviour of the server by modifying the defaul
 * value of these command line options. They can be passed when
 * the server is initially started */
var opts= require("nomnom")
	.option("httpsPortNumber", {
		abbr: "S",
		full: "httpsport",
		default: 443,
		help: "User-specifed port number for https connection"
	})
	.option('httpPortNumber',{
		abbr:'p',
		full:"httpport",
		default:80,
		help:'specify the default port for incoming http connection'
	})
	.option("mongodbHost", {
		full: "mongodb-host",
		default: dbConstants.DB.HOST,
		help: "User-specifed MongoDB hostname",
		callback: function(mongodbHost) {
			dbConstants.DB.HOST= mongodbHost;
		}
	})
	.option("mongodbPortNumber", {
		full: "mongodb-port",
		default: dbConstants.DB.PORT,
		help: "User-specifed MongoDB port number",
		callback: function(mongodbPortNumber) {
			dbConstants.DB.PORT= parseInt(mongodbPortNumber);
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
	.option('https',{
		flag:true,
		help:"Use secure https connection"
	})
	.option('development',{
		abbr:'d',
		full:'dev',
		flag:true,
		help:'Set development environment to true and use localhost ports'
	})
	.option('crt',{
		help:'Path to the crt file for https usage. Required if -https is used',
		default:undefined
	})
	.option('key',{
		help:'Pass in the key file for https usage. Required if -https is used',
		default:undefined
	})
	.parse();
opts.signup =  !opts.nosignup;
opts.recover = !opts.norecover;

if (opts.https && (!opts.crt || opts.key)){
	console.log("--https opton provided, please provide a crt file and a key file");
	process.exit(1);
} else if (!opts.password && opts.gmail || opts.password && !opts.gmail){
	console.log("--password and --gmail must both be provided");
	process.exit(1);
}
//=======================================================================
//Make log Directories
//=======================================================================
try {
	fs.statSync(nodeConstants.LOG_DIR);
} catch (err) {
	fs.mkdirSync(nodeConstants.LOG_DIR);
}

var logger = require('./logger')('node');
var dbFunctions = require("./mongodb_functions");


//=======================================================================
// Initialize Express Server And Initialize Loggers
//=======================================================================

//configure morgan to add the user to the logged file info:
morgan.token('user',function getUser(req){
		if (req.user)
			return req.user[dbConstants.USERS.ID_FIELD];
		else
			return "";
	});
//=======================================================================
//Open write stream for log files
//=======================================================================
var comLog = fs.createWriteStream(__dirname + "/" + nodeConstants.LOG_DIR + "/" + nodeConstants.COM_LOG_PATH);
var app = express();
app.use(morgan(':remote-addr - :user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"', {stream:comLog}));

//=======================================================================
//If using https then add redirect callback for all incoming http calls.
//=======================================================================
if (opts.https){
	app.use(function (req, res, next) {
		if (req.secure) {
			// request was via https, so do no special handling
			next();
		} else {
			// request was via http, so redirect to https
			if (!opts.development)
				res.redirect('https://' + req.headers.host + req.url); //
			else
				res.redirect('https://' + req.headers.host + ':' + opts.httpsPortNumber + req.url);

		}
	});
}
//=======================================================================
// Check if prequisite directories are made, if not create them
//=======================================================================
var prerequisiteDirectories= ["upload", "tmp"];
for (var i= 0; i < prerequisiteDirectories.length; ++i) {
	// using an immediately-invoked function expression to keep scope across iterations
	var currentDirectory= prerequisiteDirectories[i];
	fs.statAsync(currentDirectory).then(function(result){
		// directory already exists
	}).catch(function(err){
		logger.info(currentDirectory + ' directory does not exist. Created.');
		return fs.mkdirAsync(currentDirectory);
	}).catch(function(err){
		logger.error("Cannot create " + currentDirectory + " folder");
		logger.error(err);
	});
}

//=======================================================================
// Add Parsers
//=======================================================================
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}));

//=======================================================================	
// Set up Passport to use Authentication
//=======================================================================
require('../routes/passport-config')(passport,dbFunctions,opts);

//=======================================================================
// Initialize the session Session
//=======================================================================
//In the future use a redis session to configure the session information
app.use(session({secret:'webb_app_server',
	store: new mongoStore({
		url:'mongodb://' + dbConstants.DB.HOST + ':' + dbConstants.DB.PORT + '/sessionInfo'
	}),
	resave:false,
	secure:true,
	saveUninitialized:false
}));
logger.info('mongodb://' + dbConstants.DB.HOST + ':' + dbConstants.DB.PORT + '/sessionInfo');
//=======================================================================
// Initialize Passport and session
//=======================================================================
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

//=======================================================================
// Add routes
//=======================================================================
require('../routes/routes')(app,passport,dbFunctions,opts,logger);

//=======================================================================
// Connect and Initialzie the storage Database
//=======================================================================
dbFunctions.connectAndInitializeDB()
.catch(function(err) {
	logger.error(err.toString());
	logger.error(err.stack);
	logger.error("Exiting due to connection error with DB server.");
	process.exit(1);
});
//=======================================================================
// Serve Static Public Content (ie, dont need to be logged in to access)
//=======================================================================
app.use(express.static("public/", {index: false}));
//=======================================================================
// Start Listening on the set port
//=======================================================================
if (opts.https){
	var privateKey = fs.readFileSync(opts.key);
	var certificate = fs.readFileSync(opts.crt);
	var credentials = {key:privateKey,cert:certificate};
	http.createServer(app).listen(opts.httpPortNumber);
	https.createServer(credentials,app).listen(opts.httpsPortNumber);
	logger.info("Server running on https port: " + opts.httpsPortNumber + " http port:" + opts.httpPortNumber);
} else {
	logger.info("Server runnong on http port: " + opts.httpPortNumber);
	app.listen(opts.httpsPortNumber);
}
//=======================================================================
// Exit Event
//=======================================================================
/* Listen for SIGINT events. These can be generated by typing CTRL + C in the 
 * terminal. */ 
process.on("SIGINT", function(){
	logger.info("\nReceived interrupt signal. Closing connections to DB...");
	dbFunctions.closeConnection(function() {
		logger.info("Bye!");
		process.exit(0);
	});
});