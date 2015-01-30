/*
 * Frangipani pharmacogenomics app JavaScript.
 * @author Ron Ammar
 */

/* Wrap all code in an immediately-invoked function expressions to avoid 
 * global variables. */
(function() {

var appMain= $("#frangipani-patients-main");

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

/* Add the event listeners */
var addEventListeners= function() {
	// Listen for row clicks and then select the patient ID child.
	$("tr.patient-row").on("click", function() {
		var selectedPatientID= $(this).children("[class~='frangipani-patient-id']").text();
		var promise= Promise.resolve($.ajax({
				url: "/pgx",
				type: "POST",
				contentType: "application/json",
				dataType: "json",
				data: JSON.stringify({
					"patient_id": selectedPatientID
				})
		}));
		promise.then(function(result) {
			console.dir(result); ///////////////// CONTINUE HERE
		});
	});
};

// Create a promise function to wrap our browse button tasks
var loadPatients= function() {
	getPatients()
	.then(function(result) {
		appMain.children().remove();  // clear the current page
		var context= result;
		return aux.asyncRenderHbs('frangipani-patients.hbs', context);
	})
	.then(function(html) {
		appMain.append(html);
		addEventListeners();
	});
}


/* 
 * Set up a ready handler, a function to run when the DOM is ready
 */
var handler= function() {
	loadPatients();
};


/* 
 * Wait for the DOM to load before any processing.
 */
$(document).ready(handler);

})();





