/*
 * GenomeClinic-PGX web server for clinical pharmacogenomics reporting
 * 
 * This script contains the main start method for setting various variables
 * and starting the server running.
 *
 * @author Ron Ammar
 * @author Patrick Magee
 */
var express= require("express"),
	Promise= require("bluebird"),
	constants = require('./lib/conf/constants.json'),
	opts= require("nomnom")
	.option('version',{
		flag: true,
		abbr:'v',
      	help: 'print version and exit',
      	callback: function() {
        	return "v1.0";
      	}
	})
	.option('https',{
		flag:true,
		help:"Use secure https connection, requires the user to specify SSL certificate and key"
	})
	.option("httpsPortNumber", {
		abbr: "S",
		metavar: "PORT",
		full: "httpsport",
		default: 443,
		help: "User-specifed port number for https connection"
	})
	.option('httpPortNumber',{
		abbr:'p',
		metavar: "PORT",
		full:"httpport",
		default:80,
		help:'specify the default port for incoming http connection'
	})
	.option('crt',{
		abbr:'c',
		full:'crt',
		metavar:"PATH",
		help:'Path to the ssl certificate file for https usage. Required if -https is used',
		default:undefined
	})
	.option('key',{
		abbr:'k',
		full:'key',
		metavar:"PATH",
		help:'Pass in the ssl key file for https usage. Required if -https is used',
		default:undefined
	})
	.option("mongodbHost", {
		full: "mongodb-host",
		metavar:"URL",
		default: constants.dbConstants.DB.HOST,
		help: "User-specifed MongoDB hostname",
		callback : function(mongodbHost){
			constants.dbConstants.DB.HOST = mongodbHost;
		}
	})
	.option("mongodbPortNumber", {
		full: "mongodb-port",
		metavar: "PORT",
		default: constants.dbConstants.DB.PORT,
		help: "User-specifed MongoDB port number",
		callback: function(mongodbPortNumber) {
			constants.dbConstants.DB.PORT= parseInt(mongodbPortNumber);
		}
	})
	.option('mongoDatabase',{
		full:"mongodb-db",
		metavar:"STRING",
		default:constants.dbConstants.DB.NAME,
		help: "User specificed Mongodb databse",
		callback: function(mongoDatabase){
			constants.dbConstants.DB.NAME = mongoDatabase;
		}
	})
	.option('logdir',{
		abbr:'l',
		full:'logdir',
		metavar:"PATH",
		default:constants.nodeConstants.LOG_DIR,
		help:"change the default log directory",
		
	})
	.option('nosignup',{
		flag:true,
		help:'Use signup form'
	})
	.option('norecover',{
		flag:true,
		help:'Use recover form'
	})
	.option('development',{
		abbr:'d',
		full:'dev',
		flag:true,
		help:'Set development environment to true and use localhost ports'
	})
	.option('report',{
		abbr:'r',
		full:'report',
		metavar:"PATH",
		help:'Path to a user defined output report',
		default:constants.dbConstants.DRUGS.REPORT.DEFAULT
	})
	.option('defaultData',{
		full:"def-data",
		metavar:"PATH",
		help:"Define a path to default data other then that specificed by the constants folder",
		callback: function(defaultData){
			constants.dbConstants.DRUGS.DEFAULT = path.resolve(defaultData);
		}
	})
	.option("gmail",{
		full: "gmail-account",
		metavar:"STRING",
		default:undefined,
		help:"gmail account name to use for sending password recoveries. This will not be permanately stored",
	})
	.option('password',{
		metavar:"STRING",
		full:'gmail-password',	
		default:undefined,
		help:'please eneter gmail account password. This will not be permanately stored',

	})
	.option('oauth',{
		flag:true,
		abr:'O',
		help:'Use Google Oauth for authentication',
	})
	.option('authdb',{
		abbr:'A',
		full:"authdb",
		metavar:"USER",
		help:"Provide a username to use for connecting to a authenticated mongo server",
		default:undefined
	})
	.parse(),
	//dbFunctions = require("./models/mongodb_functions"),
	DBConnect = require('./models/mongodbConnect'),
	path = require("path"),
	fs = Promise.promisifyAll(require('fs')),
	passport = require('passport'),
	flash = require('connect-flash'),
	cookieParser = require('cookie-parser'),
	session = require('express-session'),
	bodyParser= require("body-parser"),
	mongoStore = require('connect-mongo')(session),
	https = require('https'),
	http = require('http'),
	morgan = require('morgan')
	cons = require('consolidate'),
	logger = require('./lib/logger')(opts.logdir),
	readline = require('readline-sync');


