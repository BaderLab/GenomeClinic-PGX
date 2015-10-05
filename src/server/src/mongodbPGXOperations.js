var Promise = require("bluebird");
var assert= require("assert");
var dbConstants = require("../lib/conf/constants.json").dbConstants;
var nodeConstants = require('../lib/conf/constants.json').nodeConstants;
var getRS = require('../lib/getDbSnp');
var _ = require('underscore');
//var dbConstants = require("../conf/constants.json").dbConstants;
//var nodeConstants = require('../conf/constants.json').nodeConstants;



module.exports  = function(dbOperations){
/* Retrieve markers and coordinates from the server. Convert the data returned into an
	 * Object with the marker names as the key. If no parameters are passed, return all 
	 * markers from the databse. if the marker name is provided only return information
	 * for the specified marker. Two marker types are stored in the database, 'custom'
	 * and 'dbsnp'. If the type parameter is passed return only the type of marker
	 */ 
	dbOperations.prototype.getPGXCoords = function(rsID,username,type) {
		var query = {};
		var _this = this;
		if (Object.prototype.toString.call(rsID) == "[object Array]")
			query[dbConstants.PGX.COORDS.ID_FIELD] = {$in:rsID};
		else if (rsID)
			query[dbConstants.PGX.COORDS.ID_FIELD] = rsID;
		if (type)
			query.type = type;
		return this.find(dbConstants.PGX.COORDS.COLLECTION,query,undefined,null,username)
		.then(function(result){
			//Check to see if the marker has been merged at all
			if (result.length === 0){
				var query = {};
				if (Object.prototype.toString.call(rsID) == "[object Array]")
					query['merged.from'] = {$in:rsID}
				else if (rsID)
					query['merged.from'] = rsID;
				if (type)
					query.type = type
				return _this.find(dbConstants.PGX.COORDS.COLLECTION,query,undefined,null,username)
			} else {
				return result
			}
		}).then(function(result){
			var out = {}
			for (var i = 0; i < result.length; i++ ){
				out[result[i]._id] = {};
				if (result[i].merged){
					out[result[i].merged.from] = {};
				}
				for (var key in result[i]){
					if (result[i].hasOwnProperty(key)){
						if (result[i].merged)
							out[result[i].merged.from][key] = result[i][key]
						out[result[i]._id][key] = result[i][key];
					}
				}
				if (result[i].merged)out[result[i].merged.from]._id = result[i].merged.from;

			}
			return out;	
		});
	};

	/* Update all the pgxCoordinates
	 * Query the NCBI's dbsnp to find all minformation on all the markers included in
	 * our database (can take a minute). THen if there are any changes update the databse
	 */
	dbOperations.prototype.updatedbSnpPGXCoords = function(snp){
		var record, update, changed = [], notFound = [], notchanged = [], toChange = [];
		var _this = this;
		return this.getPGXCoords(snp ,null,'dbsnp').then(function(markers){
			var markerNames = Object.keys(markers);
			return getRS(markerNames).then(function(result){
				foundMarkers = [];

				//Check to see if any of the genes have changed.
				for (var i = 0; i < result.dbSnp.length; i++ ){
					//check version
					record = result.dbSnp[i];
					update = false;
					foundMarkers.push(record._id);
					if (markers[record._id].build < record.build) update = true;
					if (markers[record._id].assembly < record.assembly ) update = true;
					if (markers[record._id].ref != record.ref ) update = true;
					if (!_.isEqual(markers[record._id].alt,record.alt) ) update = true;
					if (update) toChange.push(record);	
					else notchanged.push(record._id);
				}

				for (i = 0; i < markers.length; i++ ){
					if (foundMarkers.indexOf(markers[i]) == -1 ) notFound.push(markers[i]);
				}
				return toChange;
			}).each(function(record){
				return _this.update(dbConstants.PGX.COORDS.COLLECTION,{_id:record._id},record).then(function(){
					changed.push(record);
				});
			}).then(function(){
				output = {
					changed:changed,
					missing:notFound,
					notchanged:notchanged
				};
				return output;
			});
		});
	};

	/* Each gene has an array of markers associated with it that links these markers
	 * with the respective gene haplotype page. When a marker is present in the array
	 * it will show up in the haplotype table for that gene. The function accepts a string
	 * or an array of markers.  
	 */
	dbOperations.prototype.addMarkerToGene = function(markers,gene,user){
		var _this = this;
		if (Object.prototype.toString.call(markers) == '[object String]')
			markers = [markers];
		//ensure that each marker exists
		return Promise.resolve(markers).each(function(marker){
			return _this.findOne(dbConstants.PGX.COORDS.COLLECTION, {_id:marker},user).then(function(result){
				if (!result) {
					throw new Error("Could not find " + marker + ". Please add the marker and continue.");
				} else {
					var query = {};
					var update = {$addToSet:{}}

					query[dbConstants.DRUGS.ALL.ID_FIELD] = gene;
					update.$addToSet[dbConstants.DRUGS.ALL.MARKERS] = marker;
					return _this.update(dbConstants.DRUGS.ALL.COLLECTION,query,update,undefined,user);
				}
			});
		});
	};

	/* Remove the associated markers from a gene by pulling the specified marking
	 * or array from the gene marker array */
	dbOperations.prototype.removeMarkerFromGene = function(markers,gene,user){
		var _this = this;
		if (Object.prototype.toString.call(markers) == '[object String]')
			markers = [markers];
		
		return Promise.resolve(markers).each(function(marker){
			return _this.findOne(dbConstants.PGX.COORDS.COLLECTION, {_id:marker},user).then(function(result){
				if (!result) {
					throw new Error("Could not find " + marker + ". Please add the marker and continue.");
				} else {
					var query = {};
					var update = {$pull:{}}
					query[dbConstants.DRUGS.ALL.ID_FIELD] = gene;
					update.$pull[dbConstants.DRUGS.ALL.MARKERS] = marker;
					return _this.update(dbConstants.DRUGS.ALL.COLLECTION,query,update,undefined,user).then(function(){
						//Remove the Marker from all the haplotypes associated with this gene
						var query = {gene:gene};
						var update = {$pull:{markers:{$in:markers}}};
						return _this.update(dbConstants.PGX.GENES.COLLECTION,query,update,{multi:true},user);
					});
				}
			});
		});
	};

	//remove the selected marker
	dbOperations.prototype.removePGXCoords = function(rsID,user){
		var _this = this;
		assert(Object.prototype.toString.call(rsID) == "[object String]");
		var query = {};
		query[dbConstants.PGX.COORDS.ID_FIELD] = rsID;
		var removed;
		return this.removeDocument(dbConstants.PGX.COORDS.COLLECTION,query,user).then(function(){
			//it has successfully removed the doc
			removed = true;
			var update = {$pull:{}};
			update.$pull[dbConstants.DRUGS.ALL.MARKERS] = rsID;
			var query = {};
			query[dbConstants.DRUGS.ALL.MARKERS] = rsID;
			return _this.update(dbConstants.DRUGS.ALL.COLLECTION,{},update,{multi:true});
		}).then(function(result){
			var query = {};
			query[dbConstants.PGX.GENES.MARKERS] = rsID;
			var update = {$pull:{}};
			update.$pull[dbConstants.PGX.GENES.MARKERS] = rsID;
			return _this.update(dbConstants.PGX.GENES.COLLECTION,query,update,{multi:true});
		}).then(function(){
			return removed
		})

	};
	/*retrieve the selected Haplotype Gene(s). Accepts an array or string, or no
	 * arugment. If an array or string is passed it will search for all of the genes
	 * in that are named, while if no arguments are passed it will retrieve ALL
	 * of the genes */
	dbOperations.prototype.getPGXGenesForAnalysis = function(geneName,user){
		var query = {};
		var _this = this;
		if (Object.prototype.toString.call(geneName) == '[object Array]')
			query[dbConstants.DRUGS.ALL.ID_FIELD] = {$in:geneName};
		else if (geneName)
			query[dbConstants.DRUGS.ALL.ID_FIELD] = geneName;
		return this.find(dbConstants.DRUGS.ALL.COLLECTION,query,undefined,undefined,user)
		.each(function(geneResult){
			var query = {_id:{$in:geneResult[dbConstants.DRUGS.ALL.CURRENT_HAPLO]}}
			return _this.find(dbConstants.PGX.GENES.COLLECTION,query,undefined,undefined,user).then(function(result){
				geneResult[dbConstants.DRUGS.ALL.CURRENT_HAPLO] = result;
			});
		}).then(function(result){
			var out = {};
			for (var i=0; i< result.length; i++ ){
				temp = {}
				if (result[i][dbConstants.DRUGS.ALL.CURRENT_HAPLO].length !== 0){
					for (var j = 0; j < result[i][dbConstants.DRUGS.ALL.CURRENT_HAPLO].length; j++ ){
						temp[result[i][dbConstants.DRUGS.ALL.CURRENT_HAPLO][j].haplotype] = result[i][dbConstants.DRUGS.ALL.CURRENT_HAPLO][j].markers
						}
					out[result[i].gene] = temp;
				}
			}
			return out;
		});
	};

	//Update the specified gene with the requqired parameter Doc
	dbOperations.prototype.updatePGXGene = function(id,doc,user){
		assert(Object.prototype.toString.call(geneName) == "[object String]");
		assert(Object.prototype.toString.call(doc) == "[object Object]");

		var query = {};
		query[dbConstants.PGX.GENES.ID_FIELD] = geneName;
		return this.update(dbConstants.PGX.GENES.COLLECTION,query,doc,undefined,user);
	};

	//Update the specified marker with the required parameter Doc
	dbOperations.prototype.updatePGXCoord = function(rsID,doc,user){
		assert(Object.prototype.toString.call(rsID) == "[object String]");
		assert(Object.prototype.toString.call(doc) == "[object Object]");
		var query = {};
		query[dbConstants.PGX.COORDS.ID_FIELD] = rsID;
		return this.update(dbConstants.PGX.COORDS.COLLECTION,query,doc,undefined,user);
	};

	/* Find all PGx variants for a specific patient ID.
	 * NOTE: patient ID is the user-specified ID, not the internal collection ID.
	 * Returns a promise. */
	dbOperations.prototype.getPGXVariants= function(patientID,user) {
		var _this = this;
		var pgxCoords, pgxGenes,currentPatientCollectionID,pgxGenesRemoved = [];
		var query= {};
		query[dbConstants.PATIENTS.ID_FIELD]= patientID;

		var promise= this.findOne(dbConstants.PATIENTS.COLLECTION, query, user)
		.then(function(result){
			currentPatientCollectionID = result[dbConstants.PATIENTS.COLLECTION_ID];
			return _this.getPGXGenesForAnalysis();
		}).then(function(result){
			pgxGenes = result;
			return _this.getPGXCoords();
		}).then(function(result){
			//Ensure that only genes are being provided that have complete marker information
			//if genes are lacking marker information remove them and put them in a separate array
			var haplotypes;
			pgxCoords = result;
			var genes = Object.keys(pgxGenes);
			var markers = Object.keys(pgxCoords);
			for (var i=0; i<genes.length; i++ ){
				hap = Object.keys(pgxGenes[genes[i]]);
				for (var j=0; j < hap.length; j++){
					for ( var k = 0; k < pgxGenes[genes[i]][hap[j]].length; k++ ){
						if (markers.indexOf(pgxGenes[genes[i]][hap[j]][k]) === -1 ){
							if (pgxGenesRemoved.indexOf(genes[i])=== -1 ){
								pgxGenesRemoved.push(genes[i]);
							}
						}
					}
				}
				
			}
			for (i = 0; i< pgxGenesRemoved.length; i++){
				delete pgxGenes[pgxGenesRemoved[i]];
			}

			return pgxCoords;
		}).then(function(result){
			
			var tempCoords;
			var keys = Object.keys(result);
			query = {};
			query[dbConstants.VARIANTS.IDENTIFIER] = {$in:keys};
			return _this.find(currentPatientCollectionID, query, {"_id": 0},undefined,user); // don't send internal _id field
		})
		.then(function(result) {
			var doc= {};
			doc.variants= {};
			for (var i = 0; i < result.length; i++ ) {
				doc.variants[result[i][dbConstants.VARIANTS.IDENTIFIER]] = result[i];
			}
			doc.pgxGenes = pgxGenes;
			doc.pgxCoordinates = pgxCoords;
			doc.patientID = patientID;
			doc.pgxGenesRemoved = pgxGenesRemoved;

			var opts = {"_id":0};
			opts[dbConstants.DB.REPORT_FOOTER] = 1;
			opts[dbConstants.DB.REPORT_DISCLAIMER] = 1;

			return _this.find(dbConstants.DB.ADMIN_COLLECTION, {}, opts,undefined,user)
			.then(function(result) {
				doc[dbConstants.DB.REPORT_FOOTER]= result[0][dbConstants.DB.REPORT_FOOTER];
				doc[dbConstants.DB.REPORT_DISCLAIMER]= result[0][dbConstants.DB.REPORT_DISCLAIMER];
				return doc;
			});
		});
		return promise;
	};
};
