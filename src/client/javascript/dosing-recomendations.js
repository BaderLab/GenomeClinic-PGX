var pgx = require('./pgx'),
	templates = require('./templates'),
	utility = require('./utility');


module.exports = function(){
	//helpers


	//handlers
	var staticHandlers = function(){

	};

	//render
	var main = function(){
		var pgxTemplateData, therapeuticClasses, drugRecomendations;
		//load information on patient and generate pgx info.
		var location = window.location.pathname
		var patientID = location.split('/').splice(-2,1)[0];
		pgx.generatePgxResults(patientID).then(function(result){
			return pgx.convertTotemplateData(result);
		}).then(function(result){
			pgxTemplateData= result;
		})

	};
};