/* ParseVCF.js
 * In order to complete the file upload into the database, the output from 
 * Annovar must be parsed. To ensure the fastest possible parsing and more
 * Memory efficient method, this module was written.
 *
 * THe parseVCF object taktes two parameters when initiated: file and patients.
 * with severa; optional parameteres following. Some vcf files can be extemeely
 * larege, therefore to facilitate file reading in an async manner, the parser
 * splits the file into chunks inserts them into a buffer, and then maps the 
 * parsed output to the header fields. Additionally, If multiple patients are 
 * provided, the parser automatically bulds the documents for each patient.
 * When the number of documents for each patient reaches just under 1000 (The current max)
 * of insertMany, the parser will attempt to insert the documents into the database.
 * It then clears the current document string to save memory
 * 
 * when the file reading is completed, all remaining documents are inserted and the file is
 * closed.
 * 
 *
 * written by Patrick Magee
*/
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));


/* Empty constructor for the parseVCF object */
var parseVCF = function(file,patients,dbFunctions,bufferSize){
	this.file = file;
	this.patients = patients;
	this.dbFunctions = dbFunctions;
	this.bufferSize = (bufferSize || 8192);
	this.size;
	this.fd;
	this.oldString = "";
	this.mapper = {};
	this.first = true;
	this.firstEntry = true;
	this.docMax = 999;
	this.patientObj = {};
	this.chunkArray = [];
};


/* Initialize the variables and dynamically determine the number of
 * chunks to split the file into, pushing them into an array
 * the chunkArray consists of objects with two properties:
 *
 * chunkLength: the maximum length of the chunk
 * chunkPosition: the position in the file where this chunk starts
 *
 * returns a promise
*/
parseVCF.prototype.init = function(){
	var self = this;
	return fs.statAsync(this.file)
	.then(function(result){
		self.size = result.size;
		var pos = 0;
		while (pos < self.size){
			var chunk = {};
			chunk['chunkLength'] = self.bufferSize;
			chunk['chunkPosition'] = pos;
			self.chunkArray.push(chunk);
			pos += self.bufferSize;	
		}
		if (pos < self.size + self.bufferSize){
			var chunk = {};
			chunk['chunkLength'] = self.bufferSize;
			chunk['chunkPosition'] = pos;
			self.chunkArray.push(chunk);
		}
	});
};

parseVCF.prototype.open = function(){
	var self = this;
	return fs.openAsync(this.file,'r')
	.then(function(fd){
		self.fd = fd;
	});
};

parseVCF.prototype.close = function(){
	return fs.closeAsync(this.fd);
};

///use the promise.reduce() function
parseVCF.prototype.read = function(){
	var self = this;
	return this.init()
	.then(function(){
		return self.open()
	}).then(function(){
		return self.chunkArray;
	}).each(function(chunk){
		return self.readAndParse(chunk);
	}).then(function(){
		return Object.keys(self.patientObj);
	}).each(function(patient){
		return self.cleanup(patient);
	}).then(function(){
		return self.close();
	}).catch(function(err){
		console.log(err.stack)
		self.close();
	});
};


parseVCF.prototype.readAndParse = function(chunk){
	var self = this;
	var buffer = new Buffer(chunk.chunkLength);
	return fs.readAsync(self.fd,buffer,0,chunk.chunkLength,chunk.chunkPosition)
		.then(function(buffer){
			return buffer[1].toString('utf-8',0,buffer[0]);
		}).then(function(string){
			if (self.oldString != ""){
				string = self.oldString + string;
			}
			splitString = string.split('\n');
			if (string.substr(string.length - 1) == "\n"){
				self.oldString = "";
			}  else {
				self.oldString = splitString.pop();
			}
			return splitString;
		}).then(function(stringArray){
			if (stringArray.length > 0 )
				return self.parseChunk(stringArray).map(function(patient){
					if (self.patientObj[patient]['documents'].length >= self.docMax)
						return self.checkAndInsertDoc(patient);
				});
		});
	};


parseVCF.prototype.parseChunk = function(stringArray){
	var self = this;
	var promise = new Promise(function(resolve,reject){
		for (var i=0; i < stringArray.length ; i++ ){
			if (stringArray[i] != "" || stringArray[i].slice(0,2) != "##"){
				line = stringArray[i].split('\t');
				if (self.first){
					line = line.filter(function(ele){
						if (ele != "Otherinfo")
							return ele;
					});
					for (var j=0; j<line.length; j++)
					{
						self.mapper[line[j].replace(/\./gi,'_').replace(/#/i,"")] = j;
					}
					self.first = false;
				} else {
					if (self.firstEntry){
						var formatReached = false
						var formatNum;
						for (var j=0; j<line.length;j++){
							if (line[j].match(/^rs[0-9]+$/)){
								self.mapper['identifier'] = j;
							} else if (line[j].match(/^GT+/)) {
								self.mapper['FORMATFIELD'] = j;
								formatReached = true;
								formatNum = j + 1;
							} else if (formatReached) {
								self.patientObj[self.patients[j - formatNum]['patient_id']] = {'id':j,'collection':self.patients[j - formatNum]['collection_id'],'documents':[]};
								
							}	
						}
						self.firstEntry = false;
					}
					if (line != ""){
						var formatMapper = [];
						var formatField = line[self.mapper['FORMATFIELD']].split(':');
						for (patient in self.patientObj){
							if (self.patientObj.hasOwnProperty(patient)){
								var currDoc = {};
								var formatLine = line[self.patientObj[patient]['id']].split(':');
								var cont = true;
								for (var j = 0; j < formatField.length; j++){
									var info = formatLine[j].split(/[\/|,]/);
									if (formatField[j] == 'GT'){
										if (info.indexOf('.') != -1){
											cont = false;
										} else {
											currDoc['GTRAW'] = formatLine[j];
											currDoc['GT'] = info;
											currDoc['phased_status'] = (formatLine[j].indexOf('|') != -1 || false);
										}
									} else if (cont){
										currDoc[formatField[j]] = (info.length == 1 ? info[0]:info);
									}
								}
								if (cont) { 
									for (field in self.mapper){
										if (self.mapper.hasOwnProperty(field)){
											var thisLine = line[self.mapper[field]].split(/,/);
											if (field !== 'FORMATFIELD' && thisLine != '.'){
												currDoc[field] = (thisLine.length == 1 ? thisLine[0]:thisLine);
											}
										}
									}
									self.patientObj[patient]['documents'].push(currDoc);
								}
							}
						}
					}
				}
			}
		}
		resolve(Object.keys(self.patientObj));
	});
	return promise;
};

parseVCF.prototype.cleanup = function(patient){
	var self = this;
	return this.checkAndInsertDoc(patient)
	.then(function(){
		if (self.patientObj[patient]['documents'].length > 0){
			self.cleanup(patient);
		}
	})
};


parseVCF.prototype.checkAndInsertDoc = function(patient){
	var self = this;
	var promise = new Promise(function(resolve,reject){
		var docsToInsert = self.patientObj[patient]['documents'];
		var ind = (docsToInsert.length > self.docMax ? self.docMax : docsToInsert.length);
		docsToInsert = docsToInsert.slice(0,ind);
		var options = {documents: docsToInsert,
				   collectionName:self.patientObj[patient]['collection']};
		
		dbFunctions.insertMany(options)
		.then(function(){
			self.patientObj[patient]['documents'] = self.patientObj[patient]['documents'].slice(ind);
			resolve(self.patientObj[patient]['documents'].length)
		}).catch(function(err){
			console.log(err);
		});
	});
	return promise;
};

module.exports = parseVCF;


