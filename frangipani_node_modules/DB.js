
/* MONGO DB DRIVER WITH PROMISES
 * 
 * This script will automatically connect to and set the mongo DB to be used 
 * additionally it attaches all of the methods that may be needed to a db
 * object that can be exported.
 * 
 * this script usess the mongodb native driver and adds promises to them
 * with the aid of bluebird, it is not a complete library, however it containes
 * the basics for whatever is needed. Additionally the function names are set
 * to be generic so that this script may be swapped out at any time for anotehr
 * database if we choose to change at any given time
 *
 *
 * writeen by: @Patrick Magee
 * email: patrickmageee@gmail.com
 * 19/12/2014
*/



var mongo = require('mongodb');
var Promise = require('bluebird');





/* empty db class object which will contain all methdos
*/

var db = function() {
	this.db = null;
}



/* connect to a specified data base by passing in the url
 * in the form:  mongo://[hostname]:[port]/[database]
 * when you connect to a db, the function will automatically
 * set the db objects this.db field to the returned db
*/
db.prototype.connect = function(url){
	var self = this;
	var promise = new Promise(function(resolve,reject){
		if (!url)
			throw new Error('No db argument');
		//connect
		mongo.MongoClient.connect(url,function(err,db){
			if (err)
				reject(err);
			else
				//add the db to the db class object
				self.db = db;
				resolve(self);
		});
	});
	return promise;
};



/* Create a table method. while in mongo a collaection will be created
 * if you perform ANY action on a named colleciton, even if it does not exist
 * this is the preffered way for creating a colleciton. This method relies on
 * createCollection mongo method that will only create a table if one does not
 * already exist. the databse object is returned
*/
db.prototype.createTable = function(name){
	var self = this;
	var promise = new Promise(function(resolve,reject){
		if (name){
			self.db.createCollection(name,{strict:true},function(err,collection){
				if ( err ){
					reject(err);
				} else {
					resolve(self);
				}
			});
		} else {
			reject(new ReferenceError("No options were defined"));
		}
	});
	return promise
}

/* Fetch a collection for one time use. This method will get the table defined
 * by "name" and return the table, and all of its methods as a collection object
 * 
 * important note: fetching a none exisant collection will return a newly created
 * collection. 
*/
db.prototype.getTable = function(name){
	var self = this;
	var promise = new Promise(function(resolve,reject){
		if(name){
			self.db.collection(name, function(err, _collection){
				if( err ){
					reject(err);
				} else {
					resolve(_collection);
				}
			});
		} else { 
			reject(new ReferenceError('tableName was not Defined'));
		}
	});
	return promise;
};

/* Set the this.collection attribute of the db class opject to the returned
 * table. currently this methods is not employed by other functions, instead
 * they use the one time getTable method, howver on a larger dataset, this method
 * would save time.
*/

db.prototype.setTable = function(name){
	var self = this;
	var promise = new Promise(function(resolve,reject){
		if(name){
			self.getTable(name)
			.then(function(table){
				self.collection = table;
				resolve(self);
			}).catch(function(err){
				reject(err);
			});
		} else {
			reject(new ReferenceError("CollectionName was not Defined"));
		}
	});
	return promise;
};


/* Method for ensuring a unique field in a database
*
* The options parameter is a single object with two options:
* tableName: the collection name to be searched
* query: the field that you want to make unique.
*/
db.prototype.ensureIndex = function(options){
	var self = this;
	var promise = new Promise(function(resolve,reject){
		if (!options.tableName || !options.field )
			reject(new RefferenceError("No Table Name or fields provided"));
		query = {};
		query[options.field] = 1;
		self.getTable(options.tableName).then(function(collection){
			collection.ensureIndex(query,{unique:true},function(err,index){
				if(err)
					reject(err)
				else
					resolve(self)
			});
		});
	});
	return promise;
}



