/*
 * Frangipani config page Javascript.
 * @author Ron Ammar
 */

/* Wrap all code in an immediately-invoked function expressions to avoid 
 * global variables. */
var $ = require("jquery");
var foundation = require('./foundation');
var template = require('/templates').config
var aux = require('../lib/config.json');

module.export = function() {
//=======================================================================
// Auxiliary helper functions
//=======================================================================

	/* Update the Disclaimer using the current institution name. */
	updateDisclaimer = function() {
		aux.DISCLAIMER= aux.DISCLAIMER_PREFIX + aux.INSTITUTION + aux.DISCLAIMER_SUFFIX;
		$("#fragipani-disclaimer").val(aux.DISCLAIMER)
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
	}
	//=======================================================================
	// Set up a ready handler, a function to run when the DOM is ready
	//=======================================================================

	var handler= function() {
		/* 
		 * Set the config defaults:
		 */

		// Customize the disclaimer for the institute, using a default first
		updateDisclaimer();
		;
		$("#frangipani-institution").attr("placeholder", "e.g. " + aux.INSTITUTION);
		$("#frangipani-institution").on("change", function(event) {
			aux.INSTITUTION= $(this).val();
			updateDisclaimer();
		});

		// Set the maximum number of records.
		$("#frangipani-max-records-slider").foundation("slider", "set_value", aux.MAX_RECORDS);

		// Attached a listener to max records slider and associated input field
		var updateSlider= function(event) {
			$("#frangipani-max-records-slider").foundation("slider", "set_value", $(this).val());		
		};
		$("#frangipani-max-records-slider-output")
			.on("change", updateSlider)
			.on("keyup", updateSlider);

		// Set default footer
		$("#frangipani-footer").val(aux.FOOTER);


		/* Create switches for each annovar annotation. */
		/* Receive the submitted form data (Abide validation events are handled by
		 * foundation ). */
		$("#frangipani-config-form").on('invalid.fndtn.abide', function () {
			// Invalid form input
			var invalid_fields = $(this).find('[data-invalid]');
			console.log(invalid_fields);
		})
		$("#frangipani-config-form").on('valid.fndtn.abide', function () {
			// Tell user we are submitting
			$("#frangipani-config-form-button").text("Sending...");

			// Valid form input
			var formInput= serializeObject($(this));

			// Iterate over the annovar annotation fields and put them into a list
			var annovarAnnotationList= [];
			var annovarUsageList = [];
			var annovarIndexList = [];
			var prefixPattern= /^frangipani\-annovar\-annotation\-/;
			for (var key in formInput) {
				// Important check that property is not from inherited prototype prop
				if(formInput.hasOwnProperty(key) && prefixPattern.test(key)) {
					annovarAnnotationList.push(formInput[key]);
					annovarUsageList.push(aux.ANNOVAR_ANNOTATIONS[formInput[key]].usage);
					(aux.ANNOVAR_ANNOTATIONS[formInput[key]].index ? annovarIndexList.push(formInput[key].toLowerCase()):undefined);


					// remove from the form input object
					delete formInput[key];
				} else if (formInput.hasOwnProperty(key) && key == 'default-annotation'){
					annovarAnnotationList.unshift(formInput[key]);
					annovarUsageList.unshift('g');
					annovarIndexList.unshift('gene_' + formInput[key]);
					annovarIndexList.unshift('func_' + formInput[key]);
					delete formInput[key]
				}
			}
			formInput["annovar-dbs"]= annovarAnnotationList;
			formInput["annovar-usage"] = annovarUsageList;
			formInput["annovar-index"] = annovarIndexList;

			var promise= Promise.resolve($.ajax({
				url: "/config",
				type: "POST",
				contentType: "application/json",
				dataType: "json",
				data: JSON.stringify(formInput)
			}));
			promise.then(function(result) {
				window.location.replace("/");  //redirect to home page
			}).catch(function(err){
				console.log(err)
			});
		});

	};
	var render = function(){
		var options = {
			'annotations':Object.keys(aux.ANNOVAR_ANNOTATIONS)
		};
		$('#main').html(template(options))
		handler();
	};
	render();
});




