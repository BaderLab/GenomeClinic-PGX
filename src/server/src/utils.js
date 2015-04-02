/* utility functions available for all routes
 * @author Patrick Magee */
module.exports = {
	isLoggedIn:function(req,res,next){
		if (req.isAuthenticated())
			return next();
		res.redirect('/login');
	},
	render:function(req,res,notFound,scripts){
		var template;
		var _o = {
			title:'PGX webapp',
			cache:true
		};
		if (notFound)
			template = 'notfound.hbs'
		else
			template = 'layout.hbs'

		if (req.isAuthenticated()){
			_o.authenticated = true;
			_o.user = req.user.username;
			if (scripts)
				_o.scripts = scripts;
			res.render(template,_o);
		} else {
			res.render(template,_o);
		}
	}
};