/* These routes are used when a request is sent and then it is waiting for a 
 * success or failure message. These generalized routes will return information
 * about the status of a request, along wiht any relevant information that goes 
 * along with the status 
 * @author Patrick Magee */
module.exports = function(app,logger,opts){
	//route to send information in the event of a login failure
	app.get('/failure',function(req,res){
		var response ={status:'failed',error:req.flash('error'),redirectURL:undefined,statusCode:req.flash('statusCode'),message:req.flash('message')[0]};
		res.send(JSON.stringify(response));
	});

	//route to send information in the event of a login success
	app.get('/success',function(req,res){
		var redirectURL = req.flash('redirectURL');
		var statusCode = req.flash('statusCode');
		var alert = req.flash('alert');
		var message = req.flash('message');
		if (Object.prototype.toString.call(statusCode) == "[object Array]"){
			if (statusCode.length === 0)
				statusCode = undefined;
			else if (statusCode.length === 1)
				statusCode = statusCode[0];
		}
		if (Object.prototype.toString.call(alert) == "[object Array]"){
			if (alert.length === 0)
				alert = undefined;
			else if (alert.length === 1)
				alert = alert[0];
		}
		if (Object.prototype.toString.call(message) == "[object Array]"){
			if (message.length === 0)
				message = undefined;
			else if (message.length === 1)
				message = message[0];
		}
		var response = {
			status:'ok',
			error:undefined,
			redirectURL:(redirectURL !== '' ? redirectURL:'/'),
			statusCode:statusCode,
			alert: alert,
			message: message
		};		
		res.send(JSON.stringify(response));
	});

};
