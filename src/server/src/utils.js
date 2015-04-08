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
			res.render(template,_o);
		} else {
			res.render(template,_o);
		}
	}
};