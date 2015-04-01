var $  = require('jquery'),
	templates = require('./templates'),
	utility = require('./utility');

module.exports = function(){

	//var refreshHanlders = function(){
	//	$('')

	//	}
	serializeInput = function(){
		var currHap;
		var outObj = {};
		var haplotypes = $('fieldset');
		var geneName = $('#gene-name').is('input') ? $('#gene-name').val() : $('#gene-name').text().substring(1)		;
		for (var i = 0; i < haplotypes.length; i++ ){
			currHap = $(haplotypes[i]).find('[id^=haplo-name-]').val();
			outObj[currHap] = [];
			var ids = $(haplotypes[i]).find("tbody").find(".marker-id");
			for (var j = 0; j < ids.length; j++){
				outObj[currHap].push($(ids[j]).text());
			}
		}
		return {gene:geneName,haplotypes:outObj};
	};

	var revealModal = function(marker){
		var promise = new Promise(function(resolve,reject){
			$('#new-marker-form').on('valid',function(e){
				var form = $(this).serializeArray();
				var doc = {};
				for (var i=0; i<form.length; i++){
					if (form[i].name == 'pos')
						doc[form[i].name] = parseInt(form[i].value);
					else if(form[i].name == 'alt')
						doc[form[i].name] = form[i].value.toLowerCase().split(/[\,\s]/g);
					else
						doc[form[i].name] = form[i].value.toLowerCase();
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

	var valueNotOnPage = function(value,input,context){
		var allValues = $('input[id^='+input+']:not([id=' + context + '])')
		for (var i = 0; i < allValues.length; i++ ){
			if ($(allValues[i]).val() == value){
				$('#'+context).addClass('error').siblings('small').show();
				return false;
			}
		}
		$('#'+context).removeClass('error').siblings('small').hide();
		return true;
	};

	var allPageHandlers = function(){
		$('.remove-row').on('click',function(e){
			e.preventDefault();
			$(this).closest('tr').remove();

		});

		utility.refresh();
	};

	var staticHandlers = {
		index:function(){
			$('.haplotype-row').on('click',function(e){
				e.preventDefault();
				var path = "/haplotypes/current/" + $(this).data('name').toString();
				window.location.replace(path);
			});
		},
		new: function(){
			

		},
		current:function(){
			$('#edit-page').on('click',function(e){
				e.preventDefault();
				$(this).hide();
				$(document).find('.edit:not(input)').toggle();
				$(document).find('input.edit').attr('disabled',false);
			});
			$('#submit-changes').on('click',function(e){
				var _this = this;
				e.preventDefault();
				if ($('.haplo-error:visible').length === 0){
					Promise.resolve($.ajax({
						url:window.location.pathname,
						type:"POST",
						contentType:'application/json',
						datatype:'json',
						data:JSON.stringify(serializeInput())
					})).then(function(result){
						$(_this).parents().find('#edit-page').show();
						$(document).find('.edit:not(input)').toggle();
						$(document).find('input.edit').attr('disabled',true);
					});
				}
			});
			$('#cancel-changes').on('click',function(e){
				e.preventDefault();
				window.location.reload();
			});

			$('input[id^=haplo-name-]').on('keyup',function(){
				var context = $(this).attr('id');
				var value = $(this).val();
				valueNotOnPage(value,'haplo-name-',context);
			});

			$('input[id^=haplo-name-]').on('click',function(){
				var context =$(this).attr('id');
				var value = $(this).val();
				valueNotOnPage(value,'haplo-name-',context)
			});

			$('.haplo-add-new').on('click',function(e){
				e.preventDefault();
				var _this = this;
				var value = $(this).closest('.collapse').find('.haplo-add-new-context').val().toString();
				if (value !== ""){
					$(this).closest('.collapse').find('.haplo-add-new-context').val("");
					//eventually an ajax call
					Promise.resolve($.ajax({
						url:"/database/haplotypes/getmarkers/" + value,
						type:"GET",
						contentType:"application/json"
					})).then(function(result){
						var promise;
						if ($.isEmptyObject(result)) {
							promise = revealModal(value);
						} else {
							var out = result[value];
							out.id = value;
							promise = Promise.resolve(out );
						}
						return promise;
					}).then(function(result){
						return templates.haplotypes.row(result);
					}).then(function(renderedHtml){
						return $(_this).closest('fieldset').find('tbody').append(renderedHtml);
					}).then(function(){
						allPageHandlers();
					});
				}
			});
			utility.bioAbide();
			//valid is deprecated
			
		}
	};

	var main = function(){
		var promise;
		var location = window.location.pathname;
		if (location === '/haplotypes'){
			return Promise.resolve($.ajax({
				url:'/database/haplotypes/getgenes',
				type:'GET',
				contentType:'application/json'
			})).then(function(result){
				var gene,hap,obj,i;
				for (gene in result){
					if (result.hasOwnProperty(gene) ){
						result[gene].numHap = Object.keys(result[gene]).length;
						obj ={};
						for (hap in result[gene]) {
							if (result[gene].hasOwnProperty(hap)){
								for (i=0;i < result[gene][hap].length; i++){
									obj[result[gene][hap][i]] = 1;
								}

							}
						}
						result[gene].numMark = Object.keys(obj).length;
					}
				}

				return templates.haplotypes.index({haplotypes:result});
			}).then(function(renderedHtml){
				return $('#main').html(renderedHtml);
			}).then(function(){
				staticHandlers.index();
				allPageHandlers();
			});
		} else if (location === "/haplotypes/new"){
			templates.construction()
			.then(function(renderedHtml){
				$('#main').html(renderedHtml);
			});
		} else if (location.match(/haplotypes\/current\/.+/) !== null){
			var gene = location.split('/').pop();
			Promise.resolve($.ajax({
				url:'/database/haplotypes/getgenes/' + gene,
				contentType:'application/json',
				type:"GET"
			})).then(function(result){
				return templates.haplotypes.current(result);
			}).then(function(renderedHtml){
				return $('#main').html(renderedHtml);
			}).then(function(){
				staticHandlers.current();
				allPageHandlers();
			});
		}
		
	};
	return main();
};