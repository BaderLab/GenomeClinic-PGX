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
function renderHbs(template_name, template_data) {
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
}

/* Serialize a form into JSON using function from StackOverFlow
 * http://stackoverflow.com/questions/1184624/convert-form-data-to-js-object-with-jquery */
$.fn.serializeObject = function() {
    var o = {};
    var a = this.serializeArray();
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


/* When a button is clicked, calls a function. While the function is 
 * executing, button says some intermediate text. Upon completion button
 * reverts to original text. */
function clickAction(button, promiseFunction, options) {
	var originalText= button.text();
	var resetButton= function(val) {
		button.text(originalText);
	};

	button.on("click", function() {
		button.text("Fetching...");
		if (options === undefined) {
			promiseFunction().then(resetButton);
		} else {
			promiseFunction(options).then(resetButton);
		}
	});
}


function fetcher() {
	var tables= {};  // hash of tables that have been created

	/* Listen for button clicks. */
	clickAction($("#frangipani-get-gg-datasets"), getGGDatasets);

	var callsetForm= $("#frangipani-get-gg-callsets");
	clickAction(callsetForm.find("a"), function() {
		return new Promise(function(resolve, reject) {
			// Process the data from the form into a POST request
			// to the GG server using the values from the form.
			// Relies on the form input names attributes being accurate.

			var jsonForm= callsetForm.serializeObject(); // need to worry about async here?
			// has to be an array of variant set ids
			jsonForm["variantSetIds"]= [jsonForm["variantSetIds"]];
			resolve(getGGCallsets(jsonForm)); // need to worry about async here?
		});
	});


	function updateCallsetTable(postGGCallsets) {
		// Extract the keys so they can be converted into the table header
		var headings= Object.keys(postGGCallsets["callSets"][0]);
		var context= {
			"callSets": postGGCallsets["callSets"],
			"headings": headings
		};

		var table= $("#frangipani-get-gg-callsets");

		// Create a table if it doesnt exist yet
		if (tables["callSets"] !== undefined) {
			table.siblings("table").remove();
		}

		// Create a table
		tables["callSets"]= true;
		var html= renderHbs('callsets_table.hbs', context);
		table.after(html);
	}

	function updateDatasetTable(getGGDatasets) {
		// Extract the keys so they can be converted into the table header
		var headings= Object.keys(getGGDatasets["datasets"][0]);
		var context= {
			"datasets": getGGDatasets.datasets,
			"headings": headings
		};

		var table= $("#frangipani-get-gg-datasets");

		// Remove table if it exists already
		if (tables["datasets"] !== undefined) {
			table.siblings("table").remove();
		}

		// Create a table
		tables["datasets"]= true;
		var html= renderHbs('datasets_table.hbs', context);
		table.after(html);
	}

	function getGGCallsets(properties) {
		var promise= Promise.resolve($.ajax({
			url: "http://localhost:8080/callsets/search",  // Need the "http://" here or will get CORS error
			type: "POST",
			contentType: "application/json",
			data: JSON.stringify(properties)
		}));

		return promise.then(updateCallsetTable);
	}

	function getGGDatasets() {
		var promise= Promise.resolve($.ajax({
			url: "http://localhost:8080/datasets",  // Need the "http://" here or will get CORS error
			type: "GET",
			contentType: "application/json",
		}));

		return promise.then(updateDatasetTable);
	}
}

/* Only start once the DOM is loaded. */
$(document).ready(fetcher);

