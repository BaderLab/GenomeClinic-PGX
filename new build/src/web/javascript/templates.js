//templates to be precompiled and sent to browser
var $ = require('jquery');

module.exports = {
	notfound:(function(){
	var t = require("../templates/404notfound.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	construction:(function(){
	var t = require("../templates/construction.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	index:(function(){
		var t = require("../templates/index.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	navbar:(function(){
		var t = require("../templates/navbar.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	login:(function(){
		var t = require("../templates/login.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	signup:(function(){
		var t = require("../templates/signup.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	recover:(function(){
		var t = require("../templates/recover.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	setpassword:(function(){
		var t = require("../templates/set-password.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	statuspage:{
		index:(function(){
			var t = require("../templates/status-page.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})(),
		row:(function(){
			var t = require("../templates/status-page-add-status-row.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})()
	},
	uploadpage:{
		index:(function(){
			var t = require("../templates/upload.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})(),
		vcf:(function(){
			var t = require("../templates/upload-add-vcf.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})(),
		progress:(function(){
			var t = require("../templates/upload-add-progress-bar.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})()
	},
	project:{
		index:(function(){
			var t = require("../templates/project.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})(),
		new:(function(){
			var t = require("../templates/project-add-project.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})(),
		info:(function(){
			var t = require("../templates/project-info-page.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})(),
		user:(function(){
			var t = require("../templates/project-auth-user.hbs");
			return function insertEle(e,o){
				return Promise.resolve().then(function(){return t(o)}).then(function(html){
					$(e).html(html);
				})
			}
		})(),
	},
	patient:(function(){
	var t = require("../templates/patients-table.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	pgx:(function(){
	var t = require("../templates/pgx-page.hbs");
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			})
		}
	})(),
	config:(function(){
		var t = require('../templates/server-config.hbs');
		return function insertEle(e,o){
			return Promise.resolve().then(function(){return t(o)}).then(function(html){
				$(e).html(html);
			});
		}
	})()
};