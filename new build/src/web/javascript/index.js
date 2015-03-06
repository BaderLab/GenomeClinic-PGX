var $ = require('jquery');
var foundation = require('./vendor/foundation.min');
var templates = require('./templates')
var projects = require('./projects'),
	status = require('./status'),
	uploader = require('./uploader'),
	utility = require('./utility'),
	config = require('./config'),
	login = require('./login-events'),
	patients = require('./patients'),
	pgx = require('./pgx'),


(function(){
	var location = window.location.pathname;
	utility.addNavBar().then(function(){
		if (location == '/'){
			$('#main').html(templates.index({title:'Frangipani'}));
		} else if (location.indexOf(['/login','/setpassword','/recover','/signup']) != -1){
			login(location);
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
		} else of (location == '/statuspage'){
			status()
		} else {
			$('#main').html(templates.notfound());
		}
	})
	$(document).foundation();
})()