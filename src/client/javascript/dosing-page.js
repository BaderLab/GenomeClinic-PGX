var $ = require("jquery"),
	templates = require('./templates'),
	utility = require('./utility');

module.exports = function(){
	var abideOptions = {
		abide: {
			validators:{
				requiredIf:function(el,required,parent){
					var from = document.getElementById(el.getAttribute(this.add_namespace('data-requiredIf'))).value
					var val = el.value;
					if (from === "None") from = "";
					if (val === "None") val = "";
					if (from !== "" && val === ""){
						return false;
					} else {
						return true;
					}
				}
			}
		}
	}
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
			//Show or hide all drug tabs
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
			//when the arrow is clicked the drug tab is mimized. If there are a large number
			//Of interactions then there is no animation it is simply hidden
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
			//when the arrow is clicked the drug tab is expanded. If there are a large number
			//Of interactions then there is no animation it is simply hidden
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

			//Trigger the new interaction field to come out
			$('#new-interaction').on('click',function(e){
				e.preventDefault();
				$(this).hide().siblings('#new-interaction-triggers').show();
				$('#new-interaction-form').slideDown();
			});

			//submit the new interaction field
			$('#new-interaction-trigger-submit').on('click',function(e){
				e.preventDefault();
				$('#new-interaction-form').submit();//submit').trigger('click');
			});


			//cancel the new interaction form reseting and hiding it
			$('#new-interaction-cancel-trigger').on('click',function(e){
				e.preventDefault();
				$(this).closest("#new-interaction-triggers").hide().siblings('#new-interaction').show();
				document.getElementById('new-interaction-form').reset();//.trigger('click');
				$('#new-interaction-form').slideUp();
			});

			/* When the form is considered valid, trigger this event handler
			 * submitting the serialized data to the server for entry. The
			 * server will additionally check to see if there are any identical
			 * entires already in existence. If there are, it will return false
			 * and data will not be entered but inform the user an entry similar
			 * to that already exists */
			$('#new-interaction-form').on('valid.fndtn.abide', function () {
				var fields = $(this).serializeArray();
				console.log(fields);
				var doc = {};
				doc.pgx_1 = window.location.pathname.split('/').splice(-1)[0];
				for ( var i = 0; i< fields.length; i++ ){
					if (fields[i].value !== "" && fields[i].value !== "None")
						doc[fields[i].name] = fields[i].value;
				}
				Promise.resolve($.ajax({
					url:window.location.pathname + '/new-interaction',
					type:"POST",
			 		contentType:"application/json",
			 		datatype:"json",
					data:JSON.stringify(doc)
				})).then(function(result){
					console.log(result);
				}).catch(function(err){
					console.log(err);
				});
  			});
  		}
	};

	/* Render The appropriate html depending on what the url is. Additionally
	 * get the content and add all event listeners */
	var main = function(){
		var promise;
		var location = window.location.pathname;
		//Shows all dosing
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
				utility.refresh();
			}).then(function(){
				staticHanlders.index();
			});
		//Shows a currently existing dosing table
		} else if (location.search(/^\/dosing\/current\/.*/) !== -1 ){	
			var gene = location.split('/').splice(-1)[0];
			//this can occasionally take some time to render,
			//therefore add a spinner to the page while its rendering to give
			//the user something to look at
			promise = templates.spinner().then(function(renderedHtml){
				$('#main').html(renderedHtml);
			}).then(function(){
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
				//set the values of the select tags to the value contained in the 
				//original value data element
				var selects = $('select');
				var val;
				for (var i = 0; i < selects.length; i++ ){
					val = $(selects[i]).data('originalvalue');
					$(selects[i]).val(val);
				}
				return utility.refresh(abideOptions);
			}).then(function(){
				return staticHanlders.current();
			}).then(function(){
				

			});
		}

		return promise
	};
	return main();	
};