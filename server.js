/*
 * Frangipani genome annotation server that connects to genome storage servers
 * 
 * @author Ron Ammar, Patrick Magee
 */
var express= require("express"),
	dbFunctions= require("./frangipani_node_modules/mongodb_functions"),
	Promise= require("bluebird"),
	dbConstants= require("./frangipani_node_modules/mongodb_constants"),
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
	nodeConstants = require("./frangipani_node_modules/node_constants");



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
	.option('secondaryPortNumber',{
		abbr:'P',
		full:"port2",
		default:80,
		help:'specify the default port for incoming http connection'
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
	.parse();
opts.signup =  !opts.nosignup;
opts.recover = !opts.norecover;

console.log("Server running on port " + opts.portNumber);



//=======================================================================
// Initialize Express Server
//=======================================================================
//Create Log Directory in order to open read stream
try {
	fs.statSync(nodeConstants.LOG_DIR);
} catch (err) {
	fs.mkdirSync(nodeConstants.LOG_DIR);
};

//configure morgan to add the user to the logged file info:

morgan.token('user',function getUser(req){
		if (req.user)
			return req.user[dbConstants.USER_ID_FIELD];
		else
			return "";
	});

//Open write stream for log files
var comLog = fs.createWriteStream(__dirname + "/" + nodeConstants.LOG_DIR + "/" + nodeConstants.COM_LOG_PATH);
var app = express();
app.use(morgan(':remote-addr - :user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"', {stream:comLog}));

//If using https then add redirect callback for all incoming http calls.
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
				res.redirect('https://' + req.headers.host + ':' + opts.portNumber + req.url);

		}
	});
}


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

require('./frangipani_node_modules/passport-config')(passport,dbFunctions,opts)

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
				 secure:true,
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
if (opts.https){
	var privateKey = fs.readFileSync('ssl/frangipani.key');
	var certificate = fs.readFileSync('ssl/frangipani.crt');
	var credentials = {key:privateKey,cert:certificate};
	http.createServer(app).listen(opts.secondaryPortNumber)
	https.createServer(credentials,app).listen(opts.portNumber)
} else {
	app.listen(opts.portNumber);
}


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