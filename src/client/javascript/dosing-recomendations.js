var pgx = require('./pgx'),
	templates = require('./templates'),
	utility = require('./utility');


module.exports = {
	//helpers
	getHaploRecs : function(){

	},
	//handlers
	staticHandlers : function(){

	},

	//render
	render : function(){
		var pgxTemplateData, therapeuticClasses, drugRecomendations;
		//load information on patient and generate pgx info.
		var location = window.location.pathname
		var patientID = location.split('/').splice(-1)[0];
		pgx.generatePgxResults(patientID).then(function(result){
			return pgx.convertTotemplateData(result);
		}).then(function(result){
			for (var gene in result.pgxGenes){
				if (result.pgxGenes.hasOwnProperty(gene)){
					if (result.pgxGenes[gene].haplotypes.length == 0){
						delete result.pgxGenes[gene];
					} else {
						result.pgxGenes[gene].hap1 = result.pgxGenes[gene].haplotypes[0].name;
						result.pgxGenes[gene].hap2 = result.pgxGenes[gene].haplotypes[0].name;
					}
				}
			}
			console.log(result);
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
			utility.refresh();
		});

	}
}