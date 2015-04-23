var $ = require("jquery"),
	templates = require('./templates'),
	utility = require('./utility');

module.exports = function(){
	var abideOptions = {
		abide: {
			validators:{
				requiredIf:function(el,required,parent){
					var from = document.getElementById(el.getAttribute(this.add_namespace('data-requiredIf'))).value;
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
	};

	var setSelects = function(el){
		var context;
		if (el){
			context = $(el);
		} else {
			context = $(document);
		}
		var selects = context.find('select');
		var val;
		for (var i = 0; i < selects.length; i++ ){
			val = $(selects[i]).data('originalvalue');
			$(selects[i]).val(val);
		}

	};

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
		current:function(el){
			var _this = this;
			var context;
			if ( !el ){
				context = $(document);
				//who page handlers
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
					var drug;
					var doc = {};
					doc.pgx_1 = window.location.pathname.split('/').splice(-1)[0];
					for ( var i = 0; i< fields.length; i++ ){
						if (fields[i].value !== "" && fields[i].value !== "None")
							doc[fields[i].name] = fields[i].value;
					}
					doc.drug = doc.drug.toLowerCase();
					if (doc.pgx_1) doc.pgx_1 = doc.pgx_1.toLowerCase();
					if (doc.pgx_2) doc.pgx_2 = doc.pgx_2.toLowerCase();
					var unitialized = $('#main_content').data('unitialized') === true ? 'true':'false';
					Promise.resolve($.ajax({
						url:window.location.pathname + '/new-interaction?unitialized='+unitialized,
						type:"POST",
				 		contentType:"application/json",
				 		dataType:"json",
						data:JSON.stringify(doc)
					})).then(function(result){
						var promise;
						if (result.statusCode == 200){
							$('#main_content').data('unitialized','false');
							var currentDrugCont = $('.drug-cont');
							var currentDrugs=[];
							var drug = result.drug;
							result.num = $('#main_content').find('form').length;
							for (var i=0; i<currentDrugCont.length; i++ ){
								currentDrugs.push($(currentDrugCont[i]).data('drug'));
							}
							if (currentDrugs.indexOf(drug) !== -1 ){
								delete result.drug
								promise = templates.drugs.new(result).then(function(renderedHtml){
									$('.drug-cont[data-drug=' + drug).append(renderedHtml);
								}).then(function(){
									var context = $('.drug-cont[data-drug='+ drug + ']').find('form[data-id=' +result._id+']');
									context.foundation(abideOptions);
									_this.current(context);
									setSelects(context);
								})
							} else {
								promise = templates.drugs.new(result).then(function(renderedHtml){
									return $('#main_content').append(renderedHtml);
								}).then(function(){
									$('.drug-cont[data-drug=' + drug+ ']').foundation(abideOptions);
									_this.current('.drug-cont[data-drug=' + drug+ ']');
									setSelects('.drug-cont[data-drug=' + drug+ ']');
								});
							}
							
							return promise.then(function(){
								$('#error-display-message').text(result.message).closest('#error-display-box').slideDown();
							});
						} else {
							$('#error-display-message').text(result.message).closest('#error-display-box').slideDown();
						}
					}).then(function(){
						$('#new-interaction-cancel-trigger').trigger('click');					
					}).catch(function(err){
						$('#error-display-message').text(err.toString()).closest('#error-display-box').slideDown();
					});
				});

			} else {
				context = $(el);
			}

			context.find('.close-box').on('click',function(e){
					e.preventDefault();
					$(this).closest('.alert-box').slideUp();
				});
			//when the arrow is clicked the drug tab is mimized. If there are a large number
			//Of interactions then there is no animation it is simply hidden
			context.find('.minimize').on('click',function(e){
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
			context.find('.expand').on('click',function(e){
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

			context.find(".edit-table").on('click',function(e){
				e.preventDefault();
				$(this).hide();
				$(this).closest('form').find('input,select,textarea').prop('disabled',false);
				$(this).closest('form').find('.form-triggers').show();
			});

			context.find(".submit-changes").closest('form').on('valid.fndtn.abide',function(e){
				e.preventDefault();
				var _this = $(this);
				var fields = $(this).serializeArray();
				var doc = {};
				var gene = window.location.pathname.split('/').splice(-1)[0];
				var id = $(this).data('id');
				doc.drug = $(this).closest('.drug-cont').data('drug');
				for ( var i = 0; i< fields.length; i++ ){
					if (fields[i].value !== "" && fields[i].value !== "None")
						doc[fields[i].name] = fields[i].value;
				}
				if (doc.pgx_1) doc.pgx_1 = doc.pgx_1.toLowerCase();
				if (doc.pgx_2) doc.pgx_2 = doc.pgx_2.toLowerCase();
				Promise.resolve($.ajax({
					url:"/database/dosing/genes/" + gene + "/update/" + id,
					type:"POST",
					contentType:'application/json',
					dataType:'json',
					data:JSON.stringify(doc)
				})).then(function(result){
					if (result.statusCode == 200){
						for ( var i = 0; i< fields.length; i++ ){
							$(_this).find('[name=' + fields[i].name + ']').data('originalvalue',fields[i].value)
						}
						$(_this).find('input,select,textarea').prop('disabled',true);
						$(_this).find('.form-triggers').hide();
						$(_this).find('.edit-table').show();
					} else {
						$(_this).find('.alert-box').find('p').text(result.message).closest('.alert-box').slideDown();
					}
				});

			});

			context.find('.cancel-changes').on('click',function(e){
				var newVal;
				e.preventDefault();
				$(this).closest('form').find('input,select,textarea').prop('disabled',true);
				var inputFields = $(this).closest('form').find('input,textarea,select');
				for (var i=0; i < inputFields.length; i++ ){
					newVal = $(inputFields[i]).data('originalvalue');
					$(inputFields[i]).val(newVal);
				}
				$(this).closest('.form-triggers').hide().closest('form').find('.edit-table').show();
			});

			context.find(".delete-table").on('click',function(e){
				e.preventDefault();
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
				return templates.drugs.current(result);
			}).then(function(renderedHtml){
				return $('#main').html(renderedHtml);
			}).then(function(){
				//set the values of the select tags to the value contained in the 
				//original value data element
				setSelects();
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