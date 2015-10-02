var DB = require("./mongodbConnect");
var BO = require("./mongodbBasicOperations");

var db = new DB();

db.connect('test','test').then(function(){
	var bops = new BO(db);

	bops.find("future",{}).then(function(result){
		console.log(result);
	})
})