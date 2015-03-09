//templates to be precompiled and sent to browser
var $ = require('Jquery');
var notfound = require("../templates/404notfound.hbs"),
	construction = require('../templates/construction.hbs'),
	index = require('../templates/index.hbs'),
	navbar = require('../templates/navbar.hbs'),
	login = require('../templates/login.hbs'),
	signup = require('../templates/signup.hbs'),
	recover = require('../templates/recover.hbs'),
	setpassword = require('../templates/set-password.hbs'),
	statuspageIndex = require('../templates/status-page.hbs'),
	statuspageRow = require('../templates/status-page-add-status-row.hbs'),
	uploadpageIndex = require('../templates/upload.hbs'),
	uploadpageVcf = require('../templates/upload-add-vcf.hbs'),
	uploadpageProgress = require('../templates/upload-add-progress-bar.hbs'),
	projectIndex = require('../templates/project.hbs'),
	projectNew = require('../templates/project-add-project.hbs'),
	projectInfo = require('../templates/project-info-page.hbs'),
	projectUser = require('../templates/project-auth-user.hbs'),
	patient = require('../templates/patients-table.hbs'),
	pgx = require('../templates/pgx-page.hbs'),
	config = require('../templates/server-config.hbs')
// CUSTOM HANDLEBARS HELPERS

//PGX helpers

var _t = function(t){
	return function p (o){
		return Promise.resolve().then(function(){
			return t(o);
		});
	};
};

module.exports = {
	notfound:_t(notfound),
	construction:_t(construction),
	index:_t(index),
	navbar:_t(navbar),
	login:_t(login),
	signup:_t(signup),
	recover:_t(recover),
	setpassword:_t(setpassword),
	statuspage:{
		index:_t(statuspageIndex),
		row:_t(statuspageRow)
	},
	uploadpage:{
		index:_t(uploadpageIndex),
		vcf:_t(uploadpageVcf),
		progress:_t(uploadpageProgress)
	},
	project:{
		index:_t(projectIndex),
		new:_t(projectNew),
		info:_t(projectInfo),
		user:_t(projectUser)
	},
	patient:_t(patient),
	pgx:_t(pgx),
	config:_t(config)
};