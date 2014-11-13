var fetcher= {
	fetch: function() {
		/*
		var originalText= $("#frangipani-fetch-button").text();
		function resetButtonCallback() {
			$("#frangipani-fetch-button").text(originalText);
		}
		*/

		function updateTable(ggDatasets) {
			console.log("Data received from Google Genomics server!");
			console.log(JSON.stringify(ggDatasets));
			$.each(ggDatasets.datasets, function(index, singleDataset) {
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

			$("#frangipani-fetch-button").text("Fetch complete.");
		}

		var googleAPIKey= "AIzaSyDQ37_4RW9gHeWxwaEn1Ab-7_kHAAFLXXM";
		function getGGDatasets() {
			$.ajax({
				url: "https://www.googleapis.com/genomics/v1beta2/datasets?key=" + googleAPIKey,
				type: "GET",
				contentType: "application/json",
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
			//setTimeout(resetButtonCallback, 2000);
		});
	}
}

$(document).ready(function() {
	fetcher.fetch();
});