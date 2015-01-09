var Promise = require("../node_modules/bluebird");
var db = require("../frangipani_node_modules/DB");
//var mongo = require("../node_modules/mongodb"); // this script must be run from the main fragnipani page
var fs = Promise.promisifyAll(require('fs'));
var Getopt = require("../node_modules/node-getopt")
var path = require("path");
var glob = Promise.promisifyAll(require("../node_modules/glob"))
var child_process=Promise.promisifyAll(require('child_process'));
function InputError(message){
	this.name = "InputError";
	this.message = ( message || "" );
}
InputError.prototype = Object.create(Error.prototype);

function InvalidArgument(message){
	this.name = "InvalidArgument";
	this.message = ( message || "" );
}
InvalidArgument.prototype = Object.create(Error.prototype);

function AnnotationError(message){
	this.name = "AnnotationError";
	this.message = ( message || "" );
}
AnnotationError.prototype = Object.create(Error.prototype);

function ParseError(message){
	this.name = "ParseError";
	this.message = ( message || "" );
}
ParseError.prototype = Object.create(Error.prototype);


/* This script will annotate and add a specified vcf file to a speceific mongodb. This is a temporary
 * File which will be replaced later on with a more robust upload method.
 * It requires several input from the user prior to use and will automatically connect
 * to the mongoDB 
*/




var main = function(){ 
	promise = new Promise(function(resolve,reject){
		var annovarCmd;
		var parserCmd;
		var cmdOpts = new Getopt([
			['a','annovarpath=ARG',"Path to Annovar Directory. Required"],
			['i','input=ARG','Input Vcf file. Required'],
			['o','output=ARG','Output file name. Required'],
			['t','table=ARG','New Table Name. Required (for now)'],
			['d','database=ARG','specify databses (protocol) to use. if no option given uses default'],
			['u','dbusage=ARG','specify operations to use if -db option given'],
			['p','perl=ARG','path to perl exectuable'],
			['P','python=ARG','path to python executable'],
			['h','help','display this help']])
		.bindHelp();
		var opts = cmdOpts.parseSystem();
		//console.info(opts);

		//check for  required arguments and set variables to argument
		if (!opts.options['annovarpath']){
			cmdOpts.showHelp();
			reject(new InvalidArgument("AnnovarPath not provided"));
		} else {
			var annovarPath = path.resolve(opts.options['annovarpath']);
		}
		if (!opts.options['input']){
			cmdOpts.showHelp();
			reject(new InvalidArgument("Input file path not provided"));
		} else {
			var inputFile = path.resolve(opts.options['input']);
			var tempOutputFile = inputFile + '.hg19_multianno.txt';
		}
		if (!opts.options['table']){
			cmdOpts.showHelp();
			reject(new InvalidArgument("Table name not provided"));
		} else {
			var tableName = opts.options['table'];
		}
		if (!opts.options['output']){
			cmdOpts.showHelp();
			reject(new InvalidArgument("Output file path not provided"));
		} else {
			var outputFile = path.resolve(opts.options['output']);
		} if (opts.options['database'] & !opts.options['dbusage'] ||
			!opts.options['database'] & opts.options['dbusage']){
			cmdOpts.showHelp();
			reject(new InvalidArgument("Database options provide, please provide dbusage AND database"));
		}
		var databaseString;
		var dbusageString;

		if (opts.options['database']){
			var count1 = (opts.options['database'].match(/,/g) || []).length;
			var count2 = (opts.options['dbusage'].match(/,/g) || []).length;
			if (count1 !== count2){
				cmdOpts.showHelp();
				reject(new InvalidArgument("length of -database and -dbusage options does not match!"));
			} else {
				databaseString = opts.options['database'];
				dbusageString = opts.options['dbusage'];
			}

		} else {
			databaseString = 'refgene,esp6500_all,ljb26_all,clinvar_20140929,cg69,1000g2014sep_amr,1000g2014sep_eas,1000g2014sep_afr,1000g2014sep_eur,1000g2014sep_sas,1000g2014sep_all';
			dbusageString = 'g,f,f,f,f,f,f,f,f,f,f';
		}

		var PYTHONPATH;
		if(opts.options['python']){
			PYTHONPATH = path.resolve(opts.options['python']);	
		} else {
			PYTHONPATH = 'python'
		}
		var PERLPATH;
		if(opts.options['perl']){
			PERLPATH= path.resolve(opts.options['Perl']);
		} else {
			PERLPATH = 'perl'
		}

		//check to see if file exists

		fs.statAsync(inputFile)
		.then(fs.statAsync(annovarPath))
		.then(function(){
			

			var annovarCmd = PERLPATH + ' '  + annovarPath + '/table_annovar.pl ' +  
				inputFile + ' ' + annovarPath + '/humandb/ -buildver hg19 -operation ' + dbusageString + '  -nastring . -vcfinput ' + 
				'-protocol  ' + databaseString



			console.log("Annotation Command::: " + annovarCmd);
			console.log("Annotating File...");

			return child_process.execAsync(annovarCmd)
		}).then(function(err,stdout,stderr){
			if (stderr != null){
				throw new AnnotationError(err);	
			} 
		}).then(fs.statAsync(tempOutputFile))
		.then(function(){
			console.log("Annotation complete");
			var parserCmd = PYTHONPATH + ' ./parser.py ' + tempOutputFile + " " + outputFile;
			console.log("Parsing annotated output...");
			return child_process.execAsync(parserCmd);
		}).then(function(err,stdout,stderr){
			if (stderr != null){
				throw new ParseError(err);
			} 
			console.log("Loading Parsed entries...");
		}).then(db.createTable(tableName).catch(function(err){throw new Error(err)}))
		.then(fs.statAsync(outputFile))	
		.then(fs.readfileAsync(tempOutputFile))
		.then(JSON.parse)
		.each(function(entry){
			db.insert({'tableName':tableName,documents:entry})
		}).catch(function(err){
			console.log(err)
		}).done(resolve("completed data insert"))
	});
	
	return promise;
}

main().catch(function(err){console.log(err)})


	
		








