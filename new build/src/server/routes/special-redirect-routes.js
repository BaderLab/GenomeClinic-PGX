
module.exports = function(app)
	//route to send information in the event of a login failure
	app.get('/failure',function(req,res){
		var response ={status:'failed',error:req.flash('error'),redirectURL:undefined,statusCode:req.flash('statusCode')}
		res.send(JSON.stringify(response))
	});

	//route to send information in the event of a login success
	app.get('/success',function(req,res){
		var redirectURL = req.flash('redirectURL');
		var response = {status:'ok',error:undefined,redirectURL:(redirectURL != '' ? redirectURL:'/'),statusCode:req.flash('statusCode')}
		res.send(JSON.stringify(response))
	})

};
