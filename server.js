/*
 * Frangipani genome annotation server that connects to genome storage servers
 * via the GA4GH API.
 * @author Ron Ammar
 */

var express= require("express");
var routes= require("./js/routes");

var app= express();

// Serve static content (css files, js files, templates, etc) from the
// foundation directory
app.use(express.static("main", {index: false}));

app.get("/", function(request, response) {
	response.sendFile("main/frangipani.html", {root: "."});
});

app.use("/datasets", routes.getRouter);
app.use("/callsets/search", routes.postRouter);
app.use("/variants/search",routes.postRouter);


app.listen(8080);