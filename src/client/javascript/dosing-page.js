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

			$('.dose-row').on('click',function(e){
				e.preventDefault();
				var location = '/dosing/current/' + $(this).data('name');
				window.location.replace(location);
			});
		},
		current:function(){
			$('#search-box').on('keyup',function(){
				var values = $('.drug-cont');
				for (var i =0; i<values.length; i++){
					if (utility.matchSearch($(values[i]).data('drug'))){
						$(values[i]).show();
					} else {
						$(values[i]).hide();
					}
				}
			});

			$('#toggle-all').on('click',function(e){
				e.preventDefault();
				if ($(this).data('state') == 'less'){
					$('.minimize').trigger('click');
					$(this).text('Show more').data('state','more');
				} else {
					$('.expand').trigger('click');
					$(this).text('Show less').data('state','less');
				}
			});
			$('.minimize').on('click',function(e){
				e.preventDefault();
				var _this = this;
				if ($(this).closest('.drug-cont').find('fieldset').length > 5){
					$(this).closest('.drug-cont').find('.interactions').hide().closest('.drug-cont').find(this).hide().siblings('.expand').show();	
				} else {
					$(this).closest('.drug-cont').find('.interactions').slideUp('slow',function(){
						$(_this).hide().siblings('.expand').show();
					});
				}
			});

			$('.expand').on('click',function(e){
				e.preventDefault();
				var _this = this;
				if ($(this).closest('.drug-cont').find('fieldset').length > 5){
					$(this).closest('.drug-cont').find('.interactions').show().closest('.drug-cont').find(this).hide().siblings('.minimize').show();	
				} else {
					$(this).closest('.drug-cont').find('.interactions').slideDown('slow',function(){
						$(_this).hide().siblings('.minimize').show();
					});
				}
			});
		}
	};


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
		} else if (location.search(/^\/dosing\/current\/.*/) !== -1 ){	
			var gene = location.split('/').splice(-1)[0];
			templates.spinner().then(function(renderedHtml){
				$('#main').html(renderedHtml);
			}).then(function(){
				//This templating occasionally can take a long time, therefore it is being done
				//on the server to hopefully speed up the process
				return Promise.resolve($.ajax({
				url:"/dosing/current/"+ gene + "/content",
				type:'GET',
				dataType:'json'}));
			}).then(function(result){
				console.log(result);
				return templates.drugs.current(result);
			}).then(function(renderedHtml){
				return $('#main').html(renderedHtml);
			}).then(function(){
				var selects = $('select');
				var val;
				for (var i = 0; i < selects.length; i++ ){
					val = $(selects[i]).data('originalvalue');
					$(selects[i]).val(val);
				}
				staticHanlders.current();
			});	
		}

		return promise;
	};
	return main();	
};