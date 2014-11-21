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
var clickAction= function(button, promiseFunction, options) {
	var originalText= button.text();
	var resetButton= function(val) {
		button.text(originalText);
	};

	button.on("click", function(event) {
		event.preventDefault();

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
};


/* 
 * Main app functionality.
 */
var applicationMain;
var app= function() {
	applicationMain= $("#frangipani-app-main");
	clickAction($("#frangipani-browse-button"), getProjects);
	//clickAction($(".frangipani-project-name"), );
};


/* 
 * Wait for the DOM to load before any processing.
 */
$(document).ready(app);








