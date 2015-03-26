var Promise = require('bluebird');
var cons = Promise.promisifyAll(require('consolidate'));

cons.handlebarsAsync('./layout.hbs',{}).then(function(html){
	console.log(html);
}).catch(function(err){
	console.log(err)
});