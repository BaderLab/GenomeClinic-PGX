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

	/* global container to hold various page options */
	var pageOptions = {
		location:undefined,
		gene:undefined,
		use:undefined
	};

	/* Serialzie a field and return the document that results. This is for new fields only and not updated fields.
	 * The type can be one of Interaction, future, or haplotype, corresponding to the three types of information on
	 * the page. 
	 */
	var serializeNewField = function(context,type){
		var doc = {};
		var fields = $(context).serializeArray();
		doc.pgx_1 = pageOptions.gene;
		//Remove empty fields
		for (var i = 0; i < fields.length; i++ ){
			if (fields[i].value !== "" && fields[i] != "None" ){
				doc[fields[i].name] = fields[i].value;
			}
		}
		if ( type == 'interaction' ){
			var linksArr = $(context).find('.pubmed-link');
			var links = [];
			for (var i = 0; i < linksArr.length; i++ ){
				if (!$(linksArr[i]).hasClass('temp-remove')){
					links.push($(linksArr[i]).data('link'));
				}
			}
			doc.pubmed = links;
		} else if ( type == 'future' ){
			doc.future = {};
			doc.future[doc.Therapeutic_Class] = {
				rec:doc.rec
			};

		} else if ( type == 'haplotype' ){
			doc.haplotypes = {}
			doc.haplotypes[doc.Therapeutic_Class] = [doc.allele_1,doc.allele_2];
			doc.class = doc.Therapeutic_Class;
		}
		return doc;
	}
	/* Serialize an existing field and return the mutable fields.
	 */
	var serializeField = function(context,type){
		var doc = {};
		var fields = $(context).serializeArray();
		for (var i = 0; i < fields.length; i++ ){
			if (fields[i].value !== "" && fields[i] != "None"){
				doc[fields[i].name] = fields[i].value;
			}
		}
		//Add additional fields.
		if (type == 'interaction'){
			//additionally add the pubmedID's
			var linksArr = $(context).find('.pubmed-link');
			var links = [];
			for (var i = 0; i < linksArr.length; i++ ){
				if (!$(linksArr[i]).closest('span').hasClass('temp-hide')){
					links.push($(linksArr[i]).data('link'));
				}
			}
			doc.pubmed = links;
		} else if ( type == 'haplotype' ){
			doc.haplotypes = [doc.allele_1,doc.allele_2];
		}

		return doc;
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
			
			/* Handler to show the form to add a new gene */
			$('#add-new-gene').on('click',function(e){
				e.preventDefault();
				$(this).hide().siblings('ul').show()
				$("#submit-new-gene-form").show();
			});

			/* Once the Gene form has been validated send the form information
			 * to the server to be added to the databse. Upon a succesful entry
			 * navigate to the new gene's drug recomendation page */
			$('#submit-new-gene-form').on('valid.fndtn.abide',function(e){
				var val = $('#new-gene-name').val().replace('/');
				console.log(val);

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

			$('#cancel-new-gene').on('click',function(e){
				e.preventDefault();
				$('#submit-new-gene-form')[0].reset();
				$('#submit-new-gene-form').hide();
				$(this).closest('ul').hide().siblings('#add-new-gene').show();
			})
		},
		/* Handlers for currently existsing dose tables. This function contains both the handlers
		 * for each dosing form, as well as the entire page. You can define the elemetts of the page
		 * to apply to function to byh passing in el as the only argument */
		current: {
			page: function(){
				_this = this;
				// If future recomednations is not empty show it;
				if ( $('#future-recomendations').find('tbody').find('tr').length > 0 ){
					$('#future-recomendations').show();
				}

				// If haplotypes are not empty show them
				if ( $('#haplotypes').find('tbody').find('tr').length > 0 ){
					$('#haplotypes').show();
				}


				/* Scroll functions for navigating to points on the page */


				$('.scroll-to-future').on('click',function(e){
					e.preventDefault();
					$('body').animate({
        				scrollTop: $("#future-recomendations-header").offset().top},
        				'slow');
				});

				$('.scroll-to-haplo').on('click',function(e){
					e.preventDefault();
					$('body').animate({
        				scrollTop: $("#haplotypes-header").offset().top},
        				'slow');
				});

				$('.scroll-to-top').on('click',function(e){
					e.preventDefault();
					$('body').animate({
        				scrollTop: $("#recomendation-header").offset().top},
        				'slow');
				});


				/* Simple search box for searching through drug names */
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
				//Show or hide all drug tabs and set the state / text of the button
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
					$('#new-interaction-form').find('.pubmed-links').empty();
					$('#new-interaction-form').slideUp();
				});

				/* When the form is considered valid, trigger this event handler
				 * submitting the serialized data to the server for entry. The
				 * server will additionally check to see if there are any identical
				 * entires already in existence. If there are, it will return false
				 * and data will not be entered but inform the user an entry similar
				 * to that already exists */
				$('#new-interaction-form').on('valid.fndtn.abide', function (){
					var doc = serializeNewField(this,'interaction');
					Promise.resolve($.ajax({
						url:'/database/dosing/genes/' + pageOptions.gene + '/new?type=interaction',
						type:"POST",
				 		contentType:"application/json",
				 		dataType:"json",
						data:JSON.stringify(doc)
					})).then(function(result){
						if (result.statusCode == 200 ){
							var currentDrugCont = $('.drug-cont');
							var currentDrugs=[];
							var num = $('#main_content').find('form').length;
							doc.num = num;
							//GET NAMES OF CURRENT DRUGS
							for (var i=0; i < currentDrugCont.length; i++ ){
								currentDrugs.push($(currentDrugCont[i]).data('drug'));
							}
							//If this is a new drug, add a new drug table
							if (currentDrugs.indexOf(doc.drug) !== -1 ){
								promise = templates.drugs.new(doc).then(function(renderedHtml){
									$('.drug-cont[data-drug=' + doc.drug).find('.interactions').append(renderedHtml);
								}).then(function(){
									var context = $('#form-' + num.toString()).closest('tr');
									context.foundation(abideOptions);
									_this.interactions(context);
									_this.generic(context);
									setSelects(context);
								});
							//This is not a new drug, append the html to a previous table
							} else {
								doc.newDrug = true;
								promise = templates.drugs.new(doc).then(function(renderedHtml){
									return $('#main_content').append(renderedHtml);
								}).then(function(){
									var context = $('.drug-cont[data-drug=' + doc.drug+ ']')
									utility.refresh(abideOptions,context);
									_this.generic(context);
									_this.interactions(context);
									setSelects(context);
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

				//button to drop down the new interaciton
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
					document.getElementById('new-recomendation-form').reset();
					$('#new-recomendation-form').slideUp();

				});

				/* When the form is considered valid, trigger this event handler
				 * submitting the serialized data to the server for entry. The
				 * server will additionally check to see if there are any identical
				 * entires already in existence. If there are, it will return false
				 * and data will not be entered but inform the user an entry similar
				 * to that already exists */
				$("#new-recomendation-form").on('valid.fndtn.abide',function(){
					var o = serializeNewField(this,'future');
					Promise.resolve($.ajax({
						url:'/database/dosing/genes/' + pageOptions.gene + '/update?type=recomendation&newdoc=true',
						type:"POST",
						contentType:'application/json',
						dataType:'json',
						data:JSON.stringify(o)
					})).then(function(result){
						if (result.statusCode == 200){
							templates.drugs.future(o).then(function(renderedHtml){
								return $('#future-recomendations').find('tbody').append(renderedHtml);
							}).then(function(){
								var context = $('#future-recomendations').find('tbody').last('tr')
								_this.generic(context);
								_this.future(context);
								utility.refresh(abideOptions,context);
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
				
				//*=================================
				//New Haplotypes Form

				$('#new-haplotype').on('click',function(e){
					e.preventDefault();
					$(this).hide().siblings('#new-haplotype-triggers').show();
					$('#new-haplotype-form').slideDown();
				});

				//trigger the submission of the form
				$('#new-haplotype-trigger-submit').on('click',function(e){
					e.preventDefault();
					$('#new-haplotype-form').submit();
				});

				//cancel the new interaction form reseting and hiding it
				$('#new-haplotype-cancel-trigger').on('click',function(e){
					e.preventDefault();
					$(this).closest("#new-haplotype-triggers").hide().siblings('#new-haplotype').show();
					document.getElementById('new-haplotype-form').reset();//.trigger('click');
					$('#new-haplotype-form').slideUp();
				});

				/* When the form is considered valid, trigger this event handler
				 * submitting the serialized data to the server for entry. The
				 * server will additionally check to see if there are any identical
				 * entires already in existence. If there are, it will return false
				 * and data will not be entered but inform the user an entry similar
				 * to that already exists */
				$('#new-haplotype-form').on('valid.fndtn.abide',function(){
					var o = serializeNewField(this,'haplotype');
					Promise.resolve($.ajax({
						url:'/database/dosing/genes/' + pageOptions.gene + '/update?type=haplotype&newdoc=true',
						type:'POST',
						contentType:'application/json',
						dataType:'json',
						data:JSON.stringify(o)
					})).then(function(result){
						if (result.statusCode == 200 ){
							templates.drugs.haplo(o).then(function(renderedHtml){
								return $("#haplotypes").find('tbody').append(renderedHtml)
							}).then(function(){
								var context = $('#haplotypes').find('tbody').last('tr');
								_this.generic(context);
								_this.haplotypes(context);
								setSelects(context);
								utility.refresh(abideOptions,context);
							}).then(function(){
								$('#haplotypes').show();
								$('#error-display-message-3').text(result.message).closest('#error-display-box-3').slideDown();
								$('#new-haplotype-cancel-trigger').trigger('click');
							});
						} else {
							$('#error-display-message-3').text(result.message).closest('#error-display-box-3').slideDown();
						}
					});
				});

				/* Delete all the interactions related to the Primary Gene. Submits a POST request to the database
				 * after the deletion is confirmed by revealing a modal */
				$('#delete-all').on('click',function(e){
					e.preventDefault();
					var id = $(this).data('id');
					confirmAction("Are you sure you want to delete all dosing recomendations for " + pageOptions.gene,"This will permanately delete all entries and they will no longer be available for report generation")
					.then(function(result){
						if (result){
							Promise.resolve($.ajax({
								url:'/database/dosing/genes/' + pageOptions.gene + '/delete?type=all&id=' + id, 
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
			//Functions and hanlders that are used by all types of interacitons
			generic:function(el){
				_this = this;
				var context;
				/* set the context of the function, if el exists the hanlders will only be applied to
				 * a certain context and not the whole documetn. This speeds up the process */

				if (!el) context = $(document);
				else context = $(el);

				/* close an alert box */
				context.find('.close-box').on('click',function(e){
						e.preventDefault();
						$(this).closest('.alert-box').slideUp();
				});

				// Make an entry editable, revealing the submission buttons as well as enabling the text fileds
				context.find(".edit-table").on('click',function(e){
					e.preventDefault();
					$(this).hide();
					$(this).closest('form').find('input,select,textarea').prop('disabled',false);
					$(this).closest('form').find('.form-triggers,.edit').show();
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
					$(this).closest('form').find('.form-triggers,.edit').hide().closest('form').find('.edit-table,.temp-hide').show();
					$(this).closest('form').find('.temp-remove').remove();
				});

				//Remove a pubmed link from an entry
				context.find('.pubmed-remove-link').on('click',function(e){
					e.preventDefault();
					$(this).closest('.pubmed-link-combo').addClass('temp-hide').hide();
				})


				// add a new pubmed link
				context.find('.add-new-pubmed-button').on('click', function(e){
					e.preventDefault();
					var val = $(this).closest('.row').find(".add-new-pubmed-input").val();
					if (val !== ""){
						var html = '<span class="pubmed-link-combo temp-remove">'
						html += '<a href="http://www.ncbi.nlm.nih.gov/pubmed/' + val + '" class="pubmed-link" target="_blank" style="margin-left:10px;" data-link="' + val + '">' + val + '</a>'
						html += '<a href="#" class="edit pubmed-remove-link" style="display:inline;">&nbsp<i class="fi-x"></i></a></span>'
						var context = $(this).closest('form').find('.pubmed-links');
						context.append(html);
						utility.refresh(context);
						_this.generic(context);
					}
					$(this).closest('.row').find(".add-new-pubmed-input").val('');
				});

			},
			//Handler for specifically dealing with future interacitons
			future : function(el){
				_this = this;
				var context;
				//set the context either to a speciofic interaciton or ALL future recomednations
				if (!el) context = $('#future-recomendations');
				else context = $(el);

				/* when the form is submitted and valid, serialize the recomednation 
				 * and send it to the server. If the update is successful, then the form will be disabled
				 * once again, and the data-originavalue attribute will be updated to reflect the new vlaues.
				 * Additionally, display a message when the update is complete. */
				context.find("form").on("valid.fndtn.abide",function(){
					var _this =this;
					var id = $(this).data('id');
					var o = serializeField(this,'future');
					console.log(id);
					Promise.resolve($.ajax({
						url:"/database/dosing/genes/" + pageOptions.gene + "/update?type=recomendation&id=" + id,
						type:"POST",
						contentType:"application/json",
						dataType:'json',
						data:JSON.stringify(o)
					})).then(function(result){
						if (result.statusCode == 200 ){
							$(_this).find('[name=rec]').data('originalvalue',o.rec);
							$(_this).find('.cancel-changes').trigger('click');
							$(_this).find('.alert-message').text(result.message).closest('.alert-box').slideDown();
						} else {
							$(_this).find('.alert-message').text(result.message).closest('.alert-box').slideDown();

						}
					}).catch(function(err){
						$(_this).find('.alert-message').text(err.message).closest('.alert-box').slideDown();
					});
				});
				

				/* WHen the delete button is selected, confirm the action and then submit a reqyest to the server.
				 * if the request is successful, remove the entry and its HTML entirely from the apge */
				context.find(".delete-table").on('click',function(e){
					e.preventDefault();
					var row = $(this).closest('tr');
					var id = $(this).closest('form').data('id');
					confirmAction("Are you sure you want to delete the selected recomendation table?","Once deleted it will no longer show up on any subsequent reports")
					.then(function(result){
						if (result){
							Promise.resolve($.ajax({
								url:"/database/dosing/genes/" + pageOptions.gene + "/delete?type=recomendation&id=" + id,
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

			//handlers dealing with the haplotype section
			haplotypes : function(el){
				_this = this;
				var context;
				//apply to the entire section or an single association
				if (!el) context = $('#haplotypes');
				else context = $(el);

				/* when the form is validated submit an ajax request to the server. If the request
				 * returns with a success resoonse then set the data-originalvalue for each field to
				 * the new values, diable all inout fields and hide the edit buttons. */
				context.find('form').on('valid.fndtn.abide',function(e){
					var id = $(this).data('id');
					var o = serializeField(this,'haplotype');
					var _this = this;
					Promise.resolve($.ajax({
						url:'/database/dosing/genes/'+ pageOptions.gene + '/update?type=haplotype&id=' + id,
						type:'POST',
						contentType:'application/json',
						dataType:'json',
						data:JSON.stringify(o)
					})).then(function(result){
						if (result.statusCode == 200 ){
							$(_this).find('input[name=allele_1]').data('originalvalue',o.allele_1);
							$(_this).find('input[name=allele_2]').data('originalvalue',o.allele_2);
							$(_this).find('.cancel-changes').trigger('click');
							$(_this).find('.alert-message').text(result.message).closest('.alert-box').slideDown();
						} else {
							$(_this).find('.alert-box').find('p').text(result.message).closest('.alert-box').slideDown();
						}
					});
				});

				/* When selected prompt the user if they really want to delete the haplotype, if yes, then send an ajax request to teh server.
				 * If successful entirely remove all html for the entry */
				context.find('.delete-table').on('click',function(){
					var form = $(this).closest('form');
					var row = $(this).closest('tr');
					confirmAction("Are you sure you want to delete the selected haplotype association?","Once deleted it will no longer show up on any subsequent reports")
					.then(function(result){
						if (result){
							Promise.resolve($.ajax({
								url:"/database/dosing/genes/" + pageOptions.gene + "/delete?type=haplotype&id=" + id,
								type:"POST",
								dataType:'json'
							})).then(function(result){
								if (result.statusCode == 200 ){
									row.remove();
									if ($('#haplotypes').find('tbody').find('tr').length === 0){
										$('#haplotypes').hide();
									}
									$('#error-display-message-3').text(result.message).closest('#error-display-box-3').slideDown()

								} else {
									$('#error-display-message-3').text(result.message).closest('#error-display-box-3').slideDown()
								}
							}).catch(function(err){
								$('#error-display-message-3').text(err.message).closest('#error-display-box-3').slideDown()
							});
						}
					});
				});

			},

			// handlers related to specific interacitons
			interactions : function(el){
				_this = this;
				var context;
				if (!el) context = $('#main_content');
				else context = $(el);

				// If the handlers are being applied to a new row open the drug container ti is being appended to
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
				
				
				/* Submit the chagnes to the current dose table to the server. If the request is successful set the data-originalvalue to the 
				 * new current value and then disable the input fields */
				context.find('form').on('valid.fndtn.abide',function(e){
					var _this = $(this);
					var doc = serializeField(this,'interaction');
					var id = $(this).data('id');
					Promise.resolve($.ajax({
						url:'/database/dosing/genes/' + pageOptions.gene + '/update?type=interaction&id=' + id,
						type:"POST",
						contentType:'application/json',
						dataType:'json',
						data:JSON.stringify(doc)
					})).then(function(result){
						if (result.statusCode == 200){
							$(_this).find('[name=risk]').data('originalvalue',doc.risk);
							$(_this).find('[name=rec]').data('originalvalue',doc.rec);
							$(_this).find('.pubmed-link-combo').removeClass('temp-remove');
							$(_this).find('.temp-hide').remove();
							$(_this).find('.cancel-changes').trigger('click');
							$(_this).find('.alert-message').text(result.message).closest('.alert-box').slideDown();
						} else {
							$(_this).find('.alert-box').find('p').text(result.message).closest('.alert-box').slideDown();
						}
					});

				});
				
				

				//delet the specified dose table after confirming its removal
				context.find(".delete-table").on('click',function(e){
					var form = $(this).closest('form');
					var id = form.data('id');
					confirmAction("Are you sure you want to delete the selected dosing table?","Once deleted it will no longer show up on any subsequent reports")
					.then(function(result){
						if (result){
							Promise.resolve($.ajax({
								url:"/database/dosing/genes/" + pageOptions.gene +"/delete?type=interaction&id="+ id,
								type:"POST",
								dataType:'json'
							})).then(function(result){
								if (result.statusCode == 200){	
									$('#error-display-message').text(result.message).closest('#error-display-box').slideDown();
									form.slideUp('slow',function(){
										var remainingFormCount = form.closest('.drug-cont').find('form').length;
										if ( remainingFormCount == 1 )
											form.closest('.drug-cont').remove();
										else
											form.closest('tr').remove();
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
	
	//arrangeRecomendations by drug		
	var arrangeRecs = function(input){
		var out = {};
		var sortedOut = [];
		if (input.recomendations){
			for (var i = 0; i < input.recomendations.length; i++ ){
				if (!out.hasOwnProperty(input.recomendations[i].drug)){
					out[input.recomendations[i].drug] = [];
				}

				out[input.recomendations[i].drug].push(input.recomendations[i])
			}
			var keys = Object.keys(out).sort();
			for (i = 0; i < keys.length; i++ ){
				sortedOut.push({drug:keys[i],recs:out[keys[i]]});
			}

			input.recomendations = sortedOut;
		}

		return input;
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
					url:"/database/dosing/genes/"+ pageOptions.gene,
					type:'GET',
					dataType:'json'
				}));
			}).then(function(result){
				resultObj = arrangeRecs(result);

				console.log(resultObj);
				return Promise.resolve($.ajax({
					url:'/database/dosing/classes',
					type:'GET',
					dataType:'json'
				}));
			}).then(function(result){
				console.log(resultObj);
				resultObj.classes = result[0].classes;
				return templates.drugs.current(resultObj);
			}).then(function(renderedHtml){
				return $('#main').html(renderedHtml);
			}).then(function(){
				return templates.drugs.future(resultObj);
			}).then(function(renderedHtml){
				return $('#future-recomendations').find('tbody').append(renderedHtml);
			}).then(function(){
				return templates.drugs.haplo(resultObj);
			}).then(function(renderedHtml){
				return $("#haplotypes").find('tbody').append(renderedHtml);
			}).then(function(){
				//set the values of the select tags to the value contained in the 
				//original value data element
				setSelects();
				return utility.refresh(abideOptions);
			}).then(function(){
				//add all handlers
				staticHanlders.current.page();
				staticHanlders.current.interactions();
				staticHanlders.current.future();
				staticHanlders.current.haplotypes();
				staticHanlders.current.generic();

			}).then(function(){
				$('#toggle-all').trigger('click');
			}).catch(function(err){
				console.log(err);
			});
		}

		return promise;
	};
	return main();	
};