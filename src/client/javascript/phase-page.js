/* module for working with and modifying
 * haplotype information
 *@patrick magee */

var utility = require('./utility');

var constants = require('../../server/conf/constants.json').dbConstants.PGX;

(function(){
	/* Serialize the page, putting the data into a form that 
	 * can then be sent to the server to update the current
	 * db entry. iterates over each haploytpe to generate the
	 * information
	 */
	var serializeInput = function(){
		var promise = new Promise(function(resolve,reject){
			var out = [];
			var temp,cell;
			var gene = window.location.pathname.split('/').splice(-1)[0]
			var rows = $('.haplotype-row:visible');
			var markers = $('#haplotypes').find('th[id^=marker-rs]').map(function(ind,item){
				return  { marker:$(item).text(), ind: ind + 1}
			});
			var markerComb = [];
			if (markers.length === 0){
				reject('You need at least one marker to save the haplotype');
				return
			}
			if (rows.length === 0) {
				//reject("Need at least one")
			}
			for (var i = 0; i < rows.length; i ++ ){
				temp = {};
				temp._id = $(rows[i]).data('id');
				temp.gene = gene


				//Check to ensure there is no errors
				if ($(rows[i]).find('.haploytpe-cell').find('input').hasClass('error')){
					reject('Errors were found present on the page, please address before submitting');
					return
				} else if ($(rows[i]).find('.haplotype-cell').find('input').attr('disabled') !== 'disabled'){
					$(rows[i]).find('.haplotype-cell').find('input').addClass('error').siblings('small').text("Must Finish before submitting").show();
					reject("Incomplete Form, please fill out all fields prior to submitting")
					return
				} else {
					temp.haplotype = $(rows[i]).find('.haplotype-cell').find('input').val();
				}
				temp.markers = [];
				for (var j = 0; j < markers.length; j ++ ){
					cell = $(rows[i]).find('td').eq(markers[j].ind)
					if (cell.hasClass('use-alt')){
						temp.markers.push(markers[j].marker)
					}
				}
				if (markerComb.indexOf(temp.markers.join('')) === -1 ){
					markerComb.push(temp.markers.join(''));
				} else {
					reject('Each Haplotype must have a unique Marker combination. Please make the appropriate correction before submitting')
					return false;
				}

				out.push(temp);
			}
			resolve(out)
		});
		return promise;
	};

	serializeRemovedHaplotypes = function(){
		var rows = $('.haplotype-row:hidden')
		var ids = []	
		if (rows.length > 0 ){
			for (var i = 0; i < rows.length; i++ ){
				ids.push($(rows[i]).data('id'));
			}
		}
		return ids;
	}

	serializeMarkers = function(){
		var out = {};
		out.added = [];
		out.removed = [];

		$('.new-added').closest('tr').each(function(ind,item){
			out.added.push($(item).attr('id'));
		});
		$('.new-removed').closest('tr').each(function(ind,item){
			out.removed.push($(item).attr('id'));
		});
		return out;
	}

	/* Function for working with the hidden modal that will pop 
	 * up in the event there is a marker entered that is not located
	 * within the databse. The modal contains a form that will request
	 * whether or not the user would like to input a new marker
	 */
	var revealMarkerModal = function(marker){
		var promise = new Promise(function(resolve,reject){
			$('#new-marker-form').on('valid',function(e){
				var form = $(this).serializeArray();
				var doc = {};
				for (var i=0; i<form.length; i++){
					if (form[i].name == 'pos')
						doc[form[i].name] = parseInt(form[i].value);
					else if(form[i].name == 'alt')
						doc[form[i].name] = form[i].value.toUpperCase().split(/[\,\s]/g);
					else
						doc[form[i].name] = form[i].value.toUpperCase();
				}

			 	Promise.resolve($.ajax({
			 		url:'/markers/new',
			 		type:"POST",
			 		contentType:"application/json",
			 		datatype:"json",
			 		data:JSON.stringify(doc)
			 	})).then(function(result){
			 		$('#add-marker-modal').find('.cancel').trigger('click');
			 		resolve(doc);
			 	}).catch(function(err){
			 		reject(err);
			 	});
			});

			$('#new-marker-form').find('.cancel').on('click',function(e){
				e.preventDefault();
				$('#new-marker-form').find('input').val('');
				$('#new-marker-form').foundation('reveal','close');
			});

			$('#add-marker-modal').find('#new-marker-name').text(marker);
			$('#new-marker-form').find('input[name=id]').val(marker);
			$('#add-marker-modal').foundation('reveal','open');

		});
		return promise;

	};

	/* When adding a new haplotype ensure the value is not already on the page
	 * if it is, raise an error warning. Takes three arguments,
	 * value: the value being compared against
	 * input: the input id prefix that is being searched
	 * context: the exact id of the current value
	 */
	var existsOnPage = function(value){
		var allValues = $('.haplotype-cell').find('input');
		for (var i = 0; i < allValues.length; i++ ){
			if ($(allValues[i]).val() == value){
				return true;
			}
		}
		return false;
	};

	var checkWidth = function(){
		var ele = document.getElementById('haplotypes');
		var ele2 = document.getElementById('haplotype-wrapper');
		if (ele.offsetWidth < ele2.scrollWidth){
			$('#haplotypes').closest('.columns').addClass('scrollit2');
		} else {
			$('#haplotypes').closest('.columns').removeClass('scrollit2');
		}
	}


	var generateRowHtml = function(response){
		var html = '<tr class="haplotype-row" data-id="' + response._id + '"">'
		html += '<td class="haplotype-cell"><span>' + response.haplotype + '</span>'
		html += '<div class="row collapse postfix-radius" style="display:none;min-width:250px">'
		html += '<div class="large-8 small-8 medium-8 columns">'
		html += '<input type="text" disabled=disabled value="'+ response.haplotype +'">'
		html += '<small class="error" style="display:none">Unique Name Required</small>'
		html +=	'</div><div class="large-4 small-4 medium-4 columns"><a href="#" class="postfix">Done</a></div></div></td>'

		var markers = $('#haplotypes').find('th[id^=marker-rs]').map(function(ind,item){ return  $(item).text();});
		for (var i = 0; i < markers.length; i++){
			html+='<td class="marker use-ref text-center">' + $('#' + markers[i]).find('.ref').text() + '</td>'
		}
		html += '<td class="text-center"><a href="#" class="remove button tiny radius" style="margin-bottom:0px;"><i class="fi-x"></i></a></td>'
		return html;
	}

	/* add all handlers to a new haplotype field
	 * Accepts one argument "parent". Parent 
	 * like the name suggest is the parent fieldset. if it is not
	 * defined, handlers are bound to ALL things that meet the find criteria
	 * on the page*/

	var markerCellHandlers = function(context){
		//if no context then this is being applied to the whole document
		//otherwise this is being applied to a specifc marker box
		if (!context)
			context = $(document).find('.marker');
		context.on('click',function(){
			var index = $(this).index();
			var identifer = $('#haplotypes').find('thead').find('th:nth-child(' + ( index + 1 ) + ')').text();
			var info = $('#' + identifer);
			if ($(this).hasClass('use-alt')){
				$(this).removeClass('use-alt').addClass('use-ref');
				$(this).text(info.find('.ref').text());
			} else {
				$(this).removeClass('use-ref').addClass('use-alt');
				$(this).text(info.find(".alt").text());
			}
		});
	}

	var haploCellHandlers=function(context){
		if (!context)
			context = $(document).find('.haplotype-cell');


		context.on('click',function(){
			if (!$(this).hasClass('opened')){
				$(this).addClass('opened');
				$(this).find('span').hide();
				$(this).find('.row').show();
				$(this).find('input').attr('disabled',false);
			}
		});

		context.find('.postfix').on('click',function(e){
			e.preventDefault();
			var _this = this, val,valid = true,testVal;
			var input = $(this).closest('.row').find('input');
			val = input.val();
			//perform validation now to ensure this is a unique value
			var allOtherCells = $('.haplotype-cell').not($(this).closest('.haplotype-cell')).find('input');
			for ( var i = 0; i < allOtherCells.length; i++){
				testVal = $(allOtherCells[i]).val();
				if (testVal == val ) valid  = false
			}

			if (valid){
				input.attr('disabled','disabled');
				$(this).closest('.row').hide('fast',function(){
					$(_this).closest('td').removeClass('opened').find('span').text(val).show()
				});

			} else {
				$(this).closest('.row').find('.error').show().siblings('input').addClass('error');
			}
		})

		context.find('input').on('keyup',function(){
			if ($(this).hasClass('error')){
				$(this).removeClass('error');
				$(this).siblings('small').hide();
			}
		});
	}

	var removeHandler = function(context){
		if (!context)
			context = $(document).find('.remove');
		
		context.on('click',function(e){
			e.preventDefault();
			$(this).closest('tr').hide();
		});

	}

	var haploPageHanlders = function(){
		$('.close-box').on('click',function(e){
			e.preventDefault();
			$(this).closest('.alert-box').hide();
		});

		$('#save').on('click',function(e){
			e.preventDefault();
			var toRemove = serializeRemovedHaplotypes();
			var markersToAdd = serializeMarkers();
			console.log(markersToAdd);
			serializeInput().then(function(result){
				var promises = [];
				console.log(result);
				if (result.length > 0){
					$.each(result,function(ind,item){
						var promise = Promise.resolve($.ajax({
							url:'/database/haplotypes/update',
							type:"POST",
							contentType:'application/json',
							datatype:'json',
							data:JSON.stringify(item)
						}));

						promises.push(promise);
					});

					return Promise.all(promises).then(function(result){
						var ok = true,o;
						for (var i = 0; i < result.length; i++ ){
							o = JSON.parse(result[i])
							if (o.status != 'ok')
								ok = false;
						}
						if (!ok){
							$('#error-display-message').text("A problem was encountered when trying to update the database. Please check your haplotypes or contact an administartor");
							$('#error-display-box').addClass('warning').removeClass('secondary').show();
						} else {
							$('#error-display-message').text("Data has been succesfully updated");
							$('#error-display-box').addClass('secondary').removeClass('warning').show();
						}
					}).then(function(){
						if (toRemove.length > 0){
							var promises = []
							$.each(toRemove,function(ind,item){
								var promise = Promise.resolve($.ajax({
									url:'/database/haplotypes/delete?id='+item + '&type=haplotype&gene=' + window.location.pathname.split('/').splice(-1)[0],
									type:'POST',
									dataType:'json'
								}));

								promises.push(promise);
							});

							return Promise.all(promises);
						}
						return [];
					}).then(function(result){
						return Promise.resolve($.ajax({
							url:'/database/haplotypes/markers?gene=' + window.location.pathname.split('/').splice(-1)[0],
							type:'POST',
							contentType:'application/json',
							dataType:'json',
							data:JSON.stringify(markersToAdd)
						}));
					}).then(function(result){
						if (result.status == 'ok'){
							$('td:hidden').remove();
							$('th:hidden').remove();
						}
					});
				} else {
					$('#delete').trigger('click');
					return;
				} 

			}).catch(function(err){
				type = Object.prototype.toString.call(err);
				if (type == '[object String]'){
					$('#error-display-message').text(err);
					$('#error-display-box').removeClass('secondary').addClass('warning').show();

				} else if (type == '[object Array]') {
					if (toRemove.length  === 0){
						$('#error-display-box').addClass('secondary').removeClass('warning').show();
						$('#error-display-message').text('There is nothing to save! Please make some changes and then submit again.')
					}
					

				} else if (type == '[object Error]'){
					$('#error-display-message').text(err.message);
					$('#error-display-box').removeClass('secondary').addClass('warning').show();
				}
			});
		})
		

		$('.marker-status').on('click',function(e){
			e.preventDefault();
			var id = $(this).closest('tr').attr('id')
			var _this = this;
			var promise;
			if ($(this).hasClass('added')){
				//Remove the marker
				Promise.resolve().then(function(){
					//find the index of the current column
					var index = $('#haplotypes').find('#marker-' + id).index()
					$('#haplotypes').find('#marker-' + id).hide();
					$(_this).removeClass('added').addClass('unadded').text('Add')
					$('#haplotypes').find('tbody').find('tr').each(function(ind,item){
						$(this).find('td:nth-child(' + (index + 1) + ')').hide();
					});
					if ($(_this).hasClass('new-added')){
						$(_this).removeClass('new-added')
					} else {
						$(_this).addClass('new-removed');
					}

				}).then(function(){
					checkWidth();
				});
				
			} else if ($(this).hasClass('unadded')){
				$('#haplotypes').show();
				$(_this).removeClass('unadded').addClass('added').text('Remove')
				if ($(_this).hasClass('new-removed')){
					$(_this).removeClass('new-removed');
				} else {
					$(_this).addClass('new-added');
				}

				if ($('#marker-' + id).length > 0){
					$('#marker-' + id).show();
					var index = $('#marker-' + id).index();
					var rows =  $('.haplotype-row');
					for (var i = 0; i < rows.length; i++ ){
						$(rows).find('td').eq(index).show();
					}
				} else {
					Promise.resolve().then(function(){
						var headers = [id];
						$('#haplotypes').find('th[id^=marker-rs]').each(function(ind,item){
							headers.push($(item).text());
						});
						headers = headers.sort();
						var point = headers.indexOf(id);
						var html1 = "<th id='marker-" + id + "'><a href=#>"+id+"</a></th>";
						var html2 = "<td class='marker use-ref text-center'>" + $('#' + id).find('.ref').text()  + "</td>";
						$('#haplotypes').find('thead').find('th').eq(point).after(html1)
						$('#haplotypes').find('tbody').find('tr').each(function(ind,item){
							return $(item).find('td').eq(point).after(html2)
						}).each(function(ind,item){
							markerCellHandlers($(item).find('td').eq(point + 1));
						});
					}).then(function(){
						checkWidth();
					});
				}
			}
		})

			
		$('#add-new-haplotype').on('click',function(e){
			e.preventDefault();
			var input = $('#new-haplotype');
			var val = input.val();
			var gene = window.location.pathname.split('/').splice(-1)[0];
			$('#new-haplotype').trigger('keyup');
			if (val == "" ){
				input.addClass('error').siblings('small').text('Haplotype required').show();
				return false;
			} else if (existsOnPage(val)){
				input.addClass('error').siblings('small').text('Haplotype already exists').show();
				return false;
			} else {
				Promise.resolve($.ajax({
					url:'/database/haplotypes/new?id='+val+'&gene=' + gene,
					type:'POST',
					dataType:'json'
				})).then(function(response){
					if (response.statusCode == 200 ){
						var html = generateRowHtml(response);
						$("#haplotypes").find('tbody').append(html);
						var row = $("#haplotypes").find('tbody').find('tr').last();
						haploCellHandlers($(row).find('.haplotype-cell'));
						$(row).find('.marker').each(function(ind,item){markerCellHandlers($(item));});
						removeHandler($(row).find('.remove'));
					} else {
						input.addClass('error').siblings('small').text(response.message).show();
					}
				});

			}
		});

		$('#new-haplotype').on('keyup',function(e){
			if ($(this).hasClass('error'))
				$(this).removeClass('error').siblings('small').hide()
		});		

		
	};
	/* When the user is about make a delete, confirm they want to
	 * do so.
	 */
	var confirmDelete = function(context){
		$(context).on('click',function(e){
			e.preventDefault();
			$('#confirm-delete').foundation('reveal','open');
		});

		$('#confirm-delete').find('.success').on('click',function(e){
			$(this).closest('#confirm-delete').foundation('reveal','close');
			Promise.resolve($.ajax({
				url:'/database/haplotypes/delete?type=all&gene='+window.location.pathname.split('/').splice(-1)[0],
				type:"POST",
				contentType:'application/json',
				dataType:'json'
			})).then(function(result){
				console.log(result);
				if (result.status == 'ok') {
					window.location.reload();
				} else {
					$('#error-display-message').text(result.message);
					$('#error-display-box').removeClass('secondary').addClass('warning').show();
				}
			}).catch(function(err){
				console.log(err);
			});
		});

		$('#confirm-delete').find('.cancel').on('click',function(e){
			$(this).closest('#confirm-delete').foundation('reveal','close');
		});
	};

	/* match funcion for the searchbar */
	var matchSearch = function(input){
		var val = $('#search-box').val();
		var re = new RegExp(val,'g','i');
		if ( val === '' )
			return true;
		else if (input.match(re) !== null)
			return true;
		return false;
	};


	/* handlers for all pages. These functions contain static page specific
	 * handlers, as well as determining which handlers to dynamically call and
	 * add to the current page
	 */
	var staticHandlers = {
		//all haplotype collections
		index:function(){
			$('#add-new-gene').on('click',function(e){
				e.preventDefault();
				$(this).hide().siblings('ul').show()
				$("#submit-new-gene-form").show();
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

			/* Once the Gene form has been validated send the form information
			 * to the server to be added to the databse. Upon a succesful entry
			 * navigate to the new gene's drug recommendation page */
			$('#submit-new-gene-form').on('valid.fndtn.abide',function(e){
				var val = $('#new-gene-name').val().replace('/');
				var type = $('#new-gene-type').find('option:selected').data('id');

				Promise.resolve($.ajax({
					url:'/database/dosing/new?gene=' + val+ "&type="+ type,
					type:"POST",
					contentType:'application/json',
					dataType:'json'
				})).then(function(result){
					if (result.statusCode == 200){
						window.location.replace('/haplotypes/current/' + val);
					} else if ( result.statusCode == 500 ){
						window.location.replace('/haplotypes/current/' + val);
					} else {
						$('#error-display-message').text(result.message);
						$('#error-display-box').slideDown();
					}
				}).catch(function(err){
					console.log(err);

				});
			});

			$('.haplotype-row').on('click',function(e){
				e.preventDefault();
				var path = "/haplotypes/current/" + $(this).data('name').toString();
				window.location.replace(path);
			});

			$('#search-box').on('keyup',function(){
				var currentRows = $('.haplotype-row');
				for (var i=0; i < currentRows.length; i++ ){
					if (!matchSearch($(currentRows[i]).data('name')))
						$(currentRows[i]).hide();
					else 
						$(currentRows[i]).show();
				}
			});
		},
		//new haplotype collection
		//Existing haplotype collection
		current:function(){
			confirmDelete('#delete',window.location.pathname);
			haploPageHanlders();
			removeHandler();
			markerCellHandlers();
			haploCellHandlers();		
		}
	};

	var renderAllHaplotypes = function(){
		return Promise.resolve($.ajax({
			url:'/database/dosing/classes',
			type:'GET',
			dataType:'json'
		})).then(function(result){
			classes = result;
			return Promise.resolve($.ajax({
				url:'/database/haplotypes/getgenes',
				type:'GET',
				contentType:'application/json'
			}));
		}).then(function(result){
			var gene,hap,obj,i;
			//a bit of massagig the data into the proper format
			return templates.haplotypes.index({haplotypes:result,classes:classes});
		}).then(function(renderedHtml){
			return $('#main').html(renderedHtml);
		}).then(function(){
			utility.refresh();
		}).then(function(){
			staticHandlers.index();
		});

	}
	var renderCurrentHaplotype = function(location){
		var gene = location.split('/').pop();
		var hapInfo;
		Promise.resolve($.ajax({
			url:'/database/haplotypes/getgenes/' + gene,
			contentType:'application/json',
			type:"GET"
		})).then(function(result){
			result.location = location;
			return templates.haplotypes.current(result);
		}).then(function(renderedHtml){
			return $('#main').html(renderedHtml);
		}).then(function(){
			//return templates.haplotypes.haplotype(hapInfo);
		}).then(function(renderedHtml){
			//return $('#haplotypes').html(renderedHtml);
		}).then(function(){
			utility.refresh();
		}).then(function(){
			staticHandlers.current();
		});
	}
	//Main function will render the page based on the specified URL
	var main = function(){
		var promise;
		var location = window.location.pathname;
		var classes;
		if (location === '/haplotypes'){
			renderAllHaplotypes()
			
		} else if (location.match(/haplotypes\/current\/.+/) !== null){
			renderCurrentHaplotype(location);
			
		}
		
	};
	$(document).ready(function(){
		return main();
	});
})();