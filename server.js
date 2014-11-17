var express= require("express");
var request= require("request");
var bodyParser= require("body-parser");

/* My testing server */
var app= express();

// Serve static content (css files, js files, etc) from the foundation directory
app.use(express.static("foundation-5.4.6", {index: false}));

/*
// Enable cross-origin resource sharing
app.use(function(request, response, next) {
	response.header("Access-Control-Allow-Origin", "http://localhost:8080");
	next();
});
*/

app.get("/", function(request, response) {
	response.sendFile("foundation-5.4.6/get_variants.html", {root: "."});
});

app.get("/datasets", function(request, response) {
	getGGDatasets(response);
});

/* Here we need to parse the JSON from the body using body-parser. However,
 * not all request bodies should be processed, so we're specifying the path.
 * The path can also be changed to a pattern such as:
 * app.use('/ab*cd', function (req, res, next) {
 * or regex such as:
 * app.use(/\/abc|\/xyz/, function (req, res, next)... */
variantSearchUrl= "/variants/search";
app.use(variantSearchUrl, bodyParser.json());
app.post(variantSearchUrl, function(request, response) {
	coords= request.body;
	getGGVariants(coords.referenceName, coords.start, coords.end, response);
});

app.listen(8080);


/* Requests are made to the Google Genomics ("GG") GA4GH-compliant server */

// Google API key associated with Bader Lab IP address
var myAPIKey= "AIzaSyDQ37_4RW9gHeWxwaEn1Ab-7_kHAAFLXXM";

function getGGDatasets(nodeResponse) {
	var options= {
		url: "https://www.googleapis.com/genomics/v1beta2/datasets?key=" + myAPIKey,
		method: "GET",
		json: true
	};

	request(options, function(error, googleResponse, body) {
		nodeResponse.send(body);
	});
}