var child_process=require('child_process');
var mongo = require("../node_modules/mongodb"); // this script must be run from the main fragnipani page
var fs = require('fs');
var Getopt = require("../node_modules/node-getopt")
var path = require("path");
var glob = require("../node_modules/glob")


/* This script will annotate and add a specified vcf file to a speceific mongodb. This is a temporary
 * File which will be replaced later on with a more robust upload method.
 * It requires several input from the user prior to use and will automatically connect
 * to the mongoDB 
*/

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
	process.exit(1);
} else {
	var annovarPath = path.resolve(opts.options['annovarpath']);
}
if (!opts.options['input']){
	cmdOpts.showHelp();
	process.exit(1);
} else {
	var inputFile = path.resolve(opts.options['input']);
}
if (!opts.options['table']){
	cmdOpts.showHelp();
	process.exit(1);
} else {
	var tableName = opts.options['table'];
}
if (!opts.options['output']){
	cmdOpts.showHelp();
	process.exit(1);
} else {
	var outputFile = path.resolve(opts.options['output']);
} if (opts.options['database'] & !opts.options['dbusage'] ||
	!opts.options['database'] & opts.options['dbusage']){

	console.log("Database options provide, please provide dbusage AND database")
	cmdOpts.showHelp();
	process.exit(1);
}
var databaseString;
var dbusageString;

if (opts.options['database']){
	var count1 = (opts.options['database'].match(/,/g) || []).length;
	var count2 = (opts.options['dbusage'].match(/,/g) || []).length;
	if (count1 !== count2){
		console.log("length of -database and -dbusage options does not match!");
		cmdOpts.showHelp();
		process.exit(1);
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
	if (fs.existsSync(opts.options['python'])){
		PYTHONPATH = path.resolve(opts.options['python']);
	} else {
		console.log("Could not find Python Executable");
		process.exit(1);
	}
} else {
	PYTHONPATH = 'python'
}

var PERLPATH;
if(opts.options['perl']){
	if (fs.existsSync(opts.options['perl'])){
		PERLPATH = path.resolve(opts.options['perl']);
	} else {
		console.log("Could not find Perl Executable");
		process.exit(1);
	}
} else {
	PERLPATH = 'perl';
}




//check to see if file exists
if (!fs.existsSync(inputFile)){
	console.log("Input File Does not Exist");
	process.exit(1)
}
//check to see if annovar path folder exists
if (!fs.existsSync(annovarPath)){
		console.log("AnnovarPath does Not Exist, please specify the correct path");
		process.exit(1);
}
if (!fs.existsSync(annovarPath + "/humandb")){
	console.log("Annotation Database not found, please specify correct path")
}


//construct annovarCmd **requires that all the libraries lister are installed
var annovarCmd = PERLPATH + ' '  + annovarPath + '/table_annovar.pl ' +  
	inputFile + ' ' + annovarPath + '/humandb/ -buildver hg19 -operation ' + dbusageString + '  -nastring . -vcfinput ' + 
	'-protocol  ' + databaseString

console.log("Annotation Command::: " + annovarCmd);
console.log("Annotating File...");

//spawn a child process taht executes that annovar command
child_process.exec(annovarCmd, function(err,stdout,stderr){
	if (err != null){
		console.log(err);
		process.exit(1);
	} else {
		console.log("Annotation complete");
		var tempOutputFile = inputFile + '.hg19_multianno.txt';

		//check to see if the output files from annovar exists
		if(!fs.existsSync(tempOutputFile)){
			console.log("Error in creating Annotated Files");
			process.exit(1);	
		}

		//construct python parse command
		var parserCmd = PYTHONPATH + ' ./parser.py ' + tempOutputFile + " " + outputFile;
		console.log("Parsing annotated output...");

		//spawn child process to parse the table in python
		child_process.exec(parserCmd, function(err,stdout,stderr){
			if (err != null){
				console.log(err);
				process.exit(1);
			} else {
				console.log("Parsing Complete")
				if (!fs.existsSync(outputFile)){
					console.log("Error in creating .js file from vcf input");
					process.exit(1);

				}

				//load the javascript output into memory
				console.log("Loading Parsed entries...")
				var entries = require(outputFile);
				if (!entries){
					console.log("did not load " + outputFile + " correctly");
					process.exit(1);
				}
				console.log("Loading complete")
				console.log("Connecting to db")

				//connect to database
				mongo.MongoClient.connect('mongodb://localhost:27017/patientDB',function(err,db){
					if (err){
						console.log(err);
						process.exit(1);
					} else {
						console.log("Creating Collection")
						//create a collection or raise an error if it already exists
						db.createCollection(tableName,{strict:true},function(err,collection){
							if (err){
								console.log("Collection " + tableName + " already exists. please choose another name");
								throw new 
								process.exit(1);
							} else {
								console.log("Adding entries to db...");
								//for each entry in the array of entries insert it into the collection.
								//There is an insertMany option however it leads to a segfault for some reason
								for (var i = 0; i < entries.length; i++){
									collection.insert(entries[i],function(err,d){
										if (err)
											console.log(err)

									});
								}
								console.log("Finished adding entries to db")
								//cleanup
								var files = glob.sync(inputFile + ".*");
								for ( var i = 0; i < files.length;i++){
									fs.unlinkSync(files[i]);
								}

								fs.unlinkSync(outputFile)


								process.exit(0);
							}
						});
						
					}

				});
			}
		});
	}
});















