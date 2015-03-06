module.exports = {
	'notfound':require("../templates/404notfound.hbs"),
	'construction':require("../templates/construction.hbs"),
	'index':require("../templates/index.hbs"),
	'navbar':require("../templates/navbar.hbs"),
	'login':require("../templates/login.hbs"),
	'signup':require("../templates/signup.hbs"),
	'recover':require("../templates/recover.hbs"),
	'setpassword':require("../templates/set-password.hbs"),
	'statuspage':{
		'index':require("../templates/status-page.hbs"),
		'row':require("../templates/status-page-add-status-row.hbs")
	},
	'uploadpage':{
		'index':require("../templates/upload.hbs"),
		'vcf':require("../templates/upload-add-vcf.hbs"),
		'progress':require("../templates/upload-add-progress-bar.hbs")
	},
	'project':{
		'index':require("../templates/project.hbs"),
		'new':require("../templates/project-add-project.hbs"),
		'info':require("../templates/project-info-page.hbs"),
		'user':require("../templates/project-auth-user.hbs")
	},
	'patient':require("../templates/patients-table.hbs"),
	'pgx':require("../templates/pgx-page.hbs")

}