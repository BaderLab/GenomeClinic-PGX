var dbFunctions = require('../models/mongodb_functions'),
	constants = require('../lib/conf/constants.json');
/* utility functions available for all routes
 * @author Patrick Magee */
module.exports = {
	isLoggedIn:function(req,res,next){
		if (req.isAuthenticated())
			return next();
		res.redirect('/login');
	},
	render:function(req,res,type,scripts){
		var template;
		template = 'layout.hbs';
		if (!scripts)
			scripts = [];

		var _o = {
			title:'PGX webapp',
			cache:true
		};
		if (type == "construction")
			_o.construction = true;
		else if (type == 'notfound') {
			_o.notfound = true;
		} else {
			scripts.push("/static/js/bundle.min.js");
		}
		
		if (scripts)
			_o.src = scripts;
		if (req.isAuthenticated()) {
			_o.authenticated = true;
			_o.user = req.user.username;
			// eventually add _o.admin_user this will toggle the admin configuration
			// once the configuration is toggled it will take the user to the admin
			// page.
			var options = {
				'admin-email':1,
				'_id':0
			};
			dbFunctions.getAdminEmail(constants.dbConstants.DB.ADMIN_COLLECTION,{},options).then(function(result){
				_o.admin = result === _o.user;
				res.render(template,_o);	
			});
			
		} else {
			res.render(template,_o);
		}
	}
};