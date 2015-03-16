/*
 * Patient handlers
 * @author Ron Ammar
 */

/* Wrap all code in an immediately-invoked function expressions to avoid 
 * global variables. */
var $ = require('jquery'),
	templates = require('./templates'),
	utility = require('./utility'),
	pgx = require('./pgx');

module.exports = function() {
	/* AJAX call to application server to retrieve patients.
	 * This is based on the local MongoDB collections, not GA4GH. */
	var getPatients= function() {
		//Promise Function
		var promise= Promise.resolve($.ajax({
			url: "/patients",
			type: "GET",
			contentType: "application/json",
		}))
		.then(function(result) {
			var context= {
				"patients": result
			};
			return context;
		});
		return promise;
	};
	//add row event listener for loading pgx data
	var addEventListeners = function(){
		$("tr.patient-row").on("click", function() {
			var selectedPatientID= $(this).children("[class~='webapp-patient-id']").text();
			var selectedPatientAlias= $(this).children("[class~='webapp-patient-alias']").text();
			console.log(pgx);
			pgx.loadPGx(selectedPatientID,selectedPatientID);
		});
	};
	/* Create a promise function to wrap our browse button tasks. */
	var loadPatients= function() {
		return getPatients()
		.then(function(result){  // clear the current page
			var context= result;
			context.useFull = true;
			return templates.patient(context);
		}).then(function(renderedHtml) {
			$('#main').append(renderedHtml);
		}).then(function(){
			addEventListeners();
		});
	};

	/* 
	 * Set up a ready handler, a function to run when the DOM is ready
	 */

	return loadPatients();
};




