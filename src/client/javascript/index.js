/* Main function that is called each time a new page is loaded. 
 * this function delegates what
 * additional page specific functions are then called 
 * 
 * @author Patrick Magee
 */
var $ = require('jquery');
var templates = require('./templates');
var projects = require('./projects'),
	status = require('./status-page'),
	uploader = require('./uploader'),
	utility = require('./utility'),
	config = require('./config'),
	authentication = require('./authentication'),
	patients = require('./patients'),
	phasing = require('./phase-page');




(function(){
	var location = window.location.pathname;
	console.log(location);
	Promise.resolve().then(function(){
		if (location == '/'){
			return templates.index({title:'PGX Webapp'}).then(function(renderedHtml){
				$('#main').html(renderedHtml);
			});
		} else if (['/login','/setpassword','/recover','/signup'].indexOf(location) != -1){
			return authentication(location);
		} else if (location == '/upload'){
			return uploader();
		} else if (location == '/projects'){
			return projects();
		} else if (location == '/browsepatients'){
			return patients();
		} else if (location == '/config'){
			return config();
		} else if (location == '/panel'){
			return templates.construction().then(function(renderedHtml){
				$('#main').html(renderedHtml);
			});
		} else if (location == '/statuspage'){
			return status();
		} else if (location.search(/\/haplotypes/) !== -1){
			return phasing();
		}
	}).then(function(){
		utility.refresh();
	});
})();