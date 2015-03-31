var $  = require('jquery'),
	templates = require('./templates'),
	utility = require('./utility');

module.exports = function(){

	//var refreshHanlders = function(){
	//	$('')

//	}

/*	var staticHandlers = function(){
		
		$('#add-new-haplotype').on('click',function(e){
			e.preventDefault();
			return templates.haplotypes.haplotype()
			.then(function(renderedHtml){
				console.log(renderedHtml);
				return $('#haplotypes').append(renderedHtml);
			});
		});
	};
*/
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
			})
			.then(function(renderedHtml){
				return $('#main').html(renderedHtml);
			});
		} else if (location === "/haplotypes/new"){
			templates.construction()
			.then(function(renderedHtml){
				$('#main').html(renderedHtml);
			});
		} else if (location.match(/haplotypes\/current\/.+/) !== null){
			templates.construction()
			.then(function(renderedHtml){
				$('#main').html(renderedHtml);
			});
		}
	};
	return main();
};