var dbConstants = constants.dbConstants;
var nodeConstants = constants.nodeConstants;
var app = express();
var dbConnection = new DBConnect();
var dbPassword;
//=======================================================================
// Command Line Options
//=======================================================================
/* Control the behaviour of the server by modifying the defaul
 * value of these command line options. They can be passed when
 * the server is initially started */
opts.signup =  !opts.nosignup;
opts.recover = !opts.norecover;
if (opts.https && (! opts.crt || !opts.key)){
	console.log("--https opton provided, please provide a crt file and a key file");
		process.exit(1);
} else if (!opts.password && opts.gmail || opts.password && !opts.gmail){
	console.log("--password and --gmail must both be provided");
	process.exit(1);
}
if (opts.authdb){
	logger('info','Using authenticated db loging',{User:opts.authdb});
	console.log("Using authenticated MongoDB login");
	console.log("USERNAME: " + opts.authdb);
	dbPassword = readline.question('PASSWORD: ',{hideEchoBack:true});
	console.log('\033[2J');
}

//Connect to the database, if this is unnsuccessful, do not continue.
dbConnection.connect(opts.authdb,dbPassword).then(function(dbFunctions){
	//Bind dbfunctions to app
	app.dbFunctions = dbFunctions;

	logger('info','Starting server',{arguments:opts});
	//=======================================================================
	//Make log Directories
	//=======================================================================
	var prerequisiteDirectories = [nodeConstants.TMP_UPLOAD_DIR, nodeConstants.UPLOAD_DIR];
	for (var i=0; i < prerequisiteDirectories.length; i++ ){
		try {
			fs.statSync(prerequisiteDirectories[i]);

		} catch (err) {
			try {
				logger('info','Adding prequisite directory',{target:prerequisiteDirectories[i],action:'mkdir'});
				fs.mkdirSync(prerequisiteDirectories[i]);
			} catch (err2){ 
			}
		}
	}



	//configure morgan to add the user to the logged file info:
	logger('info','Logging HTTP traffic to: ' + nodeConstants.LOG_DIR + "/" + nodeConstants.COM_LOG_PATH);
	var comLog = fs.createWriteStream(nodeConstants.LOG_DIR + "/" + nodeConstants.COM_LOG_PATH,{flags:'a'});
	var morganEntry = '{"ip"\:":remote-addr","user"\:":user","timestamp"\:":date[clf]","method"\:":method",\
			"baseurl"\:":url","http_version"\:":http-version","status"\:":status","res"\:":res[content-length]",\
			"referrer"\:":referrer","agent"\:":user-agent"}'
	//With morgan, store entries in JSON format
	morgan.token('user',function getUser(req){
		if (req.user)
			return req.user[dbConstants.USERS.ID_FIELD];
		else
			return "";
	});
	app.use(morgan(, {stream:comLog}));


	//=======================================================================
	// Serve Static Public Content (ie, dont need to be logged in to access)
	//=======================================================================
	app.use("/static", express.static(path.join(nodeConstants.SERVER_DIR + "/public")));
	//=======================================================================
	//If using https then add redirect callback for all incoming http calls. //should be done with ip tables
	//=======================================================================
	if (opts.https){
		app.use(function (req, res, next) {
			if (req.secure) {
				// request was via https, so do no special handling
				next();
			} else {
				// request was via http, so redirect to https
				req.headers.host = req.headers.host.replace(/:.+/,"");
				var url = "https://" + req.headers.host + (opts.httpsPortNumber == 443 ? "":":" + opts.httpsPortNumber.toString()) + req.url;	
				res.redirect(url); //
			}
		});
	}
	//=======================================================================
	// Add Parsers
	//=======================================================================
	app.use(cookieParser());
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({extended:false}));
	require('./controllers/passport-config')(app,logger,opts,passport); //Set up passport 


	//=======================================================================	
	// Set up Passport to use Authentication
	//=======================================================================

	//=======================================================================
	// Initialize the session storage
	//=======================================================================
	var host = opts.mongodbHost
	var url = 'mongodb://'
	if (opts.authdb){
		url += opts.authdb + ':' + dbPassword + '@';
	} else if (dbConstants.DB.AUTH_USER !== null && dbConstants.DB.AUTH_PASSWD !== null){
		url += dbConstants.DB.AUTH_USER + ':' + dbConstants.DB.AUTH_PASSWD  + '@';
	}
	url += dbConstants.DB.HOST + ":" + dbConstants.DB.PORT + '/' + dbConstants.DB.NAME;
	try { 
		app.use(session({secret:'webb_app_server',
			store: new mongoStore({
				url:url
			}),
			resave:false,
			secure:true,
			saveUninitialized:false
		}));
		logger('info','Session information being stored in mongoStore',{target:'mongodb://' + dbConstants.DB.HOST + ':' + dbConstants.DB.PORT + '/' + dbConstants.DB.NAME});
	} catch (err) {
		console.log("ERROR could not connect to DB: " + err.message);
		process.exit(1);
	}


	app.use(passport.initialize());//initialize passport
	app.use(passport.session()); // initialize passport session storage
	app.use(flash()); // add flash storage
	app.set('views',nodeConstants.SERVER_DIR + '/views'); // add routes for the views
	app.engine('hbs',cons.handlebars); //Add the default rendering agent
	app.set('view engine', 'hbs');
	app.set('partialsDir', 'views/partials/');
	app.set('view engine', '.hbs');
	require('./controllers/routes')(app,logger,opts,passport);
	//=======================================================================
	// Connect and Initialzie the storage Database
	//=======================================================================
	dbFunctions.connectAndInitializeDB(logger,opts.authdb,dbPassword).catch(function(err){
		console.log("ERROR could not connect to DB: " + err.message);
		process.exit(1)
	});
	//=======================================================================
	// Start Listening on the set port
	//=======================================================================
	http.globalAgent.maxSockets = 25;
	if (opts.https){
		var privateKey = fs.readFileSync(opts.key);
		var certificate = fs.readFileSync(opts.crt);
		var credentials = {key:privateKey,cert:certificate};
		https.globalAgent.maxSockets = 25;
		http.createServer(app).listen(opts.httpPortNumber);
		https.createServer(credentials,app).listen(opts.httpsPortNumber);
		logger('info',"Server running on https port: " + opts.httpsPortNumber + " http port:" + opts.httpPortNumber);
	} else {
		logger('info',"Server runnong on http port: " + opts.httpPortNumber);
		app.listen(opts.httpPortNumber);
	}
})
.catch(function(err){
	//could not connect to databse or there was authentication issue
	process.stderr.write("ERROR: Could not connect to databse");
	process.stderr.write(err);
	process.exit(1);
});

//=======================================================================
// Exit Event
//=======================================================================
/* Listen for SIGINT events. These can be generated by typing CTRL + C in the 
 * terminal. */ 
process.on("SIGINT", function(){
	logger('info',"\nReceived interrupt signal. Closing connections to DB...");
	dbConnection.close(function() {
		logger("info","shutting down server");
		process.exit(0);
	});
});