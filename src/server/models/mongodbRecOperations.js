var Promise = require("bluebird");
var dbConstants = require("../lib/conf/constants.json").dbConstants;
var nodeConstants = require('../lib/conf/constants.json').nodeConstants;
var utils = require('../lib/utils');


var MissingParameterError = require("../lib/errors/MissingParameterError");
var InvalidParameterError = require("../lib/errors/InvalidParameterError");

module.exports = function(dbOperations){


	//Get the genes associated with drug recomednations and return an array of genes;
	utils.checkAndExtend(dbOperations, "getGenes", function(user,from){
		var match = {$match:{}}
		match.$match['use' + from] = true;
		var options = {$project:{}};
		options.$project[dbConstants.DRUGS.ALL.ID_FIELD] = 1;
		options.$project.type = '$type';
		options.$project.numRecs = {$size:'$' + dbConstants.DRUGS.ALL.RECOMMENDATIONS};
		options.$project.numFuture = {$size:'$' + dbConstants.DRUGS.ALL.FUTURE};
		options.$project.numHaplo = {$size:'$' + dbConstants.DRUGS.ALL.HAPLO};
		options.$project.numCurrH = {$size:'$' + dbConstants.DRUGS.ALL.CURRENT_HAPLO};
		options.$project.numCurrM = {$size:'$' + dbConstants.DRUGS.ALL.MARKERS}
		var sort = {$sort:{}};
		sort.$sort[dbConstants.DRUGS.ALL.ID_FIELD] = 1;
		var pipeline = [match,options,sort];
		return this.aggregate(dbConstants.DRUGS.ALL.COLLECTION,pipeline,user);
	});

	/* for the given genes, return all the dosing information current in the database. this information
	 * is returned in the form of an array. The function can accept either a stirng or an array */
	utils.checkAndExtend(dbOperations, "getGeneDosing", function(gene,user){
		var query = {};
		var out = [];
		var _this = this;
		var promise = Promise.resolve().then(function(){
			if (! gene)
				throw new MissingParameterError("A gene name or gene array is required");

			if (Object.prototype.toString.call(gene) == '[object Array]'){
				query[dbConstants.DRUGS.ALL.ID_FIELD] = {$in:gene};
			} else {
				query[dbConstants.DRUGS.ALL.ID_FIELD] = gene;
			}
			return 	_this.find(dbConstants.DRUGS.ALL.COLLECTION,query,undefined,undefined,user).each(function(record){
				var recIDs = record[dbConstants.DRUGS.ALL.RECOMMENDATIONS] || [];
				var haploIDs = record[dbConstants.DRUGS.ALL.HAPLO] || [];
				var futureIDs = record[dbConstants.DRUGS.ALL.FUTURE] || [];
				
				//Find all recommendations
				return _this.find(dbConstants.DRUGS.DOSING.COLLECTION,{_id:{$in:recIDs}},undefined,undefined,user).then(function(recommendations){
					if (recommendations.length > 0) record[dbConstants.DRUGS.ALL.RECOMMENDATIONS] = recommendations;
					
				}).then(function(){
					return _this.find(dbConstants.DRUGS.FUTURE.COLLECTION,{_id:{$in:futureIDs}},undefined,undefined,user);
				}).then(function(future){
					if (future.length > 0 ) record[dbConstants.DRUGS.ALL.FUTURE] = future;
					
				}).then(function(){
					return _this.find(dbConstants.DRUGS.HAPLO.COLLECTION,{_id:{$in:haploIDs}},undefined,undefined,user);
				}).then(function(haplo){
					if (haplo.length > 0 ) record[dbConstants.DRUGS.ALL.HAPLO] = haplo;
					out.push(record);
					//if (record[dbConstants.DRUGS.ALL.RECOMENDATIONS] || record[dbConstants.DRUGS.ALL.FUTURE] || record[dbConstants.DRUGS.ALL.HAPLO]) out.push(record);
				});
			}).then(function(){
				if (out.length === 0) return null;
				else if (out.length === 1 ) return out[0];
				else return out;
			});
		});
		return promise;
	});

	/* Remove a specific entry. This function will remove an entry based on the objectID and the type of entry. It will
	 * accept four different 'Types':
	 * all - removes All the recommendations and associations linked to a specific gene. it also removes the dosing document itself
	 *		 and removes the recommendations from other genes that are depending upon the current gene being removed.
	 * recommendation - removes a specific recommmendation. IT is first removed from all the genes that link to it, then the document
	 * 	 	 is entirely removed from the drugRecommendation collection
	 * future - removes a specific future recommendation first from the future array within a gene, then subsequently removes the entry
	 *		  from its collections entirely.
	 * haplotype -removes the haplotype association from a gene and removes the document entry from the haplotype collection.
	 */
	utils.checkAndExtend(dbOperations, "removeEntry", function(oID,type,from,user){
		var collection, query, ids;
		var toRemove = [];
		var genes = [];
		var _this = this;

		var promise = Promise.resolve().then(function(){
			var promise;
			if (!type || ! from || !oID )
				throw new MissingParameterError("Required parameters are missing");
			/* Remove the entire document and all entries relating to it. This will remove all
			 * shared entries as well. So this is a very dangerous action */
			if (type == 'all'){
				var recIDs,futureIDs,haploIDs;
				var query = {};
				if (from == 'Haplotype') query[dbConstants.DRUGS.ALL.ID_FIELD] = oID;
				else if (from == 'Dosing') query._id = oID
				else throw new Error("Source must be from Haplotype or Dosing");

				promise = _this.findOne(dbConstants.DRUGS.ALL.COLLECTION,query,user).then(function(result){
					if (from == 'Dosing'){
						genes = [result[dbConstants.DRUGS.ALL.ID_FIELD]];
						toRemove.push({
							ids : result[dbConstants.DRUGS.ALL.RECOMMENDATIONS],
							collection : dbConstants.DRUGS.DOSING.COLLECTION,
							field:dbConstants.DRUGS.ALL.RECOMMENDATIONS
						});
						toRemove.push({
							ids : result[dbConstants.DRUGS.ALL.FUTURE],
							collection : dbConstants.DRUGS.FUTURE.COLLECTION,
							field:dbConstants.DRUGS.ALL.FUTURE
						})
						toRemove.push({
							ids : result[dbConstants.DRUGS.ALL.HAPLO],
							collection : dbConstants.DRUGS.FUTURE.COLLECTION,
							field:dbConstants.DRUGS.ALL.HAPLO
						})
					} else {
						genes = [oID];
						toRemove.push({
							ids: result[dbConstants.DRUGS.ALL.CURRENT_HAPLO],
							collection : dbConstants.PGX.GENES.COLLECTION,
							field:dbConstants.DRUGS.ALL.CURRENT_HAPLO
						})
						toRemove.push({
							genes:[oID],
							ids:result[dbConstants.DRUGS.ALL.MARKERS],
							field: dbConstants.DRUGS.ALL.MARKERS
						});

					}

					return toRemove;
				});
			} else {
				promise = Promise.resolve().then(function(){
					if (type == 'future' && from == 'Dosing'){
						toRemove.push({
							ids : [oID],
							collection : dbConstants.DRUGS.FUTURE.COLLECTION,
							field:dbConstants.DRUGS.ALL.FUTURE
						});
					}
					else if (type == 'recommendation' && from == 'Dosing'){
						toRemove.push({
							ids : [oID],
							collection : dbConstants.DRUGS.DOSING.COLLECTION,
							field:dbConstants.DRUGS.ALL.RECOMMENDATIONS
						});

					}
					else if (type == 'haplotye' && from == 'Dosing'){
						toRemove.push({
							ids : [oID],
							collection : dbConstants.DRUGS.FUTURE.COLLECTION,
							field:dbConstants.DRUGS.ALL.HAPLO
						});
					} 
					else if (type == 'haplotype' && from == 'Haplotype') {
						toRemove.push({
							ids:[oID],
							collection:dbConstants.PGX.GENES.COLLECTION,
							field:dbConstants.DRUGS.ALL.CURRENT_HAPLO
						});
					}

					return toRemove;
				});
			}
				//Remove each item
			return promise.each(function(item){
				var newPromise;
				var update = {};
				if (item.collection && item.ids.length > 0){
					newPromise = _this.find(item.collection,{_id:{$in:item.ids}}).each(function(result){
						var temp;
						if (result.genes && Object.prototype.toString.call(result.genes) == '[object Array]') temp = result.genes;
						else if (result.gene && Object.prototype.toString.call(result.gene) == '[object String]') temp = [result.gene];
						for (var i = 0 ; i < temp.length; i++ ){
							if (genes.indexOf(temp[i]) == -1) genes.push(temp[i]);
						}
						return _this.removeDocument(item.collection,{_id:result._id},user)
					});

				} else {
					//If there is not collection, or associated IDs then do nothing
					newPromise = Promise.resolve()
				}
				return newPromise.then(function(){
					update.$pull = {};
					if (item.genes) genes = item.genes;
					update.$pull[item.field] = {$in:item.ids};
					query = {};
					query[dbConstants.DRUGS.ALL.ID_FIELD] = {$in:genes}
					return _this.update(dbConstants.DRUGS.ALL.COLLECTION,query,update,{mulit:true},user)
				});

			}).then(function(){
				/* For each gene there are two internal flags that determine whether it is being displayed to the user for
				 * editing purposes. Once you have removed an item, this block will check to see if the several fields are of lenght 0,
				 * if they are, then the internal flags will be set to false and they user will no longer see dosing or haplotypes. This
				 * additionally changes the behaviour of this */
				var query = {};
				var update = {$set:{}};
				query[dbConstants.DRUGS.ALL.ID_FIELD] = {$in:genes}
				return _this.find(dbConstants.DRUGS.ALL.COLLECTION,query).each(function(entry){
					var newQeury = {};
					newQeury[dbConstants.DRUGS.ALL.ID_FIELD] = entry[dbConstants.DRUGS.ALL.ID_FIELD]
					if (from == 'Haplotype'){
						if (entry[dbConstants.DRUGS.ALL.MARKERS].length === 0 && entry[dbConstants.DRUGS.ALL.CURRENT_HAPLO].length === 0) update.$set.useHaplotype = false;
					} else if (from == 'Dosing'){
						if (entry[dbConstants.DRUGS.ALL.FUTURE].length === 0 && entry[dbConstants.DRUGS.ALL.RECOMMENDATIONS].length === 0 && entry[dbConstants.DRUGS.ALL.HAPLO].length === 0) update.$set.useDosing = false;
					}	
					//this gene is empty, remove
					if (update.$set.useDosing === false || update.$set.useHaplotype === false){
						return _this.update(dbConstants.DRUGS.ALL.COLLECTION,newQeury,update,undefined,user)
					} else {
						return true;
					}

				});
			});
		});
		return promise;
	});
	/* Create an empty dosing document based on the gene name. If the Gene already exists
	 * reject the process and return an error */
	utils.checkAndExtend(dbOperations, "createNewDoc", function(gene,type,from,user){
		var _this = this;
		var promise = new Promise(function(resolve,reject){
			if (from && from !== "Haplotype" && from != "Dosing")
				reject(new InvalidParameterError("From must be either Haplotype or Dosing"));

			var newDoc = {};
			newDoc[dbConstants.DRUGS.ALL.TYPE] = type || 'metabolizer'; // metabolizer is the default type
			newDoc[dbConstants.DRUGS.ALL.ID_FIELD] = gene;
			newDoc[dbConstants.DRUGS.ALL.RECOMMENDATIONS] = [];
			newDoc[dbConstants.DRUGS.ALL.HAPLO] = [];
			newDoc[dbConstants.DRUGS.ALL.FUTURE] = [];
			newDoc[dbConstants.DRUGS.ALL.CURRENT_HAPLO] = [];
			newDoc[dbConstants.DRUGS.ALL.MARKERS] = [];
			if (from) newDoc['use' + from] = true;
			return _this.insert(dbConstants.DRUGS.ALL.COLLECTION,newDoc,user)
			.then(function(result){
				resolve(result);
			}).catch(function(err){
				reject(err);
			})
		});
		return promise;
	});

	/**
	 * Save the report data to enable recovery at a later time. The username, 
	 * the patient_id and the date are added to the data to uniquely identify it at
	 * a later time 
	 */
	utils.checkAndExtend(dbOperations, "saveReportData", function(data,patient,user){
		var _this = this;
		var promise = Promise.resolve().then(function(){
			if (!data || !user || !patient)
				throw new MissingParameterError("Required fields are missing");
			if (!utils.isObject(data))
				throw new InvalidParameterError("data must be an object")
			if (!utils.isString(user))
				throw new InvalidParameterError("User must be a string");
			if (!utils.isString(patient));
			//here is the data
			var docToInsert = {
				username : user,
				patient_id : patient,
				date : new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''),
				data : data 
			};

			return _this.insert("archivedReports", docToInsert,user);
		});
		return promise;
	});
	
};