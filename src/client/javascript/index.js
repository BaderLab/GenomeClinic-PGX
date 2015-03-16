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
		if (location == '/'){
			return templates.index({title:'PGX Webapp'}).then(function(renderedHtml){
				$('#main').html(renderedHtml);
			});
		} else if (['/login','/setpassword','/recover','/signup'].indexOf(location) != -1){
			return authentication(location);
		} else if (location == '/upload'){
			return uploader();
		} else if (location == '/projects'){
			return projects();
		} else if (location == '/browsepatients'){
			return patients();
		} else if (location == '/config'){
			return config();
		} else if (location == '/panel'){
			return templates.construction().then(function(renderedHtml){
				$('#main').html(renderedHtml);
			});
		} else if (location == '/statuspage'){
			return status();
		} else {
			return templates.notfound().then(function(renderedHtml){
				$('#main').html(renderedHtml);
			});
		}
	}).then(function(){
		utility.refresh();
	});
})();