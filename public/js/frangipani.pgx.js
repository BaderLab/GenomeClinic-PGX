/*
 * Frangipani pharmacogenomics app JavaScript.
 * @author Ron Ammar
 */

/* Wrap all code in an immediately-invoked function expressions to avoid 
 * global variables. */
(function() {

/* 
 * Auxiliary helper functions and constants.
 */
var aux= {

	/* Cache of handlebars templates. */
	template_cache: undefined,

	/* Function to retrieve and render a handlebars template. This function is
	 * an async version of that provided by user koorchik on StackOverFlow:
	 * http://stackoverflow.com/questions/8366733/external-template-in-underscore
	 * as explained on the following blog entry:
	 * http://javascriptissexy.com/handlebars-js-tutorial-learn-everything-about-handlebars-js-javascript-templating/
	 *
	 * NOTE: In the future, I would compile all my templates into a single
	 * templates.js file and load that in the beginning rather than have many
	 * small asynchronous AJAX calls to get templates when the webpage loads.
	 *
	 * Returns a promise. */
	asyncRenderHbs: function(template_name, template_data) {
		if (!aux.template_cache) { 
		    aux.template_cache= {};
		}

		var promise= undefined;

		if (!aux.template_cache[template_name]) {
			promise= new Promise(function(resolve, reject) {
				var template_url= '/templates/' + template_name;
				$.ajax({
					url: template_url,
					method: 'GET',
					success: function(data) {
						aux.template_cache[template_name]= Handlebars.compile(data);
						resolve(aux.template_cache[template_name](template_data));
					},
					error: function(err, message) {
						reject(err);
					}			
				});
			});
		} else {
			promise= Promise.resolve(aux.template_cache[template_name](template_data));
		}
		
		return promise;
	},

	/* Convert form into JSON.
	 * Function adapted from http://stackoverflow.com/questions/1184624/convert-form-data-to-js-object-with-jquery */
	serializeObject: function(form) {
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

};


/* 
 * Set up a ready handler, a function to run when the DOM is ready
 */
var handler= function() {




	/* // How to use async templates:

	aux.asyncRenderHbs("frangipani-config-annovar-annotation.hbs", context)
		.then(function(html) {
			// append to DOM
			$("#frangipani-annovar-options").append(html);
		});

	*/


	/* Receive the submitted form data (Abide validation events are handled by
	 * foundation ). */
	/*
	$("#frangipani-config-form").on('invalid.fndtn.abide', function () {
		// Invalid form input
		var invalid_fields = $(this).find('[data-invalid]');
		console.log(invalid_fields);
	})
	$("#frangipani-config-form").on('valid.fndtn.abide', function () {
		// Tell user we are submitting
		$("#frangipani-config-form-button").text("Sending...");

		// Valid form input
		var formInput= aux.serializeObject($(this));

		// Iterate over the annovar annotation fields and put them into a list
		var annovarAnnotationList= [];
		var annovarUsageList = [];
		var prefixPattern= /^frangipani\-annovar\-annotation\-/;
		for (var key in formInput) {
			// Important check that property is not from inherited prototype prop
			if(formInput.hasOwnProperty(key) && prefixPattern.test(key)) {
				annovarAnnotationList.push(formInput[key]);
				annovarUsageList.push(aux.ANNOVAR_ANNOTATIONS[formInput[key]]);

				// remove from the form input object
				delete formInput[key];
			} else if (formInput.hasOwnProperty(key) && key == 'default-annotation'){
				annovarAnnotationList.unshift(formInput[key]);
				annovarUsageList.unshift('g');
				delete formInput[key]
			}
		}
		formInput["annovar-dbs"]= annovarAnnotationList;
		formInput["annovar-usage"] = annovarUsageList;

		var promise= Promise.resolve($.ajax({
			url: "/config",
			type: "POST",
			contentType: "application/json",
			dataType: "json",
			data: JSON.stringify(formInput)
		}));
		promise.then(function(result) {
			window.location.replace("/");  //redirect to home page
		});
	});
	*/

};


/* 
 * Wait for the DOM to load before any processing.
 */
$(document).ready(handler);

})();





