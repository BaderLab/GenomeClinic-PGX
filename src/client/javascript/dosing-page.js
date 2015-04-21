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
			var originalCollapseButtonColor = "rgb(0, 123, 164)";
			var expand= function(element) {
				$(element).data("expanded", true);
				$(element).css("color", "#FFAD99");
				$(element).css("transform", "rotate(45deg)");
				$(element).closest('.drug-cont').find('.interactions').slideToggle();
			};

			var collapse= function(element) {
				$(element).data("expanded", false);
				$(element).css("color", originalCollapseButtonColor);
				$(element).css("transform", "rotate(0deg)");
				$(element).closest('.drug-cont').find('.interactions').slideToggle();
			};

			$('.drug-expand').on('click',function(e){
				e.preventDefault();
				if ($(this).data('expanded')){
					collapse(this);
				} else {
					expand(this);
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
			var gene = location.split('/').splice(-1)[0]
			promise = Promise.resolve($.ajax({
				url:"/database/dosing/genes/" + gene,
				type:'GET',
				contentyType:'application/json',
				dataType:'json'
			})).then(function(result){
				//Arrange the output by drug.
				var drugOutput = {};
				var drug;
				for ( var i=0; i<result.length; i++ ){
					drug = result[i].drug
					if (!drugOutput.hasOwnProperty(drug)){
						drugOutput[drug] = [];
					}
					drugOutput[drug].push(result[i]);
				}
				return drugOutput;
			}).then(function(result){
				console.log(result);
				var o = {};
				o.drugs = result;
				o.gene = gene.toUpperCase()	;
				return templates.drugs.current(o);
			}).then(function(renderedHtml){
				return $('#main').html(renderedHtml);
			}).then(function(){
				staticHanlders.current();
			});	
		}

		return promise;
	};
	return main();	
};