var $  = require('jquery'),
	templates = require('./templates'),
	utility = require('./utility');

var constants = require('../../server/conf/constants.json').dbConstants.PGX;

module.exports = function(){
	serializeInput = function(){
		var promise = new Promise(function(resolve,reject){
			var currHap,err;
			var outObj = {};
			var haplotypes = $('fieldset');
			var geneName = $('#gene-name').is('input') ? $('#gene-name').val() : $('#gene-name').text().substring(1);
			geneName = geneName.toLowerCase();
			for (var i = 0; i < haplotypes.length; i++ ){
				currHap = $(haplotypes[i]).find('[id^=haplo-name-]').val();
				if (currHap == ''){
					$(haplotypes[i]).find('[id^=haplo-name-]').addClass('error').siblings('small').show();
					err = true;
				}
				outObj[currHap] = [];
				var ids = $(haplotypes[i]).find("tbody").find(".marker-id");
				for (var j = 0; j < ids.length; j++){
					outObj[currHap].push($(ids[j]).text().toLowerCase());
				}
			}
			if (err){
				reject( new Error());
			}
			resolve({gene:geneName,haplotypes:outObj});
		});
		return promise;
	};

	var revealMarkerModal = function(marker){
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

	var addNewHaplotype = function(context){
		$(context).on('click',function(e){
			e.preventDefault();
			var opt = {index:$('fieldset').length}
			templates.haplotypes.haplotype(opt)
			.then(function(renderedHtml){
				return $('#haplotypes').prepend(renderedHtml);
			}).then(function(){
				var context = $('#haplotypes').find('fieldset').first();
				haplotypeHandlers(context);
				allPageHandlers(context);
			}).then(function(){
				$('#haplotypes').find('fieldset').first().slideDown(400);
			});
		});
	}

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

	var removeItem = function(context,toRemove,action,child,subset){
		var item;
		if (subset)
			item = $(subset).find(context);
		else
			item = $(context); 
		item.on(action,function(e){
			e.preventDefault();
			if (child)
				$(this).closest(toRemove).slideUp(400,function(){$(this).remove();});
			else $(toRemove).slideUp(400,function(){$(this).remove();});
		});
	}


	var haplotypeHandlers = function(parent){
		var p;
		if (parent)
			p = $(parent);
		else
			p = $(document);

		p.find('input[id^=haplo-name-]').on('keyup',function(){
			var context = $(this).attr('id');
			var value = $(this).val();
			valueNotOnPage(value,'haplo-name-',context);
		});

		p.find('input[id^=haplo-name-]').on('click',function(){
			var context =$(this).attr('id');
			var value = $(this).val();
			valueNotOnPage(value,'haplo-name-',context)
		});

		p.find('.haplo-add-new-context').on('click',function(e){
			if ($(this).hasClass('error'))
				$(this).removeClass('error').siblings('small').hide();
		});

		p.find('.haplo-add-new').on('click',function(e){
			e.preventDefault();
			var curValues = [];
			var _this = this;
			var value = $(this).closest('.collapse').find('.haplo-add-new-context').val().toString().toLowerCase();
			var curIds = $(this).closest('fieldset').find('.marker-id');
			for (var i=0; i< curIds.length; i++ ){
				curValues.push($(curIds[i]).text());
			}
			$(this).closest('.collapse').find('.haplo-add-new-context').val("");

			if (value !== "" && curValues.indexOf(value) === -1 ){
				Promise.resolve($.ajax({
					url:"/database/haplotypes/getmarkers/" + value,
					type:"GET",
					contentType:"application/json"
				})).then(function(result){
					var promise;
					if ($.isEmptyObject(result)) {
						promise = revealMarkerModal(value);
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
			} else if (curValues.indexOf(value) !== -1){
				$(this).closest('fieldset').find('.haplo-add-new-context').addClass('error').siblings('small').show();
			}
		});
	}
	var confirmDelete = function(context, url){
		$(context).on('click',function(e){
			e.preventDefault();
			$('#confirm-delete').foundation('reveal','open');
		});

		$('#confirm-delete').find('.success').on('click',function(e){
			Promise.resolve($.ajax({
				url:url,
				type:"DELETE",
				contentType:'application/json'
			})).then(function(result){
				window.location.replace('/haplotypes');
			}).catch(function(err){
				console.log(err);
			});
		});

		$('#confirm-delete').find('.cancel').on('click',function(e){
			$(this).closest('#confirm-delete').foundation('reveal','close');
		});
	}

	var submitChanges = function(context,_new){
		$(context).on('click',function(e){
			var gene;
			var _this = this;
			e.preventDefault();
			if ($('fieldset').length > 0){
				serializeInput().then(function(result){
					gene = result.gene;
					if ($('.haplo-error:visible').length === 0){
						return Promise.resolve($.ajax({
							url:window.location.pathname,
							type:"POST",
							contentType:'application/json',
							datatype:'json',
							data:JSON.stringify(result)
						}));
					}
				}).then(function(result){
					if (_new){
						window.location.replace('/haplotypes/current/' + gene);
					} else {
						$(_this).parents().find('#edit-page').show();
						$(document).find('.edit:not(input)').toggle();
						$(document).find('input.edit').attr('disabled',true);
					}
				}).catch(function(err){
					console.log(err);
				});
			} else if ($('fieldset').length === 0 && !_new){
				$('#delete').trigger('click');
			};
		});
		$('#cancel-changes').on('click',function(e){
			e.preventDefault();
			if (_new)
				window.location.replace('/haplotypes');
			else 
				window.location.reload();
		});
	}


	var matchSearch = function(input){
		var val = $('#search-box').val();
		var re = new RegExp(val,'g','i');
		if ( val === '' )
			return true;
		else if (input.match(re) !== null)
			return true;
		return false;
	};

	var allPageHandlers = function(context){
		removeItem('.remove-row','tr','click',true,context);
		removeItem('.remove-haplotype','fieldset','click',true,context);
		utility.refresh();
	};


	var staticHandlers = {
		index:function(){
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
			})
		},
		new: function(){
			addNewHaplotype('#new-haplotype');
			haplotypeHandlers();
			allPageHandlers();
			submitChanges('#submit-changes',true);

			$('#gene-name').on('keyup',function(){
				var val = $(this).val().toUpperCase();
				var _this =this;
				utility.existsInDb(constants.GENES.COLLECTION,constants.GENES.ID_FIELD,val)
				.then(function(result){
					if (result){
						$(_this).addClass('error').siblings('small').text('Gene Already Exists').show();
					} else if ($(_this).hasClass("error")){
						$(_this).removeClass('error').siblings('small').hide();
					}
				});
			});
		},
		current:function(){
			confirmDelete('#delete',window.location.pathname);
			addNewHaplotype('#new-haplotype');
			haplotypeHandlers();
			allPageHandlers();
			submitChanges('#submit-changes');
			$('#edit-page').on('click',function(e){
				e.preventDefault();
				$(this).hide();
				$(document).find('.edit:not(input)').slideDown(300);
				$(document).find('input.edit').attr('disabled',false);
			});
			utility.bioAbide();
			
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
			templates.haplotypes.new()
			.then(function(renderedHtml){
				$('#main').html(renderedHtml);
			}).then(function(){
				staticHandlers.new();
			});
		} else if (location.match(/haplotypes\/current\/.+/) !== null){
			var gene = location.split('/').pop();
			var hapInfo;
			Promise.resolve($.ajax({
				url:'/database/haplotypes/getgenes/' + gene,
				contentType:'application/json',
				type:"GET"
			})).then(function(result){
				hapInfo =result;
				return templates.haplotypes.current(result);
			}).then(function(renderedHtml){
				return $('#main').html(renderedHtml);
			}).then(function(){
				return templates.haplotypes.haplotype(hapInfo);
			}).then(function(renderedHtml){
				return $('#haplotypes').html(renderedHtml);
			}).then(function(){
				staticHandlers.current();
			});
		}
		
	};
	return main();
};