/* insert data into a specificed collection buy doing a one time call to
 * the collection. If an error occurs it is returned and the data is not 
 * inserted.
 *
 * the options parameter is a single object wiht two options:
 * tableName: the collection to insert into
 * documents: an object which consists of documents to insert into a table
 * 
 * to set a custom _id field simply include '_id' as an attribute within the document 
 * object and set it equal to whataever you want. its important to note that only
 * unique id's will be accepted.
*/
db.prototype.insert = function(options){
	var self = this;
	var promise = new Promise(function(resolve,reject){
		if (!options.tableName)
			reject(new ReferenceError("No Table Name Provided"));

		self.getTable(options.tableName).then(function(collection){
			collection.insert(options.documents, function(err,doc){
				if (err){
					reject(err);
				} else{
					resolve(doc);
				}
			});
		});
	});
	return promise;
};




/* app specific function for inserting a new patient into the patientTable
 * the app automatically generates an ID for the individal that is based on the
 * count table. each new patient increments the count table by 1. if a patient is
 * removed the count table does not decrement. this is to ensure unique identifiers
 * are attributed to each patient. the required fields are are callSetID and variantSetId
 * to allow for patient tracking
 * 
 * the options you provide are essentially the documents object to be inserted ie:
 *    {sex:'m',callSetId:'100-2',variantSetId:'100',age:23}
 */
db.prototype.insertPatient = function(options){
	var self = this;
	
	var promise = new Promise(function(resolve,reject){
		if (!options.callSetId || !options.variantSetId){
			reject(new ReferenceError('No information on CallsetId or VariantSetId provided'));
		}
		//prepared options to insert patient
		var passedOptions = {
			documents:options,
			tableName: "patientTable"
		};

		//get th next patient ID.
		self.getNextNumber().then(function(num){
			options['_id'] = num;
			//console.log(options);

			//pass the prepared options to the insert method.
			return self.insert(passedOptions)
			.then(function(doc){
				resolve(doc)
			}).catch(function(err){
				//if there was an error, reset the count back to what it was previously
				self.getTable('count').then(function(collection){
					//De increment the count field
					collection.update({_id:'userid'}, { $inc: {seq:-1}},function(err,call){
						if (err){
							console.log(err);
						}
					});
				}).then(function(){
					reject(new Error('CallSetId Already Exists'));
				});
			});
		});

	});
	return promise;
}



/* get the next patient ID number by incrementing
 * the current one and returning the new value.
 * function takes no options
*/
db.prototype.getNextNumber = function(){
	return this.findAndModify({
			query:{_id:'userid'},
			update:{$inc:{seq:1}},
			options: {new:true},
			sort:[['_id',1]],
			tableName:"count"
	}).then(function(nextNumber){
		return nextNumber.seq
	});
};


/* method for finding, modifying and then doing something (depending on the options parameter)
 * to one or more entries in a single table. there are three required fields and one optional one
 * that can be passed in as an object.
 *
 * query: object which has the query within it
 * update: object which tells the function what to do with the items it found
 * sort: how to sort the object if there is more then one returned. ie [['_id',1]] would be sort id ascending
 * options: optional parameter for adding a bit more functionality to the findAndModify function. ie
 * 			return a new value once the old one has been changed
*/
db.prototype.findAndModify = function(options){
	var self = this;
	var promise = new Promise(function( resolve, reject){
		if(!options.query || !options.update || !options.tableName){
			reject(new ReferenceError('Incomplete Parameters'));
		}
		self.getTable(options.tableName).then(function(collection){
			collection.findAndModify( options.query , options.sort , options.update , options.options , function(err,doc){
				if (err){
					reject(new Error(err));
				} else {
					resolve(doc);
				}
			});
		});
	});
	return promise;
}


/* Method for finding and returning entries in a table based on the supplied query
 * 
 * the two required options are:
 * tableName : the collection to query
 * query : an object with the query defined.
 * 
 * if the query is not defined it will return all entries in the table.
 *
 * an array is returned containing all entries that were found.
 */
db.prototype.find = function(options){
	var self = this;
	var promise = new Promise(function(resolve,reject){
		if (!options.tableName){
			reject(new ReferenceError('CollectionName was not Defined'))
		}
		if (!options.query){
			options.query = {}
			//reject(new ReferenceError('Query is not defined to find all use DB.findAll'));
		}
		self.getTable(options.tableName).then(function(collection){
			collection.find(options.query).toArray(function(err,array){
				if (err){
					reject(err);
				} else {
					resolve(array);
				}
			});
		}).catch(function(err){
			reject(err);
		});

	});
	return promise;
}


