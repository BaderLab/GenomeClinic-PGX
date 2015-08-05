/*
 * Patient handlers
 * @author Ron Ammar
 */

var utility = require('./utility'),
	pgx = require('./pgx'),
	dosing = require('./dosing-recommendations');

(function() {
	/* AJAX call to application server to retrieve patients.
	 * This is based on the local MongoDB collections, not GA4GH. */
		/* match funcion for the searchbar */
	var matchSearch = function(input){
		var val = $('#search-box').val();
		var re = new RegExp(val,'g','i');
		if ( val === '' )
			return true;
		else if (input.match(re) !== null)
			return true;
		return false;
	}; 

	var getPatients= function() {
		//Promise Function
		var promise= Promise.resolve($.ajax({
			url: "database/patients/completed",
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
		$('#search-box').on('keyup',function(){
			var items = $('.patient-row');
			for (var i=0; i < items.length; i++ ){
				if (!matchSearch($(items[i]).find('.webapp-patient-id').text()) && !matchSearch($(items[i]).find('.webapp-patient-alias').text())){
					$(items[i]).hide();
				} else {
					$(items[i]).show();
				}
			}
		});

		$("tr.patient-row").on("click", function() {
			window.location.replace('/browsepatients/id/' + $(this).children("[class~='webapp-patient-id']").text())
		});
	};
	/* Create a promise function to wrap our browse button tasks. */
	/* 
	 * Set up a ready handler, a function to run when the DOM is ready
	 */
	var main = function(){
		var location = window.location.pathname;
		if (location === '/browsepatients'){
			return getPatients()
			.then(function(result){  // clear the current page
				var context= result;
				context.useFull = true;
				context.pgx = true;
				return templates.patient(context);
			}).then(function(renderedHtml) {
				$('#main').append(renderedHtml);
			}).then(function(){
				addEventListeners();
			});
		} else if (location.match(/^\/browsepatients\/id\/.*\/report/) !== null){
			dosing.render();

		} else if (location.match(/^\/browsepatients\/id\/.*$/) !== null){
			pgx.loadPGx();
			
		}
	};
	$(document).ready(function(){
		return main();
	})
})()




