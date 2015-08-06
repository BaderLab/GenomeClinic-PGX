/* Functions and handlers for working with the Dosing recommendations UI
 * these functions enable the user to update, delete or add dosing
 * recommendations. This is not to be confused with the dosing recommendations
 * report page, which employes a separate js-script.
 *@author Patrick Magee */

var utility = require('./utility');

(function(){
	//object to contain options for the page
	var pageOptions = {
		location:undefined,
		gene:undefined,
		use:undefined,
		classes:undefined,
		counter:0
	};

	/* Set the specific abide validators for the current page
	 */ 
	var abideOptions = {
		abide: {
			validators:{
				requiredIf:function(el,required,parent){
				/* if the element =pointed to by the data-requiredIf is not null then the current field must
				 * be not null as well */
					var from = document.getElementById(el.getAttribute(this.add_namespace('data-requiredIf'))).value;
					var val = el.value;
					if (from === "None") from = "";
					if (val === "None") val = "";
					if (from !== "" && val === ""){
						return false;
					} else {
						return true;
					}
				},
				
				uniqueGene:function(el,required,parent){
					/* The incoming gene name must be unique */
					var from = document.getElementsByClassName('gene-name');
					var val = el.value;
					var count = 0;
					for (var i=0; i < from.length; i++ ){
						if (val == from[i].value) count++
					}
					if (count > 1) return false;
					else return true;
				}
			}
		}
	};

	//When A Recommendation is loaded the originalValue of the Selects need to be set. this will set them for all elements supplied
	//Using the value of data-originalvalue.
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
	
	var getGeneInfo = function(geneName){
		return Promise.resolve($.ajax({
			url:"/database/dosing/genes/"+ geneName + '?type=true',
			type:"GET"
		}));
	}
	/* Serialzie a field and return the document that results. This is for new fields only and not updated fields.
	 * The type can be one of recommendation, future, or haplotype, corresponding to the three types of information on
	 * the page. 
	 */
	var serializeNewField = function(context,type){
		var doc = {};
		var fields = $(context).serializeArray();
		//Remove empty fields
		for (var i = 0; i < fields.length; i++ ){
			if (fields[i].value !== "" && fields[i] != "None" ){
				doc[fields[i].name] = fields[i].value;
			}
		}
		if ( type == 'recommendation' ){
			doc.genes = [pageOptions.gene];
			doc.classes = [$(context).find("#class-name-original").val()]
			var addGenes = $(context).find('.additional-gene-row');
			for (var i = 0; i< addGenes.length; i++ ){
				doc.genes.push($(addGenes[i]).find(".gene-name").val())
				doc.classes.push($(addGenes[i]).find(".class-name").val())
			}
			var linksArr = $(context).find('.pubmed-link-combo');
			var links = [];
			for (var i = 0; i < linksArr.length; i++ ){
				if (!$(linksArr[i]).hasClass('temp-remove')){
					links.push($(linksArr[i]).data('id'));
				}
			}
			doc.pubmed = links;
			doc.flagged = !$(context).find(".flag").hasClass('secondary');
		} else if ( type == 'future' ){
			doc.gene = pageOptions.gene;
			doc.flagged = !$(context).find(".flag").hasClass('secondary');
		} else if ( type == 'haplotype' ){
			doc.gene = pageOptions.gene;
			doc.haplotypes = [doc.allele_1,doc.allele_2];
			delete doc.allele_1;
			delete doc.allele_2;
		}
		return doc;
	}
	/* Serialize an existing field and return the mutable fields. These are the fields that
	 * have been updated by the user.
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
		if (type == 'recommendation'){
			//additionally add the pubmedID's
			var linksArr = $(context).find('.pubmed-link-combo');
			var links = [];
			for (var i = 0; i < linksArr.length; i++ ){
				if (!$(linksArr[i]).hasClass('temp-hide')){
					links.push($(linksArr[i]).data('id'));
				}
			}
			doc.pubmed = links;
			doc.flagged = !$(context).find(".flag").hasClass('secondary');
		} else if ( type == 'haplotype' ){
			doc.haplotypes = [doc.allele_1,doc.allele_2];
		} else if ( type == 'future' ){
			doc.flagged = !$(context).find(".flag").hasClass('secondary');
		}

		return doc;
	};

	//Reveal a modal and confirm whether or not the action should be continued
	//returns a promise that has the value of true or false depending on the 
	//function
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

	


	/* all page handlers for working with dosing tables and drug recommendations */
	var staticHanlders = {
		/* main page hanlders, contains a list of all the genes that are that have dosing
		 * information  and the number of interactions tehre are recommendations for*/
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
					if (!utility.matchSearch([$(currentRows[i]).data('gene'),$(currentRows[i]).data('enzymaticclass')]))
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
			 * navigate to the new gene's drug recommendation page */
			$('#submit-new-gene-form').on('valid.fndtn.abide',function(e){
				var val = $('#new-gene-name').val().replace('/');
				var type = $('#new-gene-type').find('option:selected').data('id');

				Promise.resolve($.ajax({
					url:'/database/dosing/new?gene=' + val+ "&type="+ type + '&from=Dosing',
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


				$('.flag').on('click',function(e){
					e.preventDefault();
					if ($(this).hasClass('editfixed') ){
						if ($(this).hasClass('secondary')) $(this).removeClass('secondary')
						else $(this).addClass('secondary');
					}
					return;
				});
				// If future recomednations is not empty show it;
				if ( $('#future-recommendations').find('tbody').find('tr').length > 0 ){
					$('#future-recommendations').show();
				}

				// If haplotypes are not empty show them
				if ( $('#haplotypes').find('tbody').find('tr').length > 0 ){
					$('#haplotypes').show();
				}


				/* Scroll functions for navigating to points on the page */


				$('.scroll-to-future').on('click',function(e){
					e.preventDefault();
					$('body').animate({
        				scrollTop: $("#future-recommendations-header").offset().top},
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
        				scrollTop: $("#recommendation-header").offset().top},
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
				//new recommendation;
				//Button to set new recommendation
				$('#new-recommendation').on('click',function(e){
					e.preventDefault();
					$(this).hide().siblings('#new-recommendation-triggers').show();
					$('#new-recommendation-form').slideDown();
				});

				//submit the new recommendation field
				$('#new-recommendation-trigger-submit').on('click',function(e){
					e.preventDefault();
					$('#new-recommendation-form').submit();//submit').trigger('click');
				});


				//cancel the new recommendation form reseting and hiding it
				$('#new-recommendation-cancel-trigger').on('click',function(e){
					e.preventDefault();
					$(this).closest("#new-recommendation-triggers").hide().siblings('#new-recommendation').show();
					$('#additional-genes').empty();
					document.getElementById('new-recommendation-form').reset();//.trigger('click');
					$('#new-recommendation-form').find('.pubmed-links').empty();
					$('#new-recommendation-form').slideUp();
				});

				/* Add a new dependant  gene recommendation to the current recommendation */
				$('#add-additional-gene').on('click',function(e){
					e.preventDefault();
					var opts = {
						num : pageOptions.counter,
						classes : pageOptions.classes
					}
					templates.drugs.gene(opts).then(function(renderedHtml){
						$('#additional-genes').append(renderedHtml);
					}).then(function(){

						//Handler for retrieving the information on the specific
						//Predicted result for the specific enyzme catefory fo the
						//New Gene
						utility.suggestionHandlers();
						$('#gene-name-'+pageOptions.counter).on('change',function(){
							var _this = this;
							var val = $(this).val();
							if (val !== ""){
								getGeneInfo(val)
								.then(function(type){
									if (type){
										var html = "";
										for (var i = 0; i<pageOptions.classes[type].classes.length; i++ ){
											html += "<option>" + pageOptions.classes[type].classes[i] + "</option>"
										}
										$(_this).closest('.additional-gene-row').find('.class-name').removeAttr('disabled')
										.html(html)
									} else {
										$(_this).closest('.additional-gene-row').find('.class-name').val('');
										$(_this).closest('.additional-gene-row').find('.class-name').attr('disabled','disabled')
									}
								}).catch(function(err){
									$(_this).closest('.additional-gene-row').find('.class-name').val('');
									$(_this).closest('.additional-gene-row').find('.class-name').attr('disabled','disabled')
								});
							}
						});
						_this.removeRow('#remove-additional-gene-' + pageOptions.counter);

						utility.refresh(abideOptions,'#additional-gene-row-' + pageOptions.counter);
						pageOptions.counter++
					});
				})

				/* When the form is considered valid, trigger this event handler
				 * submitting the serialized data to the server for entry. The
				 * server will additionally check to see if there are any identical
				 * entires already in existence. If there are, it will return false
				 * and data will not be entered but inform the user an entry similar
				 * to that already exists */
				$('#new-recommendation-form').on('valid.fndtn.abide', function (){
					var doc = serializeNewField(this,'recommendation');
					var context;
					Promise.resolve($.ajax({
						url:'/database/dosing/genes/' + pageOptions.gene + '/new?type=recommendation',
						type:"POST",
				 		contentType:"application/json",
				 		dataType:"json",
						data:JSON.stringify(doc)
					})).then(function(result){
						if (result.statusCode == 200 ){
							return utility.pubMedParser(result.pubmed).then(function(citations){
								result.citations = citations;
								var currentDrugCont = $('.drug-cont');
								var currentDrugs=[];
								var num = $('#main_content').find('form').length;
								result.num = num;
								//GET NAMES OF CURRENT DRUGS
								for (var i=0; i < currentDrugCont.length; i++ ){
									currentDrugs.push($(currentDrugCont[i]).data('drug'));
								}
								//If this is a new drug, add a new drug table
								if (currentDrugs.indexOf(result.drug) === -1 ){
									result.new = true;
								}
								promise = templates.drugs.new(result).then(function(renderedHtml){
									if (result.new){
										return $('#main_content').append(renderedHtml)
									} else {
										return $('.drug-cont[data-drug=' + result.drugs + ']').find('.recommendations').append(renderedHtml);
									}
								}).then(function(){
									if (result.new) context = $('.drug-cont[data-drug=' + result.drug + ']');
									else context = $('.drug-cont[data-drug=' + result.drug + ']').last('tr').find('form');
									context.foundation(abideOptions);
									_this.recommendation(context);
									_this.generic(context);
									setSelects(context);
								});
							});
						} else {
							$('#error-display-message').text(result.message).closest('#error-display-box').slideDown();
						}
					}).then(function(){
						$('#new-recommendation-cancel-trigger').trigger('click');					
					}).catch(function(err){
						$('#error-display-message').text(err.toString()).closest('#error-display-box').slideDown();
					});
				});
				
				//*============================
				// New Future Form

				//button to drop down the new interaciton
				$('#new-future').on('click',function(e){
					e.preventDefault();
					$(this).hide().siblings('#new-future-triggers').show();
					$('#new-future-form').slideDown();
				});

				//submit the new recommendation field
				$('#new-future-trigger-submit').on('click',function(e){
					e.preventDefault();
					$('#new-future-form').submit();//submit').trigger('click');
				});


				//cancel the new interaction form reseting and hiding it
				$('#new-future-cancel-trigger').on('click',function(e){
					e.preventDefault();
					$(this).closest("#new-future-triggers").hide().siblings('#new-future').show();
					document.getElementById('new-future-form').reset();
					$('#new-future-form').slideUp();

				});

				/* When the form is considered valid, trigger this event handler
				 * submitting the serialized data to the server for entry. The
				 * server will additionally check to see if there are any identical
				 * entires already in existence. If there are, it will return false
				 * and data will not be entered but inform the user an entry similar
				 * to that already exists */
				$("#new-future-form").on('valid.fndtn.abide',function(){
					var o = serializeNewField(this,'future');
					Promise.resolve($.ajax({
						url:'/database/dosing/genes/' + pageOptions.gene + '/new?type=future',
						type:"POST",
						contentType:'application/json',
						dataType:'json',
						data:JSON.stringify(o)
					})).then(function(result){
						if (result.statusCode == 200){
							templates.drugs.future({future:[result]}).then(function(renderedHtml){
								return $('#future-recommendations').find('tbody').append(renderedHtml);
							}).then(function(){
								var context = $('#future-recommendations').find('tbody').last('tr')
								_this.generic(context);
								_this.future(context);
								utility.refresh(abideOptions,context);
								$('#future-recommendations').show();
								$('#error-display-message-2').text(result.message).closest('#error-display-box-2').slideDown()
								$('#new-future-cancel-trigger').trigger('click');
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
						url:'/database/dosing/genes/' + pageOptions.gene + '/new?type=haplotype',
						type:'POST',
						contentType:'application/json',
						dataType:'json',
						data:JSON.stringify(o)
					})).then(function(result){
						if (result.statusCode == 200 ){
							templates.drugs.haplo({ haplotypes : [result] }).then(function(renderedHtml){
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
					confirmAction("Are you sure you want to delete all dosing recommendations for " + pageOptions.gene,"This will permanately delete all entries and they will no longer be available for report generation")
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
			removeRow:function(el){
				$(el).on('click',function(e){
					e.preventDefault();
					var num = $(this).data('num');
					$('#additional-gene-row-' + num).remove();
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
					$(this).closest('form').find('.flag').addClass('editfixed');
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
					var flag = $(this).closest('form').find('.flag').data('originalvalue');
					if (flag) $(this).closest('form').find('.flag').removeClass('secondary');
					else $(this).closest('form').find('.flag').addClass('secondary');
					$(this).closest('form').find('.flag').removeClass('editfixed');
				});

				//Remove a pubmed link from an entry
				context.find('.pubmed-remove-link').on('click',function(e){
					e.preventDefault();
					$(this).closest('.pubmed-link-combo').addClass('temp-hide').hide();
				})


				// add a new pubmed link
				context.find('.add-new-pubmed-button').on('click', function(e){
					var __this = this;
					e.preventDefault();
					var val = $(this).closest('.row').find(".add-new-pubmed-input").val();
					if (val !== ""){
						utility.pubMedParser(val).then(function(citations){
							if (citations[val]){
								var html= "<li class='pubmed-link-combo' data-id=" + val + ">" + citations[val] +"\
								&nbsp&nbsp <a href='#' class='edit pubmed-remove-link ' data-link=" + val + "><i class='fi-x'></i></a></li>"
								var context = $(__this).closest('.citations').find('.pubmed-links');
								context.append(html);
								utility.refresh(context);
								_this.generic(context);
							}
						})
					};
					$(this).closest('.row').find(".add-new-pubmed-input").val('');
				});

			},
			//Handler for specifically dealing with future interacitons
			future : function(el){
				_this = this;
				var context;
				//set the context either to a speciofic interaciton or ALL future recomednations
				if (!el) context = $('#future-recommendations');
				else context = $(el);

				/* when the form is submitted and valid, serialize the recomednation 
				 * and send it to the server. If the update is successful, then the form will be disabled
				 * once again, and the data-originavalue attribute will be updated to reflect the new vlaues.
				 * Additionally, display a message when the update is complete. */
				context.find("form").on("valid.fndtn.abide",function(){
					var _this =this;
					var id = $(this).data('id');
					var o = serializeField(this,'future');
					Promise.resolve($.ajax({
						url:"/database/dosing/genes/" + pageOptions.gene + "/update?type=future&id=" + id,
						type:"POST",
						contentType:"application/json",
						dataType:'json',
						data:JSON.stringify(o)
					})).then(function(result){
						if (result.statusCode == 200 ){
							$(_this).find('[name=rec]').data('originalvalue',o.rec);
							$(_this).find('.flag').data('originalvalue',o.flagged)
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
					confirmAction("Are you sure you want to delete the selected recommendation table?","Once deleted it will no longer show up on any subsequent reports")
					.then(function(result){
						if (result){
							Promise.resolve($.ajax({
								url:"/database/dosing/genes/" + pageOptions.gene + "/delete?type=future&id=" + id,
								type:"POST",
								dataType:'json'
							})).then(function(result){
								if (result.statusCode == 200 ){
									row.remove();
									if ($('#future-recommendations').find('tbody').find('tr').length === 0){
										$('#future-recommendations').hide();
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
						console.log(result);
						if (result.statusCode == 200 ){
							$(_this).find('input[name=allele_1]').data('originalvalue',$(_this).find('input[name=allele_1]').val());
							$(_this).find('input[name=allele_2]').data('originalvalue',$(_this).find('input[name=allele_2]').val());
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
					var id = form.data('id');
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
			recommendation : function(el){
				_this = this;
				var context;
				if (!el) context = $('#main_content');
				else context = $(el);

				// If the handlers are being applied to a new row open the drug container ti is being appended to
				if (!context.is('tr')){
					context.find('.drug-cont-header').on('click',function(){
						var state = $(this).data('state');
						if (state === "open"){
							$(this).closest('.drug-cont').find('.recommendations').hide().closest('.drug-cont').find('.minimize').hide().siblings('.expand').show()
							$(this).data('state','closed');
						} else {
							$(this).closest('.drug-cont').find('.recommendations').show().closest('.drug-cont').find('.expand').hide().siblings('.minimize').show()
							$(this).data('state','open');
						}
					});
				}
				
				
				/* Submit the chagnes to the current dose table to the server. If the request is successful set the data-originalvalue to the 
				 * new current value and then disable the input fields */
				context.find('form').on('valid.fndtn.abide',function(e){
					var _this = $(this);
					var doc = serializeField(this,'recommendation');
					var id = $(this).data('id');
					Promise.resolve($.ajax({
						url:'/database/dosing/genes/' + pageOptions.gene + '/update?type=recommendation&id=' + id,
						type:"POST",
						contentType:'application/json',
						dataType:'json',
						data:JSON.stringify(doc)
					})).then(function(result){
						if (result.statusCode == 200){
							$(_this).find('[name=risk]').data('originalvalue',doc.risk);
							$(_this).find('[name=rec]').data('originalvalue',doc.rec);
							$(_this).find('.flag').data('originalvalue',doc.flagged)
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
								url:"/database/dosing/genes/" + pageOptions.gene +"/delete?type=recommendation&id="+ id,
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
	
	//arrangeRecommendations by drug		
	var arrangeRecs = function(input){
		var out = {};
		var sortedOut = [];
		if (input.recommendations){
			for (var i = 0; i < input.recommendations.length; i++ ){
				if (!out.hasOwnProperty(input.recommendations[i].drug)){
					out[input.recommendations[i].drug] = [];
				}

				out[input.recommendations[i].drug].push(input.recommendations[i])
			}
			var keys = Object.keys(out).sort();
			for (i = 0; i < keys.length; i++ ){
				sortedOut.push({drug:keys[i],recs:out[keys[i]]});
			}

			input.recommendations = sortedOut;
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
				return Promise.resolve($.ajax({
					url:'/database/dosing/classes',
					type:'GET',
					dataType:'json'
				})).then(function(classes){
					return templates.drugs.index({genes:result,classes:classes});
				});
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
				return Promise.resolve($.ajax({
					url:'/database/dosing/classes',
					type:'GET',
					dataType:'json'
				}));
			}).then(function(result){
				resultObj.classes = result[resultObj.type].classes;
				resultObj.allClasses = result;
				pageOptions.classes = result;
				var pubmedIds = [];
				for (var i=0; i < resultObj.recommendations.length; i++ ){
					for (var j = 0; j <resultObj.recommendations[i].recs.length; j++){
						pubmedIds = pubmedIds.concat(resultObj.recommendations[i].recs[j].pubmed);
					}
					
				}
				return utility.pubMedParser(pubmedIds).then(function(citations){
					resultObj.citations = citations;

				})
			}).then(function(){
				return templates.drugs.current(resultObj);
			}).then(function(renderedHtml){
				return $('#main').html(renderedHtml);
			}).then(function(){
				return templates.drugs.future(resultObj);
			}).then(function(renderedHtml){
				return $('#future-recommendations').find('tbody').append(renderedHtml);
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
				staticHanlders.current.recommendation();
				staticHanlders.current.future();
				staticHanlders.current.haplotypes();
				staticHanlders.current.generic();
				utility.suggestionHandlers();

			}).then(function(){
				$('#toggle-all').trigger('click');
			});
		}

		return promise;
	};
	$(document).ready(function(){
		return main();
	});
})();