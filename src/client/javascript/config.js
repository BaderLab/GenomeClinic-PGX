/*
 * Config page  for initial server startup.
 * @author Ron Ammar
 */
var aux = require('../conf/config.json'),
	utility = require('./utility'),
	constants = require('../../server/conf/constants.json').dbConstants.ANNO;


(function(){
//=======================================================================
// Auxiliary helper functions
//=======================================================================

	/* Update the Disclaimer using the current institution name. */
	updateDisclaimer = function() {
		aux.DISCLAIMER= aux.DISCLAIMER_PREFIX + aux.INSTITUTION + aux.DISCLAIMER_SUFFIX;
		$("#webapp-disclaimer").val(aux.DISCLAIMER);
	};
	/* Convert form into JSON.
	 * Function adapted from http://stackoverflow.com/questions/1184624/convert-form-data-to-js-object-with-jquery */
	serializeObject = function(form) {
	    var o = {};
	    var a = form.serializeArray();
	    $.each(a, function() {
	        if (o[this.name] !== undefined) {
	            if (!o[this.name].push) {
	                o[this.name] = [o[this.name]];
	            }
	            o[this.name].push(this.value || '');
	        } else {
	            o[this.name] = this.value || '';
	        }
	    });
	    return o;
	};

	//Make a call to the server and check to see if there is currently any information saved
	var populateFields = function() {
		Promise.resolve($.ajax({
			url:'/config/current',
			type:'GET',
			dataType:'json'
		})).then(function(result){
			console.log(result);
			$("#webapp-email").val(result['admin-email'] || "");
			$("#webapp-institution").val(result.institution || "");
			$("#webapp-footer").val( result['report-footer'] || aux.FOOTER );
			$("#webapp-disclaimer").val( result.disclaimer || aux.DISCLAIMER_PREFIX + aux.INSTITUTION + aux.DISCLAIMER_SUFFIX);
		})
	}
	//=======================================================================
	// Set up a ready handler, a function to run when the DOM is ready
	//=======================================================================

	var handler= function() {
		/* 
		 * Set the config defaults:
		 */

		// Customize the disclaimer for the institute, using a default first
		//updateDisclaimer();
		populateFields();
		$("#webapp-institution").attr("placeholder", "e.g. " + aux.INSTITUTION);
	
		
		/* Create switches for each annovar annotation. */
		/* Receive the submitted form data (Abide validation events are handled by
		 * foundation ). */
		$("#webapp-config-form").on('invalid.fndtn.abide', function () {
			// Invalid form input
			var invalid_fields = $(this).find('[data-invalid]');
		});
		$("#webapp-config-form").on('valid.fndtn.abide', function () {
			// Tell user we are submitting
			$("#webapp-config-form-button").text("Sending...");

			// Valid form input
			var formInput= serializeObject($(this));
			var promise= Promise.resolve($.ajax({
				url: "/config",
				type: "POST",
				contentType: "application/json",
				dataType: "json",
				data: JSON.stringify(formInput)
			}));
			return promise.then(function(result) {
				window.location.replace("/");  //redirect to home page
			}).catch(function(err){
				console.log('there has been an error');
				console.log(err);
			});
		});

	};
	var render = function(){
		return templates.config().then(function(renderedHtml){
			$('#main').html(renderedHtml);
		}).then(function(){
			utility.refresh();
		}).then(function(){
			handler();
		});
	};

	$(document).ready(function(){
		return render();
	});
})();





