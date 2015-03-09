var $ = require('Jquery');
require('./vendor/foundation.min');

var templates = require('./templates')
var projects = require('./projects'),
	status = require('./status-page'),
	uploader = require('./uploader'),
	utility = require('./utility'),
	config = require('./config'),
	authentication = require('./authentication'),
	patients = require('./patients');


(function(){
	var location = window.location.pathname;
	Promise.resovel().then(function(){
		if (location == '/'){
			$('#main').html(templates.index({title:'Frangipani'}));
		} else if (location.indexOf(['/login','/setpassword','/recover','/signup']) != -1){
			authentication(location);
		} else if (location == '/upload'){
			uploader();
		} else if (locaton == '/projects'){
			projects();
		} else if (location == '/browsepatients'){
			patients();
		} else if (locaton == '/config'){
			config();
		} else if (location == '/panel'){
			$('#main').html(templates.construction())
		} else if (location == '/statuspage'){
			status()
		} else {
			$('#main').html(templates.notfound());
		}
	}).then(function(){
		utility.refresh();
	})
})()