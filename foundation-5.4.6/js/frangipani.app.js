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
	// Find out if this is a new table or rows to be appended to existing table
	if (options["nextPageToken"] === undefined) {
		var projectButton= options["thisButton"];
		var projectId= projectButton.data("id");
		var projectName= projectButton.data("project");
		var currentTemplate= "frangipani-project-details.hbs";
		var domInsertPoint= patientTable;
		var nextPageToken= undefined;
		resetPatientTable();
	} else {
		currentTemplate= "frangipani-more-patients.hbs";
		domInsertPoint= patientTable.find("tbody");
		projectId= options["id"];
		nextPageToken= options["nextPageToken"];
	}

	var promise= Promise.resolve($.ajax({
		url: "/callsets/search",
		type: "POST",
		contentType: "application/json",
		dataType: "json",
		data: JSON.stringify({
			"variantSetIds": [projectId],
			"pageSize": 30,
			"pageToken": nextPageToken
		})
	}));

	promise.then(function(result) {
		var context= {
			"callSets": result["callSets"],
			"nextPageToken": result["nextPageToken"],
			"projectName": projectName,
			"id": projectId
		}
		var html= renderHbs(currentTemplate, context);
		domInsertPoint.append(html);

		// update the progress spinner's next page token, if the spinner already exists
		progressSpinner.data("next-page", context["nextPageToken"]);
	
		return context;

	}).then(function(context) {
		// set scrolledToBottom to false, to allow for AJAX request triggers
		// on scroll events only after the table has been appended. If there
		// are no more page tokens, we have reached the bottom.
		refresh();
		if (context["nextPageToken"] !== undefined) {
			scrolledToBottom= false;
		}
		progressSpinner.hide();
	});

	return promise;
};

/* Clear the main application div. */
var clearApplicationMain= function() {
	// Scroll to the top of the page using animation
	$("body").animate({scrollTop: 0, scrollLeft: 0}, "fast");

	applicationMain.children().remove();
};

/* Reset the patient table. */
var resetPatientTable= function() {
	// Scroll to the top of the page using animation, and set scrolledToBottom
	// as true to block AJAX request triggers on scroll events until we're at the top
	scrolledToBottom= true;
	$("body").animate({scrollTop: 0, scrollLeft: 0}, "fast");
	
	// Clear patient table
	patientTable.children().remove();
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

	// Add event listeners and refresh jQuery DOM objects.
	addProjectEventListeners();
	refresh();
};


/* 
 * Main app function.
 */
var applicationMain;
var app= function() {
	applicationMain= $("#frangipani-app-main");
	clickAction($("#frangipani-browse-button"), getProjects);
};

/* App components */
var patientTable;
var scrolledToBottom= true;
var progressSpinner;
var refresh= function() {
	patientTable= $("#frangipani-project-details");
	progressSpinner= $("#frangipani-progress-spinner");
};


/*
 * Event listeners
 */

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

/* If there are more patients, load them when scrolled to the bottom of the
 * patient table. */
var loadPatientsOnScroll= function() {
	$(window).on("scroll", function(event) {
		if (!scrolledToBottom && 
			progressSpinner.data("next-page") != "" &&
			$(window).scrollTop() + $(window).height() >= patientTable.height()) {

			scrolledToBottom= true;
			progressSpinner.show();
			var options= {
				"id": progressSpinner.data("id"),
				"nextPageToken": progressSpinner.data("next-page")
			};
			getProjectPatients(options);
		}
	});
};

/* Add the app event listeners */
var addProjectEventListeners= function() {
	clickAction($(".frangipani-project-name"), getProjectPatients, {}, true);
	loadPatientsOnScroll();
};


/* 
 * Wait for the DOM to load before any processing.
 */
$(document).ready(app);