/* wrapper for finding all the entries in a table
*/
db.prototype.findAll = function(tableName){
	var options = {
		tableName: tableName,
		query: {}
	}
	return this.find(options);
};


/* update the entries in an existing table
 * required options are:
 * query: an object telling the search whaat to find
 * uodate: an object that contains what should be changed

*/

db.prototype.update = function(options){
	var self = this;
	var promise = new Promise(function(resolve,reject){
		if (!options.tableName)
			reject(new ReferenceError('tableName was not defined'));
		else if (!options.query)
			reject(new ReferenceError('query was not defined'));
		else if (!options.update)
			reject(new ReferenceError('update was not defined'));

		self.getTable(options.tableName).then(function(collection){
			collection.update(options.query,options.update,function(err,doc){
				if (err){
					reject(err);
				} else {
					resolve(doc);
				}
			});
		});
	});
	return promise;
}



/* Method for adding a new panel to the mongodb.
 * panel must have a unique identifier and minimal 
 * information prior to it being added to the DB
 * this function will ensure the minimum information is met
 * and then add it to the db.
 *
 * option consist of: 
 *
 * panelName: string  >  the name of the panel. this must be unique and is required
 * panel: [<obj1>,<obj2>] the panel must be an array of objects, each with the  minimum requriements:
 		referenceName: chromosome identifier
 		start: positions
 		end: position

 		options: any additional fields you want to add. ie gene names, rs numbers etc
*/
db.prototype.createNewPanel = function(options){
	var self = this;
	var promise = new Promise(function(resolve,reject){
	 	var panel = options.panel; // array of panel obejcts
	 	var panelName = options.panelName;
	 	if(!panelName) 
	 		reject(new Error('No Name for Panel Provided'));
	 	if(! panel.constructor === Array)
	 		reject(new Error('Please Provide an Array of objects for the panel'));

	 	//check to ensure each panel has a referenceName, a start position
	 	//and a stop position.

	 	var panelOK = true;
	 	panel.map(function(item){
	 		console.log(item)
	 		if (item.referenceName === undefined || item.start === undefined || item.end === undefined){
	 			 //will not put an inappropriately formated panel into the db
	 			panelOK = false;
	 		};
	 	});

	 	if (panelOK){
	 		var passedOptions = {
	 			documents: {
	 				panel:options.panel,
	 				panelName:options.panelName
	 			},
	 			tableName: 'panels'
	 		};
			
			self.insert(passedOptions).then(function(docs){
	 			resolve(docs);
	 		}).catch(function(err){
	 			reject(err);
	 		});
	 	} else {
	 		reject(new Error("Incomplete data, cannot form new panel"));
	 	}
	});
	return promise;
}


//connect and initialize
	
/* initialize the database if it has not already been so.
 * this will add two mandatory tables, the patientTable as well
 * as the count table. this allows you to use an autoincrementing
 * value for the _id field of the patientId. additionally the only other
 * strict parametr set here is that a unique field for callSetId is being
 * enforced. This is to ensure that we do not have any duplicates of call
 * setIDs in the table

 * if the collections are previously initialized, then an error will be logged to the screen
 * but not flagged as an error.
 */

 var DB = new db();

DB.connect('mongodb://localhost:27017/patientDB')
.then(function(db){
	var panelTable = db.createTable('panels').then(function(db){ return db.ensureIndex({tableName:'panels',field:'panelName'})}); 
	var patientTable = db.createTable('patientTable').then(function(db){ return db.ensureIndex({tableName:'patientTable',field:'callSetId'})});
	var countTable = db.createTable('count').then(function(db){ return db.insert({tableName:'count',documents:{_id:'userid',seq:0}})});
	return	Promise.join(patientTable,countTable,panelTable)})
.catch(function(err){ console.log(err)})


module.exports = DB;
