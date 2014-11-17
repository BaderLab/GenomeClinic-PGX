var myAPIKey= "AIzaSyDQ37_4RW9gHeWxwaEn1Ab-7_kHAAFLXXM";
$.ajax({
	url: "https://www.googleapis.com/genomics/v1beta2/variants/search?key=" + myAPIKey,
	type: "POST",
	contentType: "application/json",
	dataType: "json",
	data: JSON.stringify({
		"variantSetIds": ["10473108253681171589"],
		"callSetIds": ["10473108253681171589-6"],
		"referenceName": "22",
		"start": 51005000,
		"end": 51005200,
		//"pageToken": "COyNqRgQ3MDCsf7HgPuzAQ",
		"pageSize": 2  // number of variants returned for this request
	}),
	success: function(response) {
		console.log(response);
		console.log("Next page token " + response["nextPageToken"]);
	},
	error: function(request, errorType, errorMessage) {
		console.log("Error: " + errorType + " with message " + errorMessage);
	}
});