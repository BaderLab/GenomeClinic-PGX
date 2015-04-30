var pgx = require('./pgx'),
	templates = require('./templates'),
	utility = require('./utility');


module.exports = {
	//helpers
	serializeTable : function(){
		var output = [];
		var temp;
		var rows = $('.gene-row');
		for (var i = 0; i < rows.length; i++ ){
			temp = {};
			temp.gene = $(rows[i]).find('.gene-name').text();
			temp.hap = {
				allele_1:$(rows[i]).find(".allele_1").val(),
				allele_2:$(rows[i]).find(".allele_2").val(),
			}
			temp.class = $(rows[i]).find('.therapeutic-class').val();
			output.push(temp);
		}
		return output;
	},

	getHaploRecs : function(){
		//this is a preliminary search in an attempt to cut down the amount of searching that must be done.
		var tableValues =  this.serializeTable();
		Promise.resolve($.ajax({
			url:'/database/dosing/classes/current',
			type:'POST',
			dataType:'json',
			contentType:'application/json',
			data:JSON.stringify(tableValues)
		})).then(function(result){
			var rows = $('.gene-row'),gene;
			for (var i = 0; i < rows.length; i++){
				gene = $(rows[i]).find('.gene-name').text();
				if (result.hasOwnProperty(gene)){
					$(rows[i]).find('select').val(result[gene].class);
				}
			}
		});
	},


	getRecomendations : function(){
		var tableValues = this.serializeTable();
		Promise.resolve($.ajax({
			url:'/database/dosing/recomendations/current',
			type:'POST',
			dataType:'json',
			contentType:'application/json',
			data:JSON.stringify(tableValues)
		})).then(function(result){
			console.log(result);

		})
	},
	//handlers
	staticHandlers : function(){
		var _this = this;
		$('.therapeutic-class').on('change',function(){
			_this.getRecomendations();
		})

		//submit form
		//$('form').on(valid.fndtn.abide,function(){

		//})

		

	},

	//render
	render : function(){
		var _this = this;
		var pgxTemplateData, therapeuticClasses, drugRecomendations;
		//load information on patient and generate pgx info.
		var location = window.location.pathname
		var patientID = location.split('/').splice(-1)[0];
		pgx.generatePgxResults(patientID).then(function(result){
			return pgx.convertTotemplateData(result);
		}).then(function(result){
			var genes = [];
			for (var gene in result.pgxGenes){
				if (result.pgxGenes.hasOwnProperty(gene)){
					if (result.pgxGenes[gene].possibleHaplotypes.length !== 0){
						result.pgxGenes[gene].hap1 = result.pgxGenes[gene].possibleHaplotypes[0].string;
						result.pgxGenes[gene].hap2 = result.pgxGenes[gene].possibleHaplotypes[0].string;
						genes.push(result.pgxGenes[gene]);
					}
				}
			}
			result.pgxGenes = genes;
			pgxTemplateData= result;
		}).then(function(){
			return Promise.resolve($.ajax({
				url:"/database/dosing/classes",
				type:"GET",
				dataType:"json"
			}))
		}).then(function(result){
				therapeuticClasses = result;
		}).then(function(){
			pgxTemplateData.classes = therapeuticClasses[0].classes;
			return templates.drugs.rec.index(pgxTemplateData);
		}).then(function(renderedHtml){
				$('#main').html(renderedHtml);
		}).then(function(){
			_this.staticHandlers();
		}).then(function(){
			utility.refresh();
		});

	}
}