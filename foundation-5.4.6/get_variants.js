/* When a button is clicked, calls a function. While the function is 
 * executing, button says some intermediate text. Upon completion button
 * reverts to original text. */
var fetchCompleteEvent= $.Event("fetchComplete");

function clickAction(button, buttonFunction, options) {
	var originalText= button.text();

	var resetButton= function() {
		button.text(originalText);
	};

	button.on("click", function() {
		button.text("Fetching...");
		if (options === undefined) {
			buttonFunction(resetButton);
		} else {
			buttonFunction(options, resetButton);
		}
	});
}

/* Function to retrieve and render a handlebars template. This function is
 * modified from the function provided by user koorchik on StackOverFlow:
 * http://stackoverflow.com/questions/8366733/external-template-in-underscore
 * as explained on the following blog entry:
 * http://javascriptissexy.com/handlebars-js-tutorial-learn-everything-about-handlebars-js-javascript-templating/
 */
function renderHbs(template_name, template_data) {
	if (!renderHbs.template_cache) { 
	    renderHbs.template_cache= {};
	}

	if (!renderHbs.template_cache[template_name]) {
		var template_url= '/templates/' + template_name;
		$.ajax({
			url: template_url,
			method: 'GET',
			async: false,  // I'm keeping this async for now (from original code)
			success: function(data) {
				renderHbs.template_cache[template_name]= Handlebars.compile(data);
			}
		});
	}

	return renderHbs.template_cache[template_name](template_data);
}


function fetcher() {
	var tables= {};  // hash of tables that have been created

	/* Listen for button clicks. */
	clickAction($("#frangipani-get-gg-datasets"), getGGDatasets);

	function updateTable(getGGDatasets, callback) {
		// Extract the keys so they can be converted into the table header
		var headings= Object.keys(getGGDatasets["datasets"][0]);
		var context= {
			"datasets": getGGDatasets.datasets,
			"headings": headings
		};

		// Create a table if it doesnt exist yet
		if (tables["datasets"] === undefined) {
			tables["datasets"]= true;
			var html= renderHbs('datasets_table.hbs', context);
			$("#frangipani-get-gg-datasets").after(html);
		}

		callback();
	}

	function getGGDatasets(callback) {
		$.ajax({
			url: "http://localhost:8080/datasets",  // Need the "http://" here or will get CORS error
			type: "GET",
			contentType: "application/json",
			success: function(data) {
				updateTable(data, callback);
			},
			error: function(request, errorType, errorMessage) {
				console.log("Error: " + errorType + " with message " + errorMessage);
			}
		});
	}
}

/* Only start once the DOM is loaded. */
$(document).ready(function() {
	fetcher();
});