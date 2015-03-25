/*
 * Config page  for initial server startup.
 * @author Ron Ammar
 */
var $ = require("jquery"),
	template = require('./templates').config,
	aux = require('../conf/config.json'),
	utility = require('./utility'),
	constants = require('../../server/conf/constants.json').dbConstants.ANNO;



module.exports = function() {
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
	//=======================================================================
	// Set up a ready handler, a function to run when the DOM is ready
	//=======================================================================

	var handler= function() {
		/* 
		 * Set the config defaults:
		 */

		// Customize the disclaimer for the institute, using a default first
		updateDisclaimer();
		$("#webapp-institution").attr("placeholder", "e.g. " + aux.INSTITUTION);
		$("#webapp-institution").on("change", function(event) {
			aux.INSTITUTION= $(this).val();
			updateDisclaimer();
		});

		// Set the maximum number of records.
		

		// Attached a listener to max records slider and associated input field
		var updateSlider= function(event) {
			$("#webapp-max-records-slider").foundation("slider", "set_value", $(this).val());		
		};
		$("#webapp-max-records-slider-output")
			.on("change", updateSlider);
			//.on("keyup", updateSlider);
		$("#webapp-max-records-slider").foundation("slider", "set_value", aux.MAX_RECORDS);
		// Set default footer
		$("#webapp-footer").val(aux.FOOTER);


		/* Create switches for each annovar annotation. */
		/* Receive the submitted form data (Abide validation events are handled by
		 * foundation ). */
		$("#webapp-config-form").on('invalid.fndtn.abide', function () {
			// Invalid form input
			var invalid_fields = $(this).find('[data-invalid]');
			console.log(invalid_fields);
		});
		$("#webapp-config-form").on('valid.fndtn.abide', function () {
			// Tell user we are submitting
			$("#webapp-config-form-button").text("Sending...");

			// Valid form input
			var formInput= serializeObject($(this));

			// Iterate over the annovar annotation fields and put them into a list
			var annovarAnnotationList= [];
			var annovarUsageList = [];
			var annovarIndexList = [];
			var prefixPattern= /^webapp\-annovar\-annotation\-/;
			for (var key in formInput) {
				// Important check that property is not from inherited prototype prop
				if(formInput.hasOwnProperty(key) && prefixPattern.test(key)) {
					annovarAnnotationList.push(formInput[key]);
					annovarUsageList.push(aux.ANNOVAR_ANNOTATIONS[formInput[key]].usage);
					if (aux.ANNOVAR_ANNOTATIONS[formInput[key]].index )
						annovarIndexList.push(formInput[key].toLowerCase());
					// remove from the form input object
					delete formInput[key];
				} else if (formInput.hasOwnProperty(key) && key == 'default-annotation'){
					annovarAnnotationList.unshift(formInput[key]);
					annovarUsageList.unshift('g');
					annovarIndexList.unshift('gene_' + formInput[key]);
					annovarIndexList.unshift('func_' + formInput[key]);
					delete formInput[key];
				}
			}
			formInput[constants.DBS]= annovarAnnotationList;
			formInput[constants.USAGE] = annovarUsageList;
			formInput[constants.INDEX_FIELDS] = annovarIndexList;

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
		var options = {
			'annotations':Object.keys(aux.ANNOVAR_ANNOTATIONS)
		};
		return template(options).then(function(renderedHtml){
			$('#main').html(renderedHtml);
		}).then(function(){
			utility.refresh();
		}).then(function(){
			handler();
		});
	};
	return render();
};





