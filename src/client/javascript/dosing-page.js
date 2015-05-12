/* Functions and handlers for working with the Dosing recomendations UI
 * these functions enable the user to update, delete or add dosing
 * recomendations.
 *@author Patrick Magee */

var $ = require("jquery"),
	templates = require('./templates'),
	utility = require('./utility');

module.exports = function(){
	//add new methods to adbide validation
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

	//When A Recomendation is loaded the originalValue of the Selects need to be set. this will set them for all elements supplied
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

	var pageOptions = {
		location:undefined,
		gene:undefined,
		use:undefined
	};

	//Reveal a modal and confirm whether or not the action should be continued
	//returns a promise
	var confirmAction = function(title,message){
		var promise  = new Promise(function(resolve,reject){
			$('#confirm-delete').find('h4').text(title);
			$('#confirm-delete').find('h6').text(message);
			$('#confirm-delete').foundation('reveal','open');

			$('#confirm-delete').find('.success').on('click',function(e){
				e.preventDefault();
				$('#confirm-delete').foundation('reveal','close');
				resolve(true);
			});

			$('#confirm-delete').find('.cancel').on('click',function(e){
				e.preventDefault();
				$('#confirm-delete').foundation('reveal','close');
				resolve(false);
			});

		});
		return promise;
	};


	/* all page handlers for working with dosing tables and drug recomendations */
	var staticHanlders = {
		/* main page hanlders, contains a list of all the genes that are that have dosing
		 * information  and the number of interactions tehre are recomendations for*/
		index:function(){
			/* Close the error display box */
			$('.close-box').on('click',function(e){
				e.preventDefault();
				$(this).closest('#error-display-box').slideUp();
			});
				
			/* whenever a key is pressed within the serach box search through the current
			 * rows for genes that match the value present in the search box. Hide those that
			 * do not match */
			$('#search-box').on('keyup',function(){
				var currentRows = $('.dose-row');
				for (var i=0; i < currentRows.length; i++ ){
					if (!utility.matchSearch($(currentRows[i]).data('name')))
						$(currentRows[i]).hide();
					else 
						$(currentRows[i]).show();
				}
			});
			//when you click on a dose row, navigate to the current dosing information 
			$('.dose-row').on('click',function(e){
				e.preventDefault();
				var location = '/dosing/current/' + $(this).data('name');
				window.location.replace(location);
			});


			/* Handler to show the form to add a new gene */
			$('#add-new-gene').on('click',function(e){
				e.preventDefault();
				$(this).hide().siblings('#submit-new-gene').show()
				$("#submit-new-gene-form").show();
			});

			/* Once the Gene form has been validated send the form information
			 * to the server to be added to the databse. Upon a succesful entry
			 * navigate to the new gene's drug recomendation page */
			$('#submit-new-gene-form').on('valid.fndtn.abide',function(e){
				var val = $('#new-gene-name').val();
				Promise.resolve($.ajax({
					url:'/dosing/new/' + val,
					type:"POST",
					contentType:'application/json',
					dataType:'json'
				})).then(function(result){
					if (result.statusCode == 200){
						window.location.replace('/dosing/current/' + val);
					} else {
						$('#error-display-message').text(result.message);
						$('#error-display-box').slideDown();
					}
				});
			});

			$("#submit-new-gene").on('click',function(e){
				e.preventDefault();
				$('#submit-new-gene-form').submit();
			});
		},
		/* Handlers for currently existsing dose tables. This function contains both the handlers
		 * for each dosing form, as well as the entire page. You can define the elemetts of the page
		 * to apply to function to byh passing in el as the only argument */
		current: {
			page: function(){
				_this = this;
				if ( $('#future-recomendations').find('tbody').find('tr').length > 0 ){
					$('#future-recomendations').show();
				}

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
					var tables = $('.drug-cont-header');
					var state = $(this).data('state')
					for (var i=0; i<tables.length; i++ ){
						if (state == 'less' && $(tables[i]).data('state') == 'open')
							$(tables[i]).trigger('click');
						else if (state == 'more' && $(tables[i]).data('state') == 'closed')
							$(tables[i]).trigger('click');
					}	
					if (state == 'less') $(this).text('Show more').data('state','more');
					else $(this).text('Show less').data('state','less');
				});

				//=====================================================
				//new interactions;
				//Button to set new interactions
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
				$('#new-interaction-form').on('valid.fndtn.abide', function (){
					var fields = $(this).serializeArray();
					var drug;
					var doc = {};
					doc.pgx_1 = pageOptions.gene
					var hap_1 = {};
					var hap_2 = {};
					for ( var i = 0; i< fields.length; i++ ){
						if (fields[i].value !== "" && fields[i].value !== "None")
							if (fields[i].name.search('hap_1-')!== -1 ) {
								hap_1[fields[i].name.split('-')[2]] = fields[i].value
							} else if (fields[i].name.search('hap_2-')!== -1 ) {
								hap_2[fields[i].name.split('-')[2]] = fields[i].value
							} else {
								doc[fields[i].name] = fields[i].value;
							}
					}
					//For now Allow a single haplotype to be attributed with a single drug recomendation
					//Later chgange this to allow for multiple haplotypes
					
					//doc.drug = doc.drug.toLowerCase();
					if (Object.keys(hap_1).length > 0) doc.hap_1 = hap_1;
					if (Object.keys(hap_2).length > 0) doc.hap_2 = hap_2;
					if (doc.pgx_1) doc.pgx_1 = doc.pgx_1.toUpperCase();
					if (doc.pgx_2) doc.pgx_2 = doc.pgx_2.toUpperCase();
					var unitialized = $('#main_content').data('unitialized') === true ? 'true':'false';
					Promise.resolve($.ajax({
						url:pageOptions.location + '/new-interaction?unitialized='+unitialized,
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
								delete result.drug;
								promise = templates.drugs.new(result).then(function(renderedHtml){
									$('.drug-cont[data-drug=' + drug).find('.interactions').append(renderedHtml);
								}).then(function(){
									var context = $('.drug-cont[data-drug='+ drug + ']').find('form[data-id=' +result._id+']');
									context.foundation(abideOptions);
									_this.current(context);
									setSelects(context);
								});
							} else {
								promise = templates.drugs.new(result).then(function(renderedHtml){
									return $('#main_content').append(renderedHtml);
								}).then(function(){
									utility.refresh(abideOptions,$('.drug-cont[data-drug=' + drug+ ']'));
									_this.generic('.drug-cont[data-drug=' + drug+ ']');
									_this.interactions('.drug-cont[data-drug=' + drug+ ']');
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
				
				//*============================
				// New Recomendation Form

				$('#new-recomendation').on('click',function(e){
					e.preventDefault();
					$(this).hide().siblings('#new-recomendation-triggers').show();
					$('#new-recomendation-form').slideDown();
				});

				//submit the new interaction field
				$('#new-recomendation-trigger-submit').on('click',function(e){
					e.preventDefault();
					$('#new-recomendation-form').submit();//submit').trigger('click');
				});


				//cancel the new interaction form reseting and hiding it
				$('#new-recomendation-cancel-trigger').on('click',function(e){
					e.preventDefault();
					$(this).closest("#new-recomendation-triggers").hide().siblings('#new-recomendation').show();
					document.getElementById('new-recomendation-form').reset();//.trigger('click');
					$('#new-recomendation-form').slideUp();
				});


				$("#new-recomendation-form").on('valid.fndtn.abide',function(){
					var items = $(this).serializeArray();
					var o = {};
					for (var i = 0; i < items.length; i++ ){
						o[items[i].name] = items[i].value;
					}
					o.Gene = pageOptions.gene;
					Promise.resolve($.ajax({
						url:pageOptions.location + "/new-recomendation",
						type:"POST",
						contentType:'application/json',
						dataType:'json',
						data:JSON.stringify(o)
					})).then(function(result){
						if (result.statusCode == 200){
							templates.drugs.future({future:[result]}).then(function(renderedHtml){
								return $('#future-recomendations').find('tbody').append(renderedHtml);
							}).then(function(){
								_this.generic($('#future-recomendations').find('tbody').last('tr'));
								_this.future($('#future-recomendations').find('tbody').last('tr'));
								utility.refresh(abideOptions,$('#future-recomendations').find('tbody').last('tr'));
								$('#future-recomendations').show();
								$('#error-display-message-2').text(result.message).closest('#error-display-box-2').slideDown()
								$('#new-recomendation-cancel-trigger').trigger('click');
							});
						} else {
							$('#error-display-message-2').text(result.message).closest('#error-display-box-2').slideDown();
						}
					}).catch(function(err){
						$('#error-display-message-2').text(err.message).closest('#error-display-box-2').slideDown();
					});
				});	




				/* Delete all the interactions related to the Primary Gene. Submits a POST request to the database
				 * after the deletion is confirmed by revealing a modal */

				$('#delete-all').on('click',function(e){
					e.preventDefault();
					confirmAction("Are you sure you want to delete all dosing recomendations for " + pageOptions.gene,"This will permanately delete all entries and they will no longer be available for report generation")
					.then(function(result){
						if (result){
							Promise.resolve($.ajax({
								url:'/database/dosing/genes/' + pageOptions.gene + '/deleteall', 
								type:'POST',
								contentType:'application/json',
								dataType:'json'
							})).then(function(result){
								if (result.statusCode == 200){
									window.location.replace('/dosing');
								} else {
									$('#error-display-message').text(result.message).closest('#error-display-box').slideDown();
								}
							}).catch(function(err){
								$('#error-display-message').text(err.message).closest('#error-display-box').slideDown();
							});
						}
					});
				});

			},
			generic:function(el){
				_this = this;
				var context;
				if (!el) context = $(document);
				else context = $(el);

				context.find('.close-box').on('click',function(e){
						e.preventDefault();
						$(this).closest('.alert-box').slideUp();
				});

				// Make a dose table editable
				context.find(".edit-table").on('click',function(e){
					e.preventDefault();
					$(this).hide();
					$(this).closest('form').find('input,select,textarea').prop('disabled',false);
					$(this).closest('form').find('.form-triggers').show();
				});

				//cancel the chagens, restoring the original values to each field
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

			},
			future : function(el){
				_this = this;
				var context;
				if (!el) context = $('#future-recomendations');
				else context = $(el);

				context.find("form").on("valid.fndtn.abide",function(){
					var _this =this;
					var o = {};
					o.Therapeutic_Class = $(this).find('input[name=Therapeutic_Class]').val();
					o.gene = pageOptions.gene
					o.rec = $(this).find('textarea[name=rec]').val();
					var id = $(this).data('id');

					Promise.resolve($.ajax({
						url:"/database/dosing/genes/" + pageOptions.gene + "/update/" + id + '?type=recomendation',
						type:"POST",
						contentType:"application/json",
						dataType:'json',
						data:JSON.stringify(o)
					})).then(function(result){
						if (result.statusCode == 200 ){
							$(_this).find('textarea[name=rec]').data('originalvalue',o.rec);
							$(_this).find('input[name=Therapeutic_Class]').data('originalvalue',o.Therapeutic_Class);
							$(_this).find('input,select,textarea').prop('disabled',true);
							$(_this).find('.form-triggers').hide();
							$(_this).find('.edit-table').show();
							$(_this).find('.alert-message').text(result.message).closest('.alert-box').slideDown();
						} else {
							$(_this).find('.alert-message').text(result.message).closest('.alert-box').slideDown();

						}
					}).catch(function(err){
						$(_this).find('.alert-message').text(err.message).closest('.alert-box').slideDown();
					});
				});
				
				context.find(".delete-table").on('click',function(e){
					e.preventDefault();
					var id  = $(this).closest('form').data('id');
					var row = $(this).closest('tr');
					confirmAction("Are you sure you want to delete the selected recomendation table?","Once deleted it will no longer show up on any subsequent reports")
					.then(function(result){
						if (result){
							Promise.resolve($.ajax({
								url:"/database/dosing/genes/" + pageOptions.gene + "/deleteid/" + id  + '?type=recomendation',
								type:"POST",
								dataType:'json'
							})).then(function(result){
								if (result.statusCode == 200 ){
									row.remove();
									if ($('#future-recomendations').find('tbody').find('tr').length === 0){
										$('#future-recomendations').hide();
									}
									$('#error-display-message-2').text(result.message).closest('#error-display-box-2').slideDown()

								} else {
									$('#error-display-message-2').text(result.message).closest('#error-display-box-2').slideDown()
								}
							}).catch(function(err){
								$('#error-display-message-2').text(err.message).closest('#error-display-box-2').slideDown()
							});
						}
					});
				});

			},
			interactions : function(el){
				_this = this;
				var context;
				if (!el) context = $('#main_content');
				else context = $(el);

				if (!context.is('tr')){
					context.find('.drug-cont-header').on('click',function(){
						var state = $(this).data('state');
						if (state === "open"){
							$(this).closest('.drug-cont').find('.interactions').hide().closest('.drug-cont').find('.minimize').hide().siblings('.expand').show()
							$(this).data('state','closed');
						} else {
							$(this).closest('.drug-cont').find('.interactions').show().closest('.drug-cont').find('.expand').hide().siblings('.minimize').show()
							$(this).data('state','open');
						}
					});
				}
		
				// Submit the chagnes to the current dose table to the server
				context.find('form').on('valid.fndtn.abide',function(e){
					e.preventDefault();
					var _this = $(this);
					var fields = $(this).serializeArray();
					var doc = {};
					var gene = window.location.pathname.split('/').splice(-1)[0];
					var id = $(this).data('id');
					doc.drug = $(this).closest('.drug-cont').data('drug');
					var hap_1 = {};
					var hap_2 = {};
					var name;
					for ( var i = 0; i< fields.length; i++ ){
						if (fields[i].value !== "" && fields[i].value !== "None")
							if (fields[i].name.search('hap_1-') !== -1){
								hap_1[fields[i].name.split('-')[2]] = fields[i].value;
							} else if (fields[i].name.search('hap_2-') !== -1){
								hap_2[fields[i].name.split('-')[2]] = fields[i].value;
							} else {
								doc[fields[i].name] = fields[i].value;
							}
					}
					if (Object.keys(hap_1).length > 0) doc.hap_1 = hap_1;
					if (Object.keys(hap_2).length > 0) doc.hap_2 = hap_2;
					if (doc.pgx_1) doc.pgx_1 = doc.pgx_1.toUpperCase();
					if (doc.pgx_2) doc.pgx_2 = doc.pgx_2.toUpperCase();
					Promise.resolve($.ajax({
						url:"/database/dosing/genes/" + gene + "/update/" + id + '?type=interaction',
						type:"POST",
						contentType:'application/json',
						dataType:'json',
						data:JSON.stringify(doc)
					})).then(function(result){
						if (result.statusCode == 200){
							for ( var i = 0; i< fields.length; i++ ){
								$(_this).find('[name=' + fields[i].name + ']').data('originalvalue',fields[i].value);
							}
							$(_this).find('input,select,textarea').prop('disabled',true);
							$(_this).find('.form-triggers').hide();
							$(_this).find('.edit-table').show();
						} else {
							$(_this).find('.alert-box').find('p').text(result.message).closest('.alert-box').slideDown();
						}
					});

				});
				
				

				//delet the specified dose table after confirming its removal
				context.find(".delete-table").on('click',function(e){
					e.preventDefault();
					var form = $(this).closest('form');
					var id = form.data('id');
					var gene = window.location.pathname.split('/').splice(-1)[0];
					confirmAction("Are you sure you want to delete the selected dosing table?","Once deleted it will no longer show up on any subsequent reports")
					.then(function(result){
						if (result){
							Promise.resolve($.ajax({
								url:"/database/dosing/genes/" + gene + "/deleteid/" + id + '?type=interaction',
								type:"POST",
								contentType:"application/json",
								dataType:'json'
							})).then(function(result){
								if (result.statusCode == 200){	
									$('#error-display-message').text(result.message).closest('#error-display-box').slideDown();
									form.slideUp('slow',function(){
										var remainingFormCount = form.closest('.drug-cont').find('form').length;
										if ( remainingFormCount == 1 )
											form.closest('.drug-cont').remove();
										else
											form.remove();
									});
								} else {
									$('#error-display-message').text(result.message).closest('#error-display-box').slideDown();
								}
							}).catch(function(err){
								$('#error-display-message').text(err.message).closest('#error-display-box').slideDown();
							});
						}
					});
				});
			}
		}
	}
		

	/* Render The appropriate html depending on what the url is. Additionally
	 * get the content and add all event listeners */
	var main = function(){
		var promise;
		pageOptions.location = window.location.pathname;
		
		//Shows all dosing
		if(pageOptions.location === '/dosing'){

			pageOptions.use = "index";
			promise = Promise.resolve($.ajax({
				url:'/database/dosing/genes',
				type:'GET',
				contentType:'application/json',
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
		} else if (pageOptions.location.search(/^\/dosing\/current\/.*/) !== -1 ){	
			pageOptions.gene = pageOptions.location.split('/').splice(-1)[0];
			pageOptions.use ="currentGene"
			var resultObj;
			//this can occasionally take some time to render,
			//therefore add a spinner to the page while its rendering to give
			//the user something to look at
			promise = templates.spinner().then(function(renderedHtml){
				$('#main').html(renderedHtml);
			}).then(function(){
				return Promise.resolve($.ajax({
				url:"/dosing/current/"+ pageOptions.gene + "/content",
				type:'GET',
				dataType:'json'}));
			}).then(function(result){
				resultObj = result
				return templates.drugs.current(result);
			}).then(function(renderedHtml){
				return $('#main').html(renderedHtml);
			}).then(function(){
				return templates.drugs.future(resultObj);
			}).then(function(renderedHtml){
				return $('#future-recomendations').find('tbody').append(renderedHtml);
			}).then(function(){
				//set the values of the select tags to the value contained in the 
				//original value data element
				setSelects();
				return utility.refresh(abideOptions);
			}).then(function(){
				staticHanlders.current.page();
				staticHanlders.current.interactions();
				staticHanlders.current.future();
				staticHanlders.current.generic();

			}).then(function(){
				$('#toggle-all').trigger('click');
			});
		}

		return promise;
	};
	return main();	
};