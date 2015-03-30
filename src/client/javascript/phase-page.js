var $  = require('jquery'),
	templates = require('./templates'),
	utility = require('./utility');

module.exports = function(){

	//var refreshHanlders = function(){
	//	$('')

//	}

/*	var staticHandlers = function(){
		
		$('#add-new-haplotype').on('click',function(e){
			e.preventDefault();
			return templates.haplotypes.haplotype()
			.then(function(renderedHtml){
				console.log(renderedHtml);
				return $('#haplotypes').append(renderedHtml);
			});
		});
	};
*/
	var main = function(){
		return templates.haplotypes.index()
		.then(function(renderedHtml){
			return $('#main').html(renderedHtml);
		})//.then(function(){
			//return templates.haplotypes.haplotype()
			
		//}).then(function(renderedHtml){
		//	return $('#haplotypes').html(renderedHtml);
		//}).then(function(){
	//		staticHandlers();
	//	});
	}
	return main();
}