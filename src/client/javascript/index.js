var $ = require('jquery');
var templates = require('./templates');
var projects = require('./projects'),
	status = require('./status-page'),
	uploader = require('./uploader'),
	utility = require('./utility'),
	config = require('./config'),
	authentication = require('./authentication'),
	patients = require('./patients');


(function(){
	var location = window.location.pathname;
	Promise.resolve().then(function(){
		console.log(location);
		if (location == '/'){
			templates.index({title:'Frangipani'}).then(function(renderedHtml){
				$('#main').html(renderedHtml);
			});
		} else if (['/login','/setpassword','/recover','/signup'].indexOf(location) != -1){
			authentication(location);
		} else if (location == '/upload'){
			uploader();
		} else if (location == '/projects'){
			projects();
		} else if (location == '/browsepatients'){
			patients();
		} else if (location == '/config'){
			config();
		} else if (location == '/panel'){
			templates.construction().then(function(renderedHtml){
				$('#main').html(renderedHtml);
			});
		} else if (location == '/statuspage'){
			status();
		} else {
			templates.notfound().then(function(renderedHtml){
				$('#main').html(renderedHtml);
			});
		}
	}).then(function(){
		utility.refresh();
	});
})();