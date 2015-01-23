/* Node module for the annotaion, parsing and uploading of a vcf file to a
 * running database (currently set to mongodb). the input is first checked
 * to ensure proper file formats are uploaded, annoation paths are set
 * and the options provided are correct. Additionally currently the module
 * specifies the option table as a required option to provide a table name.
 * this will eventually be removed and changed to patientname with the table
 * name automatically being determined.
 *
 *
 * Written by Patrick Magee
*/
var Promise = require("../node_modules/bluebird");
//var db = require("../frangipani_node_modules/DB");
var fs = Promise.promisifyAll(require('fs')); 
var path = require("path");
var glob = Promise.promisifyAll(require("../node_modules/glob"));
var child_process=Promise.promisifyAll(require('child_process'));



//Custom Errors for event handling
function InputError(message){
		this.name = "InputError";
		this.message = ( message || "" );
		Error.call(this);
		Error.captureStackTrace(this,this.constructor);
};
InputError.prototype = Object.create(Error.prototype);
InputError.prototype.constructor = InputError;

function AnnotationError(message){
		this.name = "AnnotationError";
		this.message = ( message || "" );
		Error.call(this);
		Error.captureStackTrace(this,this.constructor);
};
AnnotationError.prototype = Object.create(Error.prototype);
AnnotationError.prototype.constructor = AnnotationError;

function ParseError(message){
		this.name = "ParseError";
		this.message = ( message || "" );
		Error.call(this);
		Error.captureStackTrace(this,this.constructor);
};
ParseError.prototype = Object.create(Error.prototype);
ParseError.prototype.constructor = ParseError;

function AnnovarError(message){
	this.name = "AnnovarError";
	this.message = ( message || "" );
	Error.call(this);
	Error.captureStackTrace(this,this.constructor);
};
AnnovarError.prototype = Object.create(Error.prototype);
AnnovarError.prototype.constructor = AnnovarError;



/* annotateAndAddVariants:
 * Main function that facilitates the annotation of variants
 * as well as their addition to a databse. It takes a single parameter:
 * 'options' which is a js object that contains the following arguments:
 *
 * input: path to input file in vcf format. REQUIRED
 * output: path to output json object in json format.  REQUIRED (currently) -> furture set to temp file
 * table: name of table to add entries to. REQUIRED -> future set to auto assign
 * annodb: "comma separated list of annovar databases to use for annotation". OPTIONAL
 * dbusage: if database provided you MUST provide this comma separated list of g/f/r telling annovar the type of db. OPTIONAL
 * annovarpath: specify the home directory of annovar to point to. OPTIONAL -> default set. -> future us config file to set defaul

 */


