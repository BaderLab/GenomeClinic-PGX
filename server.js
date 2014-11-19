var express= require("express");
var request= require("request");

/* My testing server */
var app= express();

// Serve static content (css files, js files, templates, etc) from the
// foundation directory
app.use(express.static("foundation-5.4.6", {index: false}));

app.get("/", function(request, response) {
	response.sendFile("foundation-5.4.6/index.html", {root: "."});
});

app.listen(8080);