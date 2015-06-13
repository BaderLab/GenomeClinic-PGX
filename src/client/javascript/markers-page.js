/* Module for managing the the current markers within the database
 * Serves as an interface to add and update markers
 *
 * @Patrick Magee
 */
var utility = require('./utility'),
	pgxConstants = require('../../server/conf/constants.json').dbConstants.PGX;

(function(){


	//confirm whether or not the user would like to delete the selected marker
	var confirmDeleteHanlder = function(){
		$('#confirm-delete').find('.cancel').on('click',function(e){
			e.preventDefault();
			$(this).closest('#confirm-delete').data('value','').foundation('reveal','close');
		});

		$('#confirm-delete').find('.success').on('click',function(e){
			e.preventDefault();
			var name = $(this).closest('#confirm-delete').data('value');
			Promise.resolve($.ajax({
				url:"/markers/current/" + name + "/delete",
				type:"POST",
				contentType:"application/json",
				dataType:'json'
			})).then(function(result){
				if (result['status'] == 'ok'){
					$('.marker-row[data-name=' + name +']').closest('.row').remove();
					$('#confirm-delete').foundation('reveal','close');
				} else {
					console.log(result);
				}
			});
		});
	};

	/* handlers for each marker row, loaded individually
	 * or all at once. */
	var markerRowHandler = function(context){
		/* refresh handler for specific row. the handlers are removed when
		 * you expand the row in order to allow the user to interact with
		 * the row without it closing on them */
		var refreshClick  = function(context){
			$(context).on('click',function(){
				$(this).off('click');
				if ($(this).find('.edit:visible').length === 0)
					$(this).find('.edit').show().closest(this).find('.static-marker-field').hide();
			});
		};

		var sel;
		//if context is passed add hanlders for that specific context
		if (context)
			sel = $(context).find('.marker-row');
		else
			sel = $('.marker-row');

		//Marker for row click
		sel.on('click.row',function(){
			$(this).off('click');
			if ($(this).find('.edit:visible').length === 0)
				$(this).find('.edit').show().closest(this).find('.static-marker-field').hide();
		});

		sel.find(".delete").on('click',function(e){
			e.preventDefault();
			$('#confirm-delete').data('value', $(this).closest(sel).find('.marker-name').text())
			.find('h4').text('Are you sure you want to delete the marker ' + $(this).closest(sel).find('.marker-name').text() + "?")
			.closest('#confirm-delete').foundation('reveal','open');
			//
		});
		//Cancel the current modifications, reset the values of the input to the previous values
		//and close the edit fields
		sel.find('.cancel').on('click.button',function(e){
			var fields = ['chr','pos','alt','ref'];
			e.preventDefault();
			for (var i = 0; i < fields.length; i++){
				$(this).closest('.marker-row').find('input[name=' + fields[i] + ']').val($(this).closest('form').find('input[name=' + fields[i] + ']').siblings('p').text());
			}
			$(this).closest('.marker-row').find('.edit').hide().closest('.marker-row').find('.static-marker-field').show('fast',function(){
				refreshClick($(this).closest('.marker-row'));
			});
		});


		//Form is submitted and listening for a valid even from the foundation event 
		//Trigger
		sel.on('valid.fndtn.abide',function(){
			var _this = this;
			var array = $(this).serializeArray();
			var input = serializeNewMarker(array);
			input.id = $(this).find('.marker-name').text();
			//now send the updated input to the server
			Promise.resolve($.ajax({
				url:'/markers/current/' + input.id,
				type:'POST',
				contentType:'application/json',
				dataType:'json',
				data:JSON.stringify(input)
			})).then(function(result){
				if (result.status === 'ok'){
					$(_this).find('.chr').text(input.chr)
					.closest(_this).find('.pos').text(input.pos)
					.closest(_this).find('.ref').text(input.ref)
					.closest(_this).find('.alt').text(input.alt.join())
					.closest(_this).find('.edit').hide()
					.closest(_this).find('.static-marker-field').show('fast',function(){
						refreshClick($(_this));
					});
				}
			});
		});

	}

	//Serialize the markers into an object and return the object
	var serializeNewMarker = function(array){
			var input = {};
			array.map(function(item){
				if (item.name == 'alt')
					input[item.name] = item.value.toUpperCase().split(/[\,\s]/g);
				else if (item.name == 'pos')
					input[item.name] = parseInt(item.value);
				else
					input[item.name] = item.value.toUpperCase();
			});
			return input;
		}	

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

	//Static page handlers
	var statichandlers = function(){

		$('#search-box').on('keyup',function(){
			var items = $('.marker-row');
			for (var i=0; i<items.length;i++){
				if (!matchSearch($(items[i]).find('.marker-name').text())){
					$(items[i]).hide();
				} else {
					$(items[i]).show();
				}
			}
		});
		
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

		//Send an ajax request and submit it to the new marker
		$('#submit-new-marker').on('click',function(e){
			e.preventDefault();
			var form = serializeNewMarker($("#new-marker-form").serializeArray());
			//check input.
			for (item in form) {
				if (form.hasOwnProperty(item)){
					if (form[item] == ''){
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

			if (!$('#new-marker-form').find('input').hasClass('error')){
				Promise.resolve($.ajax({
					url:'/markers/new',
					type:'POST',
					contentType:'application/json',
					dataType:"json",
					data:JSON.stringify(form)
				})).then(function(result){
					var doc = {}
					doc[form.id] = {};
					doc[form.id].chr = form.chr;
					doc[form.id].pos = form.pos;
					doc[form.id].alt = form.alt;
					doc[form.id].ref = form.ref;
					return templates.markers.row({markers:doc});
				}).then(function(renderedHtml){
					return $('#markers').prepend(renderedHtml);
				}).then(function(){
					markerRowHandler($("#markers").filter(':first'));
					$('#cancel-new-marker').trigger('click');
				}).catch(function(err){
					console.log(err)
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
		return templates.markers.index()
		.then(function(renderedHtml){
			return $('#main').html(renderedHtml);
		}).then(function(){
			return Promise.resolve($.ajax({
				url:'/database/markers/getmarkers',
				type:'GET',
				dataType:'json',
				contentType:'application/json'
			}));
		}).then(function(result){
			console.log(result);
			return  templates.markers.row({markers:result})
		}).then(function(renderedHtml){
			return $('#markers').append(renderedHtml);
		}).then(function(){
			utility.bioAbide();
			statichandlers();
			markerRowHandler();
			confirmDeleteHanlder();
		}).then(function(){
			utility.refresh();
		});
	}

	$(document).ready(function(){
		main();
	})
})();