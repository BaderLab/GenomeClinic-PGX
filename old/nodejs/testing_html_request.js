var request= require("request");

var myAPIKey= "AIzaSyDQ37_4RW9gHeWxwaEn1Ab-7_kHAAFLXXM";

/* Remember that requests 1, 2 and 3 might not always return in the same
 * order that they are in below because javascript/nodejs is asynchronous. */

// 1
var options= {
	url: "https://www.googleapis.com/genomics/v1beta2/datasets?key=" + myAPIKey,
	method: "GET",
	json: true
};

request(options, function(error, response, body) {
	console.log(JSON.stringify(body));
	console.log("\n\n");
});

// 2
options= {
	url: "https://www.googleapis.com/genomics/v1beta2/callsets/search?key=" + myAPIKey,
	method: "POST",
	json: true,
	body: {
		"variantSetIds": ["10473108253681171589"],
		"name": "NA19393"
	}
};
request(options, function(error, response, body) {
	console.log(JSON.stringify(body));
	console.log("\n\n");
});

// 3
options= {
	url: "https://www.googleapis.com/genomics/v1beta2/variants/search?key=" + myAPIKey,
	method: "POST",
	json: true,
	body: {
		"variantSetIds": ["10473108253681171589"],
		"callSetIds": ["10473108253681171589-6", "10473108253681171589-0"],
		"referenceName": "1",
		"start": 51005353,
		"end": 51115354,
		"pageSize": 3  // number of variants returned for this request
	}
};
request(options, function(error, response, body) {
	console.log(body);
	console.log("\n\n");
});


