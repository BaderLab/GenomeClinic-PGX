var $ = require("jquery"),
	templates = require('./templates'),
	utility = require('./utility'),
	pgxConstants = require('../../server/conf/constants.json').dbConstants.PGX;

module.exports = function(){


	var markerRowHandler = function(context){
		var refreshClick  = function(context){
			$(context).on('click',function(){
				$(this).off('click');
				if ($(this).find('.edit:visible').length === 0)
					$(this).find('.edit').show().closest(this).find('.static-marker-field').hide();
			});
		};

		var sel;
		if (context)
			sel = $(context).find('.marker-row');
		else
			sel = $('.marker-row');

		sel.on('click.row',function(){
			$(this).off('click');
			if ($(this).find('.edit:visible').length === 0)
				$(this).find('.edit').show().closest(this).find('.static-marker-field').hide();
		});

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

		sel.on('valid',function(){
			console.log('here');
		})	

	}


	var statichandlers = function(){
		var serializeNewMarker = function(){
			var input = {};
			var serial = $("#new-marker-form").serializeArray();
			serial.map(function(item){
				if (item.name == 'alt')
					input[item.name] = item.value.toLowerCase().split(/[\,\s]/g);
				else if (item.name == 'pos')
					input[item.name] = parseInt(item.value);
				else
					input[item.name] = item.value.toLowerCase();
			});
			return input;
		}	

		//handlers for adding new field
		$('#marker-new').on('click',function(e){
			e.preventDefault();
			$(this).closest('div').hide().parents().find('#new-marker').slideDown(250);
		});

		$('#cancel-new-marker').on('click',function(e){
			e.preventDefault();
			$(this).closest('form').find('input').val("");
			$('#new-marker').slideUp(250,function(){
				$('#marker-new').closest('div').show();
			});
		});

		$('#submit-new-marker').on('click',function(e){
			e.preventDefault();
			var form = serializeNewMarker();
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
					$('#markers').prepend(renderedHtml);
				}).catch(function(err){
					console.log(err)
				})
			}
		});
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
			return  templates.markers.row({markers:result})
		}).then(function(renderedHtml){
			return $('#markers').append(renderedHtml);
		}).then(function(){
			utility.refresh();
			utility.bioAbide();
			statichandlers();
			markerRowHandler();
		});
	}

	main();
};