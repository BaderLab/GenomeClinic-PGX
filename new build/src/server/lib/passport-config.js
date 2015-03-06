var LocalStrategy = require('passport-local').Strategy;
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var dbConstants = require('./mongodb_constants');


module.exports = function(passport,dbFunctions,opts){

	passport.serializeUser(function(user,done){
		done(null,user[dbConstants.USER_ID_FIELD]);
	});

	passport.deserializeUser(function(id,done){
		dbFunctions.findUserById(id).then(function(user){
			done(null,user);
		}).catch(function(err){
			done(err);
		});
	});

	if (opts.signup){
		passport.use('local-signup', new LocalStrategy({
			usernameField:'username',
			passwordField:'password',
			passReqToCallback: true
		},
			function(req,username,password,done){
				process.nextTick(function(){
					dbFunctions.findUserById(username)
					.then(function(user){
						if (user) {
							return done(null,false,req.flash('error','That Email already exists'),req.flash('statusCode','409'));
						} else {
							var user = {}
							user[dbConstants.USER_ID_FIELD] = username.toString();
							user[dbConstants.USER_PASSWORD_FIELD] = password.toString();
							dbFunctions.addUser(user).then(function(){
								return done(null,user,req.flash('statusCode','200'))
							}).catch(function(err){
								return done(err,null,req.flash('statusCode','400'));
							});
						}
					});
				});
			}
		));
	}

	passport.use('local-login', new LocalStrategy({
		usernameField:'username',
		passwordField:'password',
		passReqToCallback:true
	},

		function(req,username,password,done){
			process.nextTick(function(){
				dbFunctions.findUserById(username)
				.then(function(user){
					if (user) { 
						dbFunctions.validatePassword(username.toString(),password.toString()).then(function(result){
							if (result){
								return done(null,user);
							} else {
								return done(null,false,req.flash("error", "Oops! Wrong Password"),req.flash('statusCode','400'));
							}
						}).catch(function(err){
							done(err)
						});
					} else {
						return done(null,false,req.flash('error','Oops, No user was found!'),req.flash('statusCode','404'));
					}
				});
			});
		}
	));

	if (opts.oauth){
		var api = require('./api');
		passport.use(new GoogleStrategy({
			clientID: api.googleAuth.clientID,
			clientSecret: api.googleAuth.clientSecret,
			callbackURL:api.googleAuth.callbackURL
		},	
			function(token,refreshToken,profile,done){
				process.nextTick(function(){
					var query = {};
					query[dbConstants.USER_GOOGLE_ID_FIELD] = profile.id;
					dbFunctions.findUserByGoogleId(profile.id)
					.then(function(user){
						if (user) {
							return done(null,user);
						} else {
							var user = {};
							user[dbConstants.USER_ID_FIELD]= profile.emails[0].value;
							user[dbConstants.USER_GOOGLE_ID_FIELD]=profile.id;
							user[dbConstants.USER_GOOGLE_TOKEN_FIELD]=token;
							user[dbConstants.USER_GOOGLE_NAME_FIELD]=profile.displayName;
							user[dbConstants.USER_GOOGLE_EMAIL_FIELD]=profile.emails[0].value;
							dbFunctions.addUserGoogle(user).then(function(){
								return done(null,user)
							}).catch(function(err){
								done(err);
							});
						};
					})
				});;
			}
		))
	}
};