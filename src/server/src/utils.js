var constants = require('../lib/conf/constants.json'),
	_ = require('underscore'),
	glob = require('glob'),
	Promise = require('bluebird'),
	fs = Promise.promisifyAll(require('fs'));
/* utility functions available for all routes
 * @author Patrick Magee */


/* retrive the partials from the partials directory*/
var partialsArr = glob.GlobSync(constants.nodeConstants.SERVER_DIR + '/' + constants.nodeConstants.PARTIALSDIR + '/*').found;

module.exports = {
	/* when give the request check to ensure that the user is serialized to an active session
	 * or not. If they are move to the next function, else redirect them to /login
	  */
	isLoggedIn:function(req,res,next){
		if (req.isAuthenticated())
			return next();
		res.redirect('/login');
	},

	/* Render the main template page. This page does not contain any specific content in the body except
	 * in the special casses of a 404 not found error, and a construction page. The html page is rendereded
	 * from the handlebars template layout.hbs in the views folder. There are three parameters that can be
	 * passed to render:
	 * req - original request. required
	 * res - original response. required
	 * _o - { // Optional options parameter
	 * 	scripts: Array or string of scripts to add to the template page, this will be added within the <head>
	 *  css: Array or string of CSS elements to add to the page layout (ONLY IF CHANGES) **TODO**
	 * 	meta: [
	 *		Object of Meta information
	 *		{
	 *			name: Name String,
	 *			content: Content string			
	 *		}
	 *	],
	 *	code: { 
	 *		code:string containing code snippet,
	 *		type:type of code ie. text/javascript
	 *	},
	 *	type: the type of page that is to be loaded. this can be construction or notfound,
	 *  title : app title,
	 *  cache : should the template be chached
	 * }
	 * all other parameters are set internally wihtin the function. The Function renders the Html and sends the 
	 * response to the client.*/
	render:function(req,res,_o){
		var template;
		template = 'layout.hbs';
		if (!_o){ // initialize _o if not set
			_o = {};
		}

		if (!_o.partials)	//Add partials to the partials option.
			_o.partials = {};
		for (var i = 0; i < partialsArr.length; i++){
			var file = partialsArr[i].split(/[\/\\]/g).splice(-1)[0].split('.')
			var name = file[0]
			var ext = '.' + file[1];
			_o.partials[name] = 'partials' + '/' + name;
		}

		if (!_o.scripts) //initialize _o.scripts if not passed
			_o.scripts = [];
		//scripts can be an array or a string, however for the template an array is required.
		// Convert the string to an array
		else if (Object.prototype.toString.call(_o.scripts) == '[object String]')
			_o.scripts = [_o.scripts];
		//For each entry in _o.scripts add the static path to the content 
		for (var i = 0; i < _o.scripts.length; i++){
			_o.scripts[i] = '/static/js/' + _o.scripts[i];
		}


		if (!_o.title)
			_o.title = 'PGX webapp';
		if(_o.cache == undefined)
			_o.cache = true;
			//_o.cache = false;
		//if a type is given this indicates taht the
		if (_o.type == "construction")
			_o.construction = true;
		else if (_o.type == 'notfound') {
			_o.notfound = true;
		}
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
			//Retrieve the admin email content
			this.dbFunctions.getAdminEmail(constants.dbConstants.DB.ADMIN_COLLECTION,{},options).then(function(result){
				//is this user the admin?
				_o.admin = result === _o.user;

				res.render(template,_o);	
			});
			
		} else {
			//the user is not Authenticated, render the page without any nav links or access to additional content.
			res.render(template,_o);
		}
	},
	/* Sort two lists based on the first list, return an object containing the first
	 * and the seocnd sorted lists */
	sortWithIndeces:function(toSort, toSort2, toSort3) {
	  var output = [];
	  var output2;
	  for (var i = 0; i < toSort.length; i++) {
	    toSort[i] = [toSort[i], i];
	  }
	  toSort.sort(function(left, right) {
	    return left[0] < right[0] ? -1 : 1;
	  });
	  var sortIndices = [];
	  for (var j = 0; j < toSort.length; j++) {
	    sortIndices.push(toSort[j][1]);
	    toSort[j] = toSort[j][0];
	  }	  
	  for (var i = 0; i < toSort.length; i++ ){
	  	output[i] = toSort2[sortIndices[i]];
	  }
	  if (toSort3){
	  	output2 = [];
	  	for (var i = 0; i < toSort.length; i++ )
	  		output2[i] = toSort3[sortIndices[i]];
	  }
	  return {first:toSort,second:output,third:output2};
	},
	dbFunctions : null,
	mkdirAsync:function(file,logger){
		fs.statAsync(file)
		.catch(function(e){
			//no directories present
			logger('info','Adding prequisite directory',{target:file,action:'mkdir'});
			return fs.mkdirAsync(file);
		})
		.catch(function(e){
			logger('error',e,{target:file,action:'mkdir'})
			process.exit(1)
		});

	}
};