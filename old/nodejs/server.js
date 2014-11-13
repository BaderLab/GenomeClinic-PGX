var express= require("express");
var app= express();

app.get("/", function(request, response) {
	response.sendFile("index.html", {root: "."});
});

app.get("/about", function(request, response) {
	response.sendFile("about.html", {root: "."});
});

app.listen(8080);