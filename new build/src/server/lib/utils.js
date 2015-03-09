/* utility functions available for all routes */
module.exports = {
	isLoggedIn:function(req,res,next){
		if (req.isAuthenticated())
			return next();
		res.redirect('/login');
	},
	render:function(req,res,scripts){
		if (req.isAuthenticated()){
			var _o = {
				title:'PGX webapp',
				'authenticated':true,
				'user':req.user.username,
				'cache':true
			}
			if (scripts){
				_o['scripts'] = scripts;

			res.render('layout',_o);
		} else {
			res.render('layout');
		}
	}
};