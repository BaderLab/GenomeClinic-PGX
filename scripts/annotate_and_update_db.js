var Promise = require("../node_modules/bluebird");
var db = require("../frangipani_node_modules/DB");
var fs = Promise.promisifyAll(require('fs'));
var path = require("path");
var glob = Promise.promisifyAll(require("../node_modules/glob"));
var child_process=Promise.promisifyAll(require('child_process'));
var lineReader = Promise.promisifyAll(require('../node_modules/line-reader'));





/* This script will annotate and add a specified vcf file to a speceific mongodb. This is a temporary
 * File which will be replaced later on with a more robust upload method.
 * It requires several input from the user prior to use and will automatically connect
 * to the mongoDB 
*/










var annotateAndAddVariants = function(options){
	var InputError = function(message){
		this.name = "InputError";
		this.message = ( message || "" );
	}
	InputError.prototype = Object.create(Error.prototype);

	var InvalidArgument = function(message){
		this.name = "InvalidArgument";
		this.message = ( message || "" );
	}
	InvalidArgument.prototype = Object.create(Error.prototype);

	var AnnotationError = function(message){
		this.name = "AnnotationError";
		this.message = ( message || "" );
	}
	AnnotationError.prototype = Object.create(Error.prototype);

	var ParseError = function(message){
		this.name = "ParseError";
		this.message = ( message || "" );
	}
	ParseError.prototype = Object.create(Error.prototype);

	var MongoError = function(message){
		this.name = "MongoError";
		this.message = ( message || "" );
	}
	MongoError.prototype = Object.create(Error.prototype);


	var promise = new Promise(function(resolve,reject){
		/*
		if (!options['annovarpath']){
			annovarPath = '/Users/patrickmagee/Tools/annovar'
			//throw new InvalidArgument("AnnovarPath not provided");
		} else {
			var annovarPath = path.resolve(options['annovarpath']);
		}
		
		if (!options['input']){
			throw new InvalidArgument("Input file path not provided");
		} else {
			var inputFile = path.resolve(options['input']);
			var tempOutputFile = inputFile + '.hg19_multianno.txt';
		}
		if (!options['table']){
			throw new InvalidArgument("Table name not provided");
		} else {
			var tableName = options['table'];
		}

		if (!options['output']){
			throw new InvalidArgument("Output file path not provided");
		} else {
			var outputFile = path.resolve(options['output']);
		} if (options['database'] & !options['dbusage'] ||
			!options['database'] & options['dbusage']){
			throw new InvalidArgument("Database options provide, please provide dbusage AND database");
		}

		var databaseString;
		var dbusageString;

		if (options['database']){
			var count1 = (options['database'].match(/,/g) || []).length;
			var count2 = (options['dbusage'].match(/,/g) || []).length;
			if (count1 !== count2){
				throw new InvalidArgument("length of -database and -dbusage options does not match!");
			} else {
				databaseString = options['database'];
				dbusageString = options['dbusage'];
			}

		} else {
			databaseString = 'refgene,esp6500_all,ljb26_all,clinvar_20140929,cg69,1000g2014sep_amr,1000g2014sep_eas,1000g2014sep_afr,1000g2014sep_eur,1000g2014sep_sas,1000g2014sep_all';
			dbusageString = 'g,f,f,f,f,f,f,f,f,f,f';
		}
		*/
		/*
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
		*/

		//check to see if file exists


		var annovarPath = '/Users/patrickmagee/Tools/annovar'
		var inputFile = 'test.vcf';
		var tempOutputFile = inputFile + '.hg19_multianno.txt';
		var outputFile = 'test.json';
		var tableName = 'test2';
		var databaseString = 'refgene';
		var dbusageString = 'g';


	
		fs.statAsync(inputFile)
		.then(function(){
			return fs.statAsync(annovarPath);
		})
		.then(function(){
			return db.connect('mongodb://localhost:27017/patientDB').then(function(db){
				console.log("Connected to Database")
			});
		})
		.then(function(){
			return db.createTable(tableName).then(function(db){
				console.log("Table Created");
			});
		})
		.then(function(){
			var annovarCmd = 'perl '  + annovarPath + '/table_annovar.pl ' +  
				inputFile + ' ' + annovarPath + '/humandb/ -buildver hg19 -operation ' + dbusageString + '  -nastring . -vcfinput ' + 
				'-protocol  ' + databaseString
			console.log("Annotation Command::: " + annovarCmd);
			console.log("Annotating File...");
			return child_process.execAsync(annovarCmd)
			})
		.then(function(){
			return fs.statAsync(tempOutputFile)
		})
		.then(function(){
			console.log("Annotation complete");
			var parserCmd = 'python ./parser.py ' + tempOutputFile + " " + outputFile;
			console.log("Parsing annotated output...");
			return child_process.execAsync(parserCmd);
			})
		.then(function(err,stdout,stderr){
			if (stderr != null){
				throw new ParseError(err);
			} 
			})
		.then(function(){
			return fs.statAsync(outputFile);
		})	
		.then(function(){
			console.log("Reading json data")
		})
		.then(function(){
			return fs.readFileAsync(outputFile).then(JSON.parse)
		})
		.then(function(data){
			var tempList = []
			var maxInput = data.length
			//bulk write operations are currently limited to 1000 entries,
			//therefore you need to split the entries int smaller chuncks
			for (var i = 0; i < maxInput; i+=1000){
				var max;
				if (i + 999 > maxInput){
					max = maxInput;
				} else {
					max = i + 1000;
				}
				tempList.push(data.slice(i,max))
			} 
			return tempList
		})
		.each(function(docs){
			return db.insertMany({tableName:tableName,documents:docs});	
		})
		.then(function(docs){
			var totalLength= 0;
			for (var i = 0; i < docs.length; i++)
				totalLength += docs[i].length;
			console.log('Total Items Inserted into ' + tableName + ': ' + totalLength);
		})
		.then(function(){
			return glob.globAsync(inputFile + ".*");
		})
		.each(function(file){
			return fs.unlinkAsync(file);
		})
		.then(function(){
			return fs.unlinkAsync(outputFile);
		})
		.then(function(){
			console.log("Cleanup Successfull");
		}).catch(function(err){
			console.log(err)
		})	
		.done(function(){
			db.db.close();
			resolve("completed data insert");
		})
			
	});
	
	return promise;
}

exports.annotateAndAddVariants = annotateAndAddVariants

	
		








