function fetcher() {
	function updateTable(ggDatasets) {
		console.log(JSON.stringify(ggDatasets));
		for (var key in ggDatasets) {
			$.each(ggDatasets[key], function(index, singleDataset) {
				if ($("#frangipani-main-pane table").length == 0) {  // check if table exists
					var table= $("<table><thead><tr id='marvel'></tr></thead></table>");
					table.append($("<tbody id='shazam'></tbody>"));
					$("#frangipani-main-pane").append(table);
					$.each(Object.keys(singleDataset), function(index2, columnHeading) {
						$("#marvel").append($("<th>" + columnHeading + "</th>"));
					});
				}

				var currentRow= $("<tr></tr>"); 
				//debugger;  // Open the Javascript debugger to find out how error is happening
				for (var k in singleDataset) {
					currentRow.append($("<td>" + singleDataset[k] + "</td>"));
				}
				$("#shazam").append(currentRow);
			});
		}

		$("#frangipani-fetch-button").text("Fetch complete.");
	}

	function getGGDatasets() {
		$.ajax({
			url: "http://localhost:8080/datasets",  // Need the "http://" here or will get CORS error
			type: "GET",
			contentType: "application/json",
			success: updateTable,
			error: function(request, errorType, errorMessage) {
				console.log("Error: " + errorType + " with message " + errorMessage);
			}
		});
	}

	function getGGVariants() {
		$.ajax({
			url: "http://localhost:8080/variants/search",  // Need the "http://" here or will get CORS error
			type: "POST",
			contentType: "application/json",
			dataType: "json",
			data: JSON.stringify({
				"referenceName": "22",
				"start": 51005353,
				"end": 51015354
			}),
			success: updateTable,
			error: function(request, errorType, errorMessage) {
				console.log("Error: " + errorType + " with message " + errorMessage);
			}
		});
	}

	/* When button is clicked, fetch datasets from Google Genomics server. */
	$("#frangipani-fetch-button").on("click", function() {
		$("#frangipani-fetch-button").text("Fetching...");
		getGGDatasets();
	});

	$("#frangipani-variant-button").on("click", function() {
		$("#frangipani-variant-button").text("Fetching...");
		getGGVariants();
	});
}

/* Only start once the DOM is loaded. */
$(document).ready(function() {
	fetcher();
});