/* Playing with Handlebars in node.js (not express.js). */

var Handlebars= require("handlebars");


// Example code from handlebars github page
var source = "<p>Hello, my name is {{name}}. I am from {{hometown}}. I have " +
             "{{kids.length}} kids:</p>" +
             "<ul>{{#kids}}<li>{{name}} is {{age}}</li>{{/kids}}</ul>";

var template = Handlebars.compile(source);

var data = { "name": "Alan", "hometown": "Somewhere, TX",
             "kids": [{"name": "Jimmy", "age": "12"}, {"name": "Sally", "age": "4"}]};

var result = template(data);

console.log(result);



// Iterating over an array (using "this")

var randomList= ["James Bond", "Dr. No", "Octopussy", "Goldeneye"];

var source= "<ul>{{#each this}}<li>{{this}}</li>{{/each}}</ul>";
//var source= "<ul>{{#each .}}<li>{{.}}</li>{{/each}}</ul>";  // equivalent output

var template= Handlebars.compile(source);

console.log(template(randomList));



// Playing around with GA4GH data
var data= {"datasets":[{"id":"337315832689","projectNumber":"337315832689","isPublic":true,"name":"DREAM SMC Challenge"},{"id":"383928317087","projectNumber":"383928317087","isPublic":true,"name":"PGP Genomes"},{"id":"436488972530","projectNumber":"436488972530","isPublic":true,"name":"SMaSH"},{"id":"461916304629","projectNumber":"461916304629","isPublic":true,"name":"Simons Foundation Genomes"},{"id":"70305727802651583","projectNumber":"1094650924340","isPublic":true,"name":"name"},{"id":"2737013305060793389","projectNumber":"21065077618","isPublic":true,"name":"Sample"},{"id":"2831627299882627465","projectNumber":"107046053965","isPublic":true,"name":"fda_salmonella"},{"id":"3049512673186936334","projectNumber":"761052378059","isPublic":true,"name":"Platinum Genomes"},{"id":"4252737135923902652","projectNumber":"761052378059","isPublic":true,"name":"1000 Genomes - Phase 3"},{"id":"5772819235625411241","projectNumber":"135067622198","isPublic":true,"name":"NGVariants1"},{"id":"5983591567833477689","projectNumber":"672829729054","isPublic":true,"name":"science.1259657"},{"id":"10116235111106464365","projectNumber":"21065077618","isPublic":true,"name":"123123"},{"id":"10473108253681171589","projectNumber":"761052378059","isPublic":true,"name":"1000 Genomes"},{"id":"11489600586121746404","projectNumber":"867144566684","isPublic":true,"name":"hello3_dataset"},{"id":"13202006775796151156","projectNumber":"135067622198","isPublic":true,"name":"NorthropGrumman"},{"id":"13347319080144059743","projectNumber":"21065077618","isPublic":true,"name":"123123"},{"id":"13548522727457381097","projectNumber":"107046053965","isPublic":true,"name":"fda_listeria"},{"id":"13770895782338053201","projectNumber":"107046053965","isPublic":true,"name":"fda_test"},{"id":"14245419902512089604","projectNumber":"557951025023","isPublic":true,"name":"vcftest"},{"id":"15385189670383127980","projectNumber":"472554351724","isPublic":true,"name":"hongiiv"},{"id":"16801540936334623823","projectNumber":"475730298554","isPublic":true,"name":"pipelines_test_data"},{"id":"17482967768341364669","projectNumber":"867144566684","isPublic":true,"name":"hello2_dataset"},{"id":"17995947167550436828","projectNumber":"867144566684","isPublic":true,"name":"hello_dataset"}]};

var headings= Object.keys(data["datasets"][0]);

var singleDataObject= {
	"datasets": data.datasets,
	"headings": headings
};

var source= "<table><thead><tr>{{#each headings}}<th>{{this}}</th>{{/each}}</tr></thead>" +
			"<tbody>{{#each datasets}}<tr><td>{{id}}</td><td>{{projectNumber}}</td>" +
			"<td>{{isPublic}}</td><td>{{name}}</td></tr>{{/each}}</tbody></table>";

var template= Handlebars.compile(source);

console.log(template(singleDataObject));






















