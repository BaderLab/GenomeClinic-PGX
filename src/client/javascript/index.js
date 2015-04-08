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
	phasing = require('./phase-page'),
	markers =  require('./markers-page');




(function(){
	var location = window.location.pathname;
	Promise.resolve().then(function(){
		if (location == '/'){
			return templates.index({title:'PGX Webapp'}).then(function(renderedHtml){
				$('#main').html(renderedHtml);
			});
		} else if (['/login','/setpassword','/recover','/signup'].indexOf(location) != -1){
			return authentication(location);
		} else if (location == '/upload'){
			return uploader();
		} else if (location.match(/^\/projects+/)!== null){
			return projects();
		} else if (location.match(/^\/browsepatients+/)!== null){
			return patients();
		} else if (location == '/config'){
			return config();
		} else if (location == '/statuspage'){
			return status();
		} else if (location == '/markers'){
			return markers();
		} else if (location.search(/\/haplotypes/) !== -1){
			return phasing();
		}
	}).then(function(){
		utility.refresh();
	});
})();