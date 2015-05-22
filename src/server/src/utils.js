var dbFunctions = require('../models/mongodb_functions'),
	constants = require('../lib/conf/constants.json'),
	_ = require('underscore');
/* utility functions available for all routes
 * @author Patrick Magee */
module.exports = {
	isLoggedIn:function(req,res,next){
		if (req.isAuthenticated())
			return next();
		res.redirect('/login');
	},
	render:function(req,res,type,_o,scripts){
		var template;
		template = 'layout.hbs';
		if (!scripts)
			scripts = [];
		if (!_o){
			_o = {};
		}

		_o.title = 'PGX webapp';
		_o.cache = true;

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
	},
	createNestedObject : function(objString, refObj, doc, del){
		var split = objString.split('.');
		var cont = true;
		var newDoc = {};
		var point = newDoc;
		var depthString = [];
		var isNew = false;
		var action;
		var origRefObj = refObj;
		for (var i = 0; i < split.length; i++ ){
			if (refObj.hasOwnProperty(split[i]) && cont){
				refObj = refObj[split[i]];
				depthString.push(split[i]);
			} else {
				cont = false;
				point[split[i]] = {};
				point = point[split[i]];
			}
		}
		if (refObj.hasOwnProperty('secondary')){
			point.secondary = refObj.secondary;
		}

		if (!del) {
			point.rec = doc.rec;
			point.risk = doc.risk;
			point.pubmed = doc.pubmed;
			var headKey = Object.keys(newDoc);
			if (headKey.length == 1){
				depthString.push(headKey[0]);
				newDoc = newDoc[headKey[0]];
				isNew = true;
			}
			return {cont:newDoc,depth:depthString.join('.'),isNew:isNew,action:action};
		} else {
			var o = this.editEndNode(origRefObj,depthString.join('.'))
			this.removeEmpty(o);
			return o;
		}
		
	},
	editEndNode : function(refObj,string){
		if (string === ''){
			if (refObj.hasOwnProperty('secondary')){
				var secondary =  refObj.secondary
				refObj = {};
				refObj.secondary = secondary;
				return refObj;
			} else {
				return {};
			}
		} else {
			string = string.split('.');
			var first = string[0];
			string.shift();	
			refObj[first] = this.editEndNode(refObj[first],string.join('.'))
			return refObj;
		}
	},
	removeEmpty : function(object) {
		var _this = this;
	    if (!_.isObject(object)) {
	        return;
	    }
	    _.keys(object).forEach(function(key) {
	        var localObj = object[key];
	        
	        if (_.isObject(localObj)) {
	            
	            if (_.isEmpty(localObj)) {
	                
	                delete object[key];
	                return;
	            }
	 
	            // Is object, recursive call
	            _this.removeEmpty(localObj);
	                           
	            if (_.isEmpty(localObj)) {
	 
	                delete object[key];
	                return;
	            }
	        }
	    })
	},

};