function annotateAndAddVariants(options){
	//new promise to return
	var promise = new Promise(function(resolve,reject){
		if (!options['annovarpath']){
			annovarPath = '/Users/patrickmagee/Tools/annovar'; // hard coded annovarpath --once on server to be set from config file
			//throw new InvalidArgument("AnnovarPath not provided");
		} else {
			var annovarPath = path.resolve(options['annovarpath']);
		}
		//check for input file. if not defined or not vcf raise error
		if (!options['input']){
			throw new InputError("Input file path not provided");
		} else if (!(path.extname(options['input']) == ".vcf")){
			throw new InputError("Input file must be vcf format");
		} else {
			var inputFile = path.resolve(options['input']);
			var tempOutputFile = inputFile + '.hg19_multianno.txt';
		}
		//check for table name 
		if (!options['table']){ //Eventually to be removed in place of table meta data information. ie. patient name and such
			throw new InputError("Table name not provided"); 
		} else {
			var tableName = options['table'];
		}

		//check for output file if not provided raise error
		if (!options['output']){
			throw new InputError("Output file path not provided");
		} else {
			var outputFile = path.resolve(options['output']);
		} if (options['annodb'] & !options['dbusage'] || //If different annotations go be done other then default
			!options['annodb'] & options['dbusage']){
			throw new InvalidArgument("Annotation options provided, please provide dbusage and database options");
		}

		//set annovar database variables
		var annodbString;
		var dbusageString;
		//check to ensure matching leng of arguments between dbusage and database
		if (options['annodb']){ 
			var count1 = (options['annodb'].match(/,/g) || []).length;
			var count2 = (options['dbusage'].match(/,/g) || []).length;
			if (count1 !== count2){
				throw new InvalidArgument("length of -annodb and -dbusage options does not match!");
			} else {
				annodbString = options['annodb'];
				dbusageString = options['dbusage'];
			}

		} else {
			//default values
			annodbString = 'refgene,esp6500_all,ljb26_all,clinvar_20140929,cg69,1000g2014sep_amr,1000g2014sep_eas,1000g2014sep_afr,1000g2014sep_eur,1000g2014sep_sas,1000g2014sep_all';
			dbusageString = 'g,f,f,f,f,f,f,f,f,f,f';
		}

		//Check to see whether input file exists and if annovarPath exists
		fs.statAsync(inputFile)
		.then(function(){
			return fs.statAsync(annovarPath);
		})
		//.then(function(){
			//connect to localdatabse --> currently hardcoded modify to use config file
		//	return db.connect('mongodb://localhost:27017/patientDB');
		//})
		.then(function(){
			//create newTable and raise exception oif tablname already exists
			return dbFunctions.createCollection(tableName);
		})
		.then(function(){

			return dbFunctions.createIndex(tableName,{'Chr':1,'Start':1,'End':1});

		})
		.then(function(){

			//add event logging
			var execPath = path.resolve(annovarPath + '/table_annovar.pl');
			var dbPath = path.resolve(annovarPath + "/humandb/");
			var logFile = path.resolve(annovarPath + "/log.txt");
			var annovarCmd = 'perl \"'  + execPath +  "\" \"" + inputFile + '\" \"' + dbPath + '\"  -buildver hg19 -operation ' + dbusageString + '  -nastring . -vcfinput ' + 
				'-protocol  ' + annodbString;

			//run annovar command as a child process
			return child_process.execAsync(annovarCmd,{maxBuffer:1000000*1024});

		})
		.then(function(err,stdout,stderr){
			//if an error occurs during running annovarCmd raise a new error
			if (stderr != null){
				throw new AnnovarError(stderr);
			}
		})
		.then(function(){
			//check to ensure the tempOutFile was created
			return fs.statAsync(tempOutputFile);
		})
		.then(function(){
			//parse the contents of the temporary outfile with the parse.py script as a child process
			var execPath = 'scripts/parser.py';
			var parserCmd = 'python \"' + execPath + "\" \"" + tempOutputFile + "\" \"" + outputFile + "\"";
			return child_process.execAsync(parserCmd);
		})
		.then(function(err,stdout,stderr){
			//if an error occurs during running of parse.py raise new error
			if (stderr != null){
				throw new ParseError(err);
			} 
		})
		.then(function(){
			//check to ensure outputfile successfully created
			return fs.statAsync(outputFile);
		})	
		.then(function(){
			//read data from parsed file and load it into node
			return fs.readFileAsync(outputFile).then(JSON.parse);
		})
		.then(function(data){
			var tempList = [];
			var maxInput = data.length;
			//bulk write operations are currently limited to 1000 entries,
			//therefore you need to split the entries int smaller chuncks
			// of 1000
			for (var i = 0; i < maxInput; i+=1000){
				var max;
				if (i + 999 > maxInput){
					max = maxInput;
				} else {
					max = i + 1000;
				}
				tempList.push(data.slice(i,max));
			} 
			return tempList;
		})
		.each(function(docs){
			//call the insertMany method on each list entry
			return dbFunctions.insertMany({tableName:tableName,documents:docs});
		})
		.then(function(docs){
			//for future logging purposes
			var totalLength= 0;
			for (var i = 0; i < docs.length; i++)
				totalLength += docs[i].length;
			return totalLength;
		})
		.then(function(length){
			resolve('completed Annotation and uploaded ' + length + ' entries');
		})
		/*
		*  Custom error handlers for future use
		* 
		*
		.catch(MongoError,function(err){ //Eventually add custom events to custom errros
			//console.log(err)
			/*if (tableName exists)
			 *	remove table
			 
			console.log(err.message);
			console.log(err.stack);
			reject(err)
		})

		.catch(InputError,function(err){
			//console.log(err);

			console.log(err)
			reject(err)
		})
		.catch(ParseError,function(err){
			console.log(err);
			console.log(err.stack);
			reject(err);

		})
		.catch(AnnovarError,function(err){
			console.log(err);
			reject(err);
		})
		*/
		.catch(function(err){
			return dbFunctions.dropCollection(tableName)
			.then(function(){
				console.log(err);
			}).catch(function(drop_err){
				console.log(drop_err);
			})
		})
		.done(function(){
			//Cleanup, remove files and close db connection
			glob.globAsync(inputFile + ".*")
			.each(function(file){
				return fs.unlinkAsync(file);
			})
			.then(function(){
				return fs.unlinkAsync(outputFile);
			})
			.then(function(){
				if (db.db){
					db.db.close();
				}
			})
			.catch(function(err){
				//do nothing
				return null;
			});
		})
			
	});
	
	return promise;
}

module.exports = annotateAndAddVariants

	
		








