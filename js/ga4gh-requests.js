/*
 * Module that manages correspondence with a GA4GH-compliant server.
 * @author Ron Ammar
 */

var request= require("request");
var Promise= require("bluebird");
var apiKeys= require('./api');
var DB= require('./DB');

// Google Genomics URL and API key associated with Lab IP address
var rootUrl= "https://www.googleapis.com/genomics/v1beta2/";
var myAPIKey= apiKeys.ronAmmar;


/* Gets all projects from the specified GA4GH-compliant server. 
 * @return {Object} A promise describing state of request. */
exports.getProjects= function() {
	var options= {
		url: rootUrl + "datasets" + "?key=" + myAPIKey,
		method: "GET",
		json: true
	};

	var promise= new Promise(function(resolve, reject) {
		request(options, function(err, httpResponse, body) {
			if (err) {
				reject(err);
			}

			resolve(body);
		});
	});

	return promise;
}

/* Gets all patients from the specified GA4GH-compliant server. 
 * @return {Object} A promise describing state of request. */
exports.getPatients= function(projectOptions) {
	var options= {
		url: rootUrl + "callsets/search" + "?key=" + myAPIKey,
		method: "POST",
		json: true,
		body: projectOptions
	};

	var promise= new Promise(function(resolve, reject) {
		request(options, function(err, httpResponse, body) {
			if (err) {
				reject(err);
			}
			/* Make a call to the local database running to get patient info
			 * that can then be added to the body prior to passing it back to
			 * the browser */

			var callSetIds = [];
			for(var i=0;i < body.callSets.length;i++){
				callSetIds.push(body.callSets[i]['id'])
			}
			DB.find({tableName:'patientTable',query:{callSetId:{$in:callSetIds}}}).then(function(array){
				for ( var i =0; i < array.length; i++ ){
					var ind;
					ind = callSetIds.indexOf(array[i]['callSetId'])
					if (ind >= 0){
						body.callSets[ind]['sex'] = array[i]['sex'];
						body.callSets[ind]['age'] = array[i]['age'];
						body.callSets[ind]['details'] = array[i]['details'];
					}
				}
				resolve(body)
			}).catch(function(err){
				reject(err);
			});
		});
	});

	return promise;
}


exports.getVariants = function(projectOptions){
	var options = {
		url: rootUrl + "variants/search" + "?key=" + myAPIKey,
		method: "POST",
		json: true,
		body: projectOptions
	};

	var promise = new Promise(function(resolve,reject) {
		request(options, function(err,httpResonse, body){
			if(err){
				reject(err);
			}
			resolve(body);
		});
	});
	
	return promise;
}








