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
		for (var i = 0; i < haplotypes.length; i++ ){
			currHap = $(haplotypes[i]).find('[id^=haplo-name-]').val()
			outObj[currHap] = [];
			var ids = $(haplotypes[i]).find("tbody").find(".marker-id")
			for (var j = 0; j < ids.length; j++){
				outObj[currHap].push($(ids[j]).text())
			}
		}
		return outObj
	};

	seriaizeNewMarkers = function(){
		var currHap,id,chr,pos,ref,alt;
		var field = ['chr','pos','ref','alt'];
		var outObj = {};
		var haplotypes = $('fieldset');
		for (var i = 0; i < haplotypes.length; i++ )
			var newRows = $(haplotypes[i]).find('tbody').find(".new-entry")
			for (var j = 0; j < newRows.length; j++ );
				id = $(newRows[i]).find('.marker-id').text();
				outObj[id] = {};

				chr = $(newRows[i]).find('.marker-chr')
	}

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
				e.preventDefault();
				$(this).parent().find('#edit-page').show();
				$(document).find('.edit:not(input)').toggle();
				$(document).find('input.edit').attr('disabled',true);
			});
			$('.haplo-add-new').on('click',function(e){
				e.preventDefault();
				var _this = this;
				var value = $(this).closest('.collapse').find('.haplo-add-new-context').val().toString();
				if (value !== ""){
					$(this).closest('.collapse').find('.haplo-add-new-context').val("");
					var opt = {id:value};
					//eventually an ajax call
					Promise.resolve(opt).then(function(result){
						return templates.haplotypes.row(result)
					}).then(function(renderedHtml){
						$(_this).closest('fieldset').find('tbody').append(renderedHtml);
					});
				}
			});
		}
	};

	var main = function(){
		var location = window.location.pathname
		if (location === '/haplotypes'){
			return Promise.resolve($.ajax({
				url:'/databse/haplotypes/getGenes',
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
			})
		} else if (location === "/haplotypes/new"){
			templates.construction()
			.then(function(renderedHtml){
				$('#main').html(renderedHtml);
			});
		} else if (location.match(/haplotypes\/current\/.+/) !== null){
			var test_opts = {
				gene:location.replace(/haplotypes\/current\//,""),
				haplotype:{
					'test1':{
						markers:[{
							id:'rs22',
							ref:'A',
							alt:'G',
							pos:'1231151'
						},
						{
							id:'rs22',
							ref:'A',
							alt:'G',
							pos:'1231151'
						},
						{
							id:'rs22',
							ref:'A',
							alt:'G',
							pos:'1231151'
						}]
					},
					'test2':{
						markers:[{
							id:'rs22',
							ref:'A',
							alt:'G',
							pos:'1231151'
						},
						{
							id:'rs22',
							ref:'A',
							alt:'G',
							pos:'1231151'
						},
						{
							id:'rs22',
							ref:'A',
							alt:'G',
							pos:'1231151'
						}]
					},
					'test3':{
						markers:[{
							id:'rs22',
							ref:'A',
							alt:'G',
							pos:'1231151'
						},
						{
							id:'rs22',
							ref:'A',
							alt:'G',
							pos:'1231151'
						},
						{
							id:'rs22',
							ref:'A',
							alt:'G',
							pos:'1231151'
						}]
					}

				}
			}

			templates.haplotypes.current(test_opts)
			.then(function(renderedHtml){
				return $('#main').html(renderedHtml);
			}).then(function(){
				staticHandlers.current();
			});
		}
	};
	return main();
};