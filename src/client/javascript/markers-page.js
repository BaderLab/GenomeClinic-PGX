/* Module for managing the the current markers within the database
 * Serves as an interface to add and update markers
 *
 * @Patrick Magee
 */
var utility = require('./utility'),
	pgxConstants = require('../../server/conf/constants.json').dbConstants.PGX;

(function(){


	//confirm whether or not the user would like to delete the selected marker
	var confirmDeleteHanlder = function(markerName){
		var promise = new Promise(function(resolve, reject){
			$('#confirm-delete').find('h4').text('Are you sure you want to delete the marker ' + markerName + "?")
			.closest('#confirm-delete').foundation('reveal','open');

			$('#confirm-delete').find('.cancel').on('click',function(e){
				e.preventDefault();
				$('#confirm-delete').foundation('reveal','close');
				resolve(false);
			});

			$('#confirm-delete').find('.success').on('click',function(e){
				e.preventDefault();
				$('#confirm-delete').foundation('reveal','close');
				resolve(true);
			});
		});
		return promise;
	};

	var confirmUpdate = function(marker, chr, genes, ref, alt){
		var context = $('#update-modal');
		var promise = new Promise(function(resolve,reject){
			context.find('h4').text('Make updates to ' + marker + '?');
			context.find('input[name=chr]').val(chr);
			context.find('input[name=asgenes]').val(genes);
			context.find('input[name=ref]').val(ref);
			context.find('input[name=alt]').val(alt);

			context.find('.success').on('click',function(e){
				e.preventDefault();
				var arr = context.find('form').serializeArray();
				var form = serializeNewMarker(arr);
				for (var item in form) {
					if (form.hasOwnProperty(item)){
						if (form[item] === ''){
							context.find('input[name=' + item + ']').addClass('error').siblings('small').text("Required").show();
						} else {
							if (context.find('input[name=' + item + ']').hasClass('error')){
								context.find('input[name=' + item + ']').removeClass('error').siblings('small').text("").hide();
							}
							if (item == 'chr' && utility.chrRegex.exec(form[item]) === null ){
								context.find('input[name=' + item + ']').addClass('error').siblings('small').text("Valid Chromosome Required").show();
							} else if ((item == 'ref' || item == 'alt') && utility.allelesRegex.exec(form[item]) === null){
								context.find('input[name=' + item + ']').addClass('error').siblings('small').text("Valid Allele Required").show();
							} else if (item=='asgene'){// && /^[0-9]+/.exec(form[item]) === null)
								form[item] = form[item].toUpperCase().split(',');
								context.find('input[name=' + item + ']').addClass('error').siblings('small').text("A valid number is required").show();
							}
						}
					}
				}

				form.date = new Date().toDateString();
				if (!context.find('input').hasClass('error')){
					context.foundation('reveal','close');
					resolve(form);
				}	
			});
			
			context.find('.cancel').on('click',function(e){
				e.preventDefault();
				context.foundation('reveal','close');
				resolve();
			});

			context.foundation('reveal','open');
		});
		
		return promise;
	}

	/* handlers for each marker row, loaded individually
	 * or all at once. */
	var markerRowHandler = function(context){
		/* refresh handler for specific row. the handlers are removed when
		 * you expand the row in order to allow the user to interact with
		 * the row without it closing on them */
		var refreshClick  = function(context){
			$(context).on('click',function(){
				$(this).off('click');
				$(this).find('.edit').show().closest(this).find('.static-marker-field').hide();
			});
		};

		var updated = "Updated&nbsp&nbsp<i class='fa fa-exclamation' style='color:blue'></i>";
		var missing = "Marker no longer found in dbSNP&nbsp&nbsp&nbsp&nbsp<i class='fa fa-x' style=color:red'></i>";
		var unchanged = "Up to date&nbsp&nbsp&nbsp&nbsp<i class='fa fa-check' style='color:green'></i>";
		var warning = "Error encountered&nbsp&nbsp&nbsp<i class='fa fa-warning' style='color:orange'></i>"


		//Cancel changes with escape key
		$(document).keyup(function(e){
			
			if (e.keyCode == 27) {
				$('.marker-row').find('.cancel').trigger('click.button');
				
			}
		});

		var sel;
		//if context is passed add hanlders for that specific context
		if (context)
			sel = $(context);
		else
			sel = $('.marker-row');

		var customFields = sel.find('form[data-type=custom]');
		var dbFields = sel.find('form[data-type=dbsnp]');

		if (customFields.length > 0 ){
			customFields.find('.success').on('click',function(e){
				var form = $(this).closest('form');
				var marker = form.attr('id');
				var genes = form.data('asgenes');
				var chr = form.data('chr');
				var ref = form.data('ref');
				var alt = form.data('alt');

				e.preventDefault();
				confirmUpdate(marker,chr,genes,ref,alt).then(function(result){
					if (result){
						Promise.resolve($.ajax({
							url:'/database/markers/update?id=' + marker + '&type=custom',
							type:'POST',
							contentType:'application/json',
							dataType:'json',
							data:JSON.stringify(result)
						})).then(function(status){
							if (status.status == 'ok'){
								result._id = marker;
								result.type = form.data('type');
								return templates.markers.row({markers:[result]}).then(function(renderedHtml){
									return form.closest('tr').replaceWith(renderedHtml);
								}).then(function(){
									markerRowHandler($('#' + marker).closest('tr'));
									$('#' + marker).find('.alert-message').text('Marker successfully updated').closest('.alert-box').slideDown();
								});
							} else {
								$('#' + marker).find('.alert-message').text('Marker did not update successfully').closest('.alert-box').slideDown();
							}
						})
					}
				});
			});
		} 

		if (dbFields.length > 0){
			dbFields.find('.success').on('click',function(e){
				e.preventDefault();
				var form = $(this).closest('form');
				var marker = form.attr('id');
				form.css('opacity','0.5');
				form.closest('tr').find('.loading-spinner').show();
				var _this = this;
				Promise.resolve($.ajax({
					url:'/database/markers/update?id=' + marker + '&type=dbsnp',
					type:'POST',
					contentType:'application/json',
					dataType:'json',
				})).then(function(result){
					form.closest('tr').find('.loading-spinner').hide();
					form.css('opacity','1');
					if (result.status = 'failed'){
						form.find('.update-status').html(warning).show();
					}
					if (result.changed.length > 0){
						var record = result.changed[0];
						templates.markers.row({markers:[record]}).then(function(renderedHtml){
							return $(form).closest('tr').replaceWith(renderedHtml)
						}).then(function(){
							markerRowHandler($("#" + marker).closest('tr'));
							$('#' + marker).find('.update-status').html(updated).show()
						});

					} else if (result.missing.length > 0){
						form.find('.update-status').html(missing).show()

					} else {
						form.find('.update-status').html(unchanged).show()

					}
				});
			});
		}

		//Marker for row click
		sel.on('click.row',function(){
			$(this).off('click');
			if ($(this).find('.edit:visible').length === 0)
				$(this).find('.edit').show().closest(this).find('.static-marker-field').hide();
		});

		sel.find('.close-box').on('click',function(e){
			e.preventDefault();
			$(this).closest('.alert-box').slideUp();
		});

		sel.find(".delete").on('click',function(e){
			e.preventDefault()
			var name = $(this).closest('form').attr('id');
			confirmDeleteHanlder(name).then(function(result){
				if (result == true){
					Promise.resolve($.ajax({
						url:"/database/markers/delete?id=" + name,
						type:"POST",
						contentType:"application/json",
						dataType:'json'
					})).then(function(result){
						if (result.status == 'ok'){
							$('#' + name).closest('tr').remove();
						} else {
							console.log(result);
						}
					});
				}
			}); 
		});
		//Cancel the current modifications, reset the values of the input to the previous values
		//and close the edit fields
		sel.find('.cancel').on('click.button',function(e){
			var fields = ['chr','asgenes','alt','ref'];
			e.preventDefault();
			$(this).closest('.marker-row').find('.edit').hide('slow',function(){//.find('.static-marker-field').show('fast',function(){
				refreshClick($(this).closest('.marker-row'));
			});
		});
		//Form is submitted and listening for a valid even from the foundation event 
	}

	//Serialize the markers into an object and return the object
	var serializeNewMarker = function(array){
			var input = {};
			array.map(function(item){
				if (item.name == 'alt')
					input[item.name] = item.value.toUpperCase().split(/[\,\s]/g);
				else if (item.name == 'asgenes')
					input[item.name] = item.value.toUpperCase().split(',');
				else if (item.name == 'new-marker' || item.name == 'dbsnp-id')
					input[item.name] = item.value;
				else
					input[item.name] = item.value.toUpperCase();
			});
			return input;
		}	

	//Static page handlers
	var statichandlers = function(){

		$('.close-box').on('click',function(e){
			e.preventDefault();
			$(this).closest('.alert-box').slideUp();
		});

		$('#search-box').on('keyup',function(){
			var items = $('.marker-row');
			var searchArr;
			var obj;
			var keys;
			for (var i=0; i<items.length;i++){
				obj = $(items[i]).find('form').data();
				keys = Object.keys(obj)
				searchArr = keys.map(function(item){if (Object.prototype.toString.call(obj[item]) != '[object Object]') return obj[item].toString()}).filter(function(item){if (item) return item})
				searchArr.push($(items[i]).find('form').attr('id'));
				if (!utility.matchSearch(searchArr)) {
					$(items[i]).hide();
				} else {
					$(items[i]).show();
				}
			}
		});

		//Jump handlers
		$('#jump-to-custom').on('click',function(e){
			e.preventDefault();
			$('body').animate({
				scrollTop:$('#custom-marker-section').offset().top
			},'slow');
		});

		$('#jump-to-db').on('click',function(e){
			e.preventDefault();
			$('body').animate({
				scrollTop:0
			},'slow');

		})
		
		//handlers for adding new field
		$('#marker-new').on('click',function(e){
			e.preventDefault();
			$(this).closest('div').hide().parents().find('#new-marker').slideDown(250);
		});

		//Cancel adding a new marker row
		$('#cancel-new-marker').on('click',function(e){
			e.preventDefault();
			$(this).closest('form').find('input').val("");
			$('#new-marker').slideUp(250,function(){
				$('#marker-new').closest('div').show();
			});
		});

		$('#update-all-markers').on('click',function(e){
			e.preventDefault();
			$('.marker-row').find('form[data-type=dbsnp]').find('.success').trigger('click');
		});

		//Send an ajax request and submit it to the new marker
		$('#submit-new-marker').on('click',function(e){
			e.preventDefault();
			var doc;
			var type;
			var rsReg = /rs[0-9]+$/i;
			var form = serializeNewMarker($("#new-marker-form").serializeArray());
			//check input.
			if (form['dbsnp-id'] !== ''){
				if ( rsReg.exec(form['dbsnp-id']) === null ){
					$('#new-marker-form').find('input[name=dbsnp-id]').addClass('error').siblings('small').show();
				} else {
					doc = {
						_id:form['dbsnp-id']
					};
					type = 'dbsnp';
				}
			} else {
				type = 'custom';
				delete form['dbsnp-id'];
				for (var item in form) {
					if (form.hasOwnProperty(item)){
						if (form[item] === ''){
							$('#new-marker-form').find('input[name=' + item + ']').addClass('error').siblings('small').text("Required").show();
						} else {
							if ($('#new-marker-form').find('input[name=' + item + ']').hasClass('error')){
								$('#new-marker-form').find('input[name=' + item + ']').removeClass('error').siblings('small').text("").hide();
							}
							if (item == 'chr' && utility.chrRegex.exec(form[item]) === null )
								$('#new-marker-form').find('input[name=' + item + ']').addClass('error').siblings('small').text("Valid Chromosome Required").show();
							if ((item == 'ref' || item == 'alt') && utility.allelesRegex.exec(form[item]) === null)
								$('#new-marker-form').find('input[name=' + item + ']').addClass('error').siblings('small').text("Valid Allele Required").show();
							if (item=='pos' && /^[0-9]+/.exec(form[item]) === null)
								$('#new-marker-form').find('input[name=' + item + ']').addClass('error').siblings('small').text("A valid number is required").show();
							if (item == 'id')
								$('#new-marker-form').find('input[name=id]').trigger('keyup');
						}
					}
				}
				var date = new Date()
				doc = {
					_id : form['new-marker'],
					type : type,
					chr : form.chr,
					asgenes : form.asgenes,
					alt : form.alt.sort(),
					ref : form.ref,
					date : new Date().toDateString()
				}
			}
			if (!$('#new-marker-form').find('input').hasClass('error')){
				var finalResult;
				Promise.resolve($.ajax({
					url:'/markers/new?type='+type,
					type:'POST',
					contentType:'application/json',
					dataType:"json",
					data:JSON.stringify(doc)
				})).then(function(result){
					finalResult =result;
					if (result.status == 'failed')
						throw new Error(result.message)
					return templates.markers.row({markers:[result]})
				}).then(function(renderedHtml){
					if (type == 'dbsnp')
						return $('#markers').prepend(renderedHtml).parent('table').show();
					else
						return $('#custom-markers').prepend(renderedHtml).parent('table').show();
				}).then(function(){
					if (finalResult.merged) {
						doc._id = finalResult._id
					}
					var marker = '#' + doc._id;
					markerRowHandler($(marker).closest('tr'));
					var background = $(marker).closest('tr').css('background-color');
					$(marker).closest('tr').css('background-color',"#C2FFC2");
					$('body').animate({
        				scrollTop: $(marker).offset().top - 50},
        				'slow');
					setTimeout(function(){
						$(marker).closest('tr').css('background-color',background)
					},3000);
					if(finalResult.merged) $(marker).find('.alert-message').text('rs' + finalResult.merged.from.toString() + " has merged into " + doc._id +". The marker is being stored under its new name").closest('.alert-box').slideDown();
					$('#cancel-new-marker').trigger('click');
				}).catch(function(err){
					$('#new-marker-form').find('.alert-message').text(err.message).closest('.alert-box').slideDown();
				})
			}
		});

		//Check to ensure the marker being added is not currently in the database
		$('#new-marker-form').find('input[name=id]').on('keyup',function(){
			var val = $(this).val();
			var _this = this;
			utility.existsInDb(pgxConstants.COORDS.COLLECTION,pgxConstants.COORDS.ID_FIELD,val)
			.then(function(result){
				if (result){
					$(_this).addClass('error').siblings('small').text('Marker Already Exists').show();
				} else {
					$(_this).removeClass('error').siblings('small').hide();
				}
			});
		});
		$('#new-marker-form input').on('click.removeError',function(){
			if ($(this).hasClass('error'))
				$(this).removeClass('error').siblings('small').hide();
		});
	};



	//Render html
	var main = function(){
		//render the html
		var dbMarkers = {}, customMarkers = {};
		return Promise.resolve($.ajax({
			url:'/database/markers/getmarkers',
			type:'GET',
			dataType:'json',
			contentType:'application/json'		
		})).then(function(result){
			for (marker in result){
				if (result.hasOwnProperty(marker)){
					if (result[marker].type == 'dbsnp') dbMarkers[marker] = result[marker];
					else customMarkers[marker] = result[marker];
				}	
			}
			return  templates.markers.row({markers:dbMarkers})
		}).then(function(renderedHtml){
			if (renderedHtml)
				return $('#markers').append(renderedHtml).parent('table').show();
		}).then(function(){
			return templates.markers.row({markers:customMarkers});
		}).then(function(renderedHtml){
			return $('#custom-markers').append(renderedHtml);
		}).then(function(){
			if ($('#custom-markers').find('tr').length > 0){
				$('#custom-markers').closest('table').show();
			}
		}).then(function(){
			utility.bioAbide();
			statichandlers();
			markerRowHandler();
		}).then(function(){
			utility.suggestionHandlers();
			utility.refresh();
		});
	}

	$(document).ready(function(){
		main();
	})
})();