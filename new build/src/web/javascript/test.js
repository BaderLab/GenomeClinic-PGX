templates = require('./templates');
require('./foundation.min');

Promise.resolve(function(){
	$(document).foundation();
}).then(function(){
	return templates.navbar({authenticated:true,user:'patrick@gmail.com'})
}).then(function(html){
	$('nav').append(html);
});
