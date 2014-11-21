/*
 * Frangipani genome annotation server that connects to genome storage servers
 * via the GA4GH API.
 * @author Ron Ammar
 */

var express= require("express");
var routes= require("./frangipani_node_modules/routes");

var app= express();

// Serve static content (css files, js files, templates, etc) from the
// foundation directory
app.use(express.static("foundation-5.4.6", {index: false}));

app.get("/", function(request, response) {
	response.sendFile("foundation-5.4.6/frangipani.html", {root: "."});
});

app.use("/datasets", routes.getRouter);

/* For the JSON POST requests, build an Express router and have the
 * app use() that router, rather than writing code like this:

	app.use("/search", bodyParser.json());
	app.post("/search", function(request, response) {
		params= request.body;
		getSearchResults(params.words, params.numbers, response);
	});

 * Instead do this, and you can even put all the routes in a separate node module:

	var jsonPostRouter= express.Router();
	jsonPostRouter.use(bodyParser.json())
	jsonPostRouter.post( function(request, response) {
		params= request.body;
		getSearchResults(params.words, params.numbers, response);
	});

	app.use("/search", jsonPostRouter);
 */

app.listen(8080);