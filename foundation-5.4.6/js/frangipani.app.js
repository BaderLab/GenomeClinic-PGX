/*
 * Frangipani app Javascript.
 * @author Ron Ammar
 */

/* 
 * Auxiliary helper functions:
 */

/* Function to retrieve and render a handlebars template. This function is
 * modified from the function provided by user koorchik on StackOverFlow:
 * http://stackoverflow.com/questions/8366733/external-template-in-underscore
 * as explained on the following blog entry:
 * http://javascriptissexy.com/handlebars-js-tutorial-learn-everything-about-handlebars-js-javascript-templating/
 *
 * NOTE: In the future, I would compile all my templates into a single
 * templates.js file and load that in the beginning rather than have many
 * small synchronous AJAX calls to get templates when the webpage loads.
 */
var renderHbs= function(template_name, template_data) {
	if (!renderHbs.template_cache) { 
	    renderHbs.template_cache= {};
	}

	if (!renderHbs.template_cache[template_name]) {
		var template_url= '/templates/' + template_name;
		$.ajax({
			url: template_url,
			method: 'GET',
			async: false,  // I'm keeping this async for now (from original code) - but I really don't like it
			success: function(data) {
				renderHbs.template_cache[template_name]= Handlebars.compile(data);
			}
		});
	}

	return renderHbs.template_cache[template_name](template_data);
};

/* When a button is clicked, calls a function. While the function is 
 * executing, button displays some intermediate text. Upon completion, button
 * reverts to original text. */
var clickAction= function(button, promiseFunction, options, useThis) {
	var originalText;

	var resetButton= function(val) {
		button.text(originalText);
	};

	button.on("click", function(event) {
		event.preventDefault();

		if (useThis === true) {
			button= $(this);
			options["thisButton"]= $(this);
		}

		originalText= button.text();
		button.text("Fetching...");

		if (options === undefined) {
			promiseFunction().then(resetButton);
		} else {
			promiseFunction(options).then(resetButton);
		}
	});
};

/* AJAX call to application server to retrieve projects. */
var getProjects= function() {
	var promise= Promise.resolve($.ajax({
		url: "/datasets",  // Need the "http://" here or will get CORS error
		type: "GET",
		contentType: "application/json",
	}));

	return promise.then( function(result) {
		updateProjectTable(result);
	});
};

/* Get patients from this project. Project details are passed in via
 * options object keyed by "thisButton".
 * @return {Object} A promise describing state of request. */
var getProjectPatients= function(options) {
	// Scroll to the top of the page using animation
	$("body").animate({scrollTop: 0, scrollLeft: 0}, "slow");

	// Clear patient table
	patientTable.children().remove();

	patientButton= options["thisButton"];
	patientId= patientButton.data("id");
	patientName= patientButton.data("patient");

	var promise= Promise.resolve($.ajax({
		url: "/callsets/search",
		type: "POST",
		contentType: "application/json",
		dataType: "json",
		data: JSON.stringify({
			"variantSetIds": [patientId],
			"pageSize": 20
		})
	}));

	promise.then(function(result) {
		var context= {
			callSets: result["callSets"],
			projectName: patientName,
			id: patientId
		}
		var html= renderHbs('frangipani-project-details.hbs', context);
		patientTable.append(html);
	});

	return promise;
};

/* Clear the main application div. */
var clearApplicationMain= function() {
	// Scroll to the top of the page using animation
	$("body").animate({scrollTop: 0, scrollLeft: 0}, "slow");

	applicationMain.children().remove();
};

/* Update the table of projects. */
var updateProjectTable= function(context) {
	clearApplicationMain();

	// sort datasets in case-insensitive manner by name key
	var compare= function (d1, d2) {
		var a= d1.name.toUpperCase();
		var b= d2.name.toUpperCase();
		if (a < b)
			return -1;
		if (a > b)
			return 1;
		return 0;
	};
	context.datasets= context.datasets.sort(compare);

	var html= renderHbs('frangipani-projects.hbs', context);
	applicationMain.append(html);

	// Refresh page functionality.
	refresh();
};


/* 
 * Main app functionality.
 */
var applicationMain;
var app= function() {
	applicationMain= $("#frangipani-app-main");
	clickAction($("#frangipani-browse-button"), getProjects);
};

var patientTable;
var refresh= function() {
	patientTable= $("#frangipani-project-details");
	clickAction($(".frangipani-project-name"), getProjectPatients, {}, true);
};


/* 
 * Wait for the DOM to load before any processing.
 */
$(document).ready(app);








