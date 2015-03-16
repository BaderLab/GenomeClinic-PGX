/* utility functions available for all routes */
module.exports = {
	isLoggedIn:function(req,res,next){
		if (req.isAuthenticated())
			return next();
		res.redirect('/login');
	},
	render:function(req,res,scripts){
		var _o = {
			title:'PGX webapp',
			cache:true
		};
		if (req.isAuthenticated()){
			_o.authenticated = true;
			_o.user = req.user.username;
			if (scripts)
				_o.scripts = scripts;
			res.render('layout.hbs',_o);
		} else {
			res.render('layout.hbs',_o);
		}
	}
};