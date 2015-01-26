//parser.js
var Promise = require('bluebird');
var fs = Promise.promisifyAll('require')


var find


var parseFile = function(file,patients,bufferSize){
	this.file = file;
	this.patients = patients;
	this.bufferSize = (bufferSize || 8192);
	this.size;
	this.chunckArray = {};
	this.fd;
	this.oldString;
	this.mapper = {};
	this.output = {};
	this.first = true;
	this.firstEntry = true;
};

parseFile.prototype.init = function(){
	return fs.statAsync(this.file)
	.then(function(result){
		this.size = result.size;
		if (this.bufferSize > this.size)
			this.bufferSize = this.size;
		var bufferSizeArray = this.size / this.bufferSizeArray;
		for(var i=0; i< bufferSizeArray; i++){
			this.bufferSizeArray.push(this.bufferSize)
			this.chunckArray.push(this.bufferSize * i);
		}
	});
};


///use the promise.reduce() function

parseFile.prototype.read = function(){

	this.init()
	.then(function(){
			return this.open()
	})
	.reduce(this.chunkArray,function(total,chunk){
		return this.readAndParse(chunk).then(function(result){
			return total + result;
		});
	}).then(function(){
		this.close();
	});
}

parseFile.prototype.open = function(){
	return fs.openAsync(this.file,'r')
	.then(function(fd){
		this.fd = fd;
		return fd;
	});
};

parseFile.prototype.readAndParse = function(chunk){
	var promise = new Promise(function(resolve,reject){
		var buffer = new Buffer();
		fs.readAsync(this.fd,buffer,0,chunk.chunkLength,chunk.chunkPosition)
		.then(function(err,bytesRead,buffer){
			return buffer.toString('utf-8',0,bytesRead)

		}).then(function(string){
			if (this.oldString != ""){
				string = this.oldString + string
			}

			splitString = string.split('\n');
			if (string.substr(string.length - 1) == "\n"){
				this.oldString = "";
			}  else {
				this.oldString = splitString.pop();
			}

			return splitString;
		}).then(function(stringArray){
			if (stringArray.length > 0 )
				return parseChunk(stringArray)
		}).then(function()
			resolve(chunk.chunkLength));
		});
	});
	return promise;
}


parseFile.prototype.parseChunk = function(stringArray){
	var promise = new Promise(function(resolve,reject){
		for (var i=0; i < stringArray.length ; i++ ){
			line = stringArray[i].split('\t');
			if (this.first){
				line = line.filter(function(ele){
					if (ele != "Otherinfo")
						return ele;
				});

				for (var j=0; j<splitLine.length; j++){
					mapper[j] = splitLine[j];
				}

				this.first = false;
			} else {
				if (this.firstEntry){
					var formatReached = false
					for (var j=0; j<line.length;j++){
						if (line[j].match(/^rs[0-9]+$/)){
							mapper[j] = 'identifier';
						} else if (line[i].match(/^GT:+/)) {
							mapper[j] = 'FORMATFIELD';
							formatReached = true;
						} else if (formatReached) {
							this.patientObj[j] = this.patientsd['pa']

						}

							for (var j=1; j <= patients.length; j++){
							patientGT[patients['patient_id']]={collection:patients['collection_id'],
																		   column:j+i,
																		   documents:{}}; 
									}	
						} 
					}
					this.firstEntry = false;
				}

				this.patients






		}
	})

}

var ParseFile2 = function(file,patients){
	var promise = newPromise(function(resolve,reject){
		var lines = {};
		var incompleteBuffer;
		var bufferSize = 8192
		var currentBuffer;
	}








var parseFile = function(file,patients){
	var promise = new Promise(function(resolve,reject){
		var line = ""
		var row = 0;
		var mapper= {};
		var stream = fs.createReadStream(file,{
			flags:'r',
			encoding:'utf-8',
			fd:null,
			bufferSize:1
		})

		var patientGT ={};
		var sharedFields ={};
		
		stream.addListener('data',function(char){
			Promise.resolve().then(function(){
				stream.pause();
			}).then(function(){
				if (row %1000 == 0){
					//at the 1000th entry




				}
			}).then(function(){
				if(char == '\n'){
					if (row == 0){
						var splitLine = line.split('\t')
						
						row++

					} else {
						var splitLine = line.split('\t')
						if (row==1){
							for (var i=0; i<splitLine.length;i++){
								if (splitLine[i].match(/^rs[0-9]+$/)){
									mapper[i] = 'identifier'
								} else if (splitLine[i].match(/^GT:+/)) {
									mapper[i] = 'FORMATFIELD'
									
								}
							}
						}
						sharedFields[row] = {}
						for (idField in mapper)

							if (mapper.hasOwnProperty[idField]){
								if (mapper[i] === 'FORMATFIELD'){
									var format = splitLine[idField].split(':')
									for (patient in patientGT){
										if (patientGT.hasOwnProperty(patient)){
											if (splitLine[patientGT[patient]['column']].match(/\.[\/|]\.:+/)==null){
												var info = splitLine[patientGT[patient]['column']].split(':');
												for (var j=0; j<format.length; j++){
													patientGT[patient][documents][row] = {}
													var inputField;
													if (format[j] == 'GT'){
														patientGT[patient][documents][row]['GTRAW'] = info[j];
														patientGT[patient][documents][row]['phased_status'] = (info[j].indexOf('|') != -1 || false);
														inputField = info[j].split(/[\/|]/);
													} else {
														inputField = info[j].split(',');
													}
													patientGT[patient][documents][row][format[j]] = inputField; 
												}
											}
										}

								} else {
									if (splitLine[idField] !== '.')
										sharedFields[row][mapper[idField]] = splitLine[idField];
								}
							}
						}
					line = '';
				}
				row++;
			}).then(function(){
				if (char !='\n')
					line += char;
			}).then(function(){
				stream.resume();
			});

		});

	});

};