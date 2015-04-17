var $ = require("jquery"),
	templates = require('./templates'),
	utility = require('./utility');

module.exports = function(){
	var staticHanlders = {
		index:function(){
			$('#search-box').on('keyup',function(){
				var currentRows = $('.dose-row');
				for (var i=0; i < currentRows.length; i++ ){
					if (!utility.matchSearch($(currentRows[i]).data('name')))
						$(currentRows[i]).hide();
					else 
						$(currentRows[i]).show();
				}
			});
		}
	}


	var main = function(){
		var promise;
		var location = window.location.pathname;
		if(location === '/dosing'){
			promise = Promise.resolve($.ajax({
				url:'/database/dosing/genes',
				type:'GET',
				contentyType:'application/json',
				dataType:'json'
			})).then(function(result){
				return templates.drugs.index({genes:result});
			}).then(function(renderedHtml){
				return $('#main').html(renderedHtml);
			}).then(function(){
				staticHanlders.index();
			});
		}

		return promise;
	};
	return main();	
};