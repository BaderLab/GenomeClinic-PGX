var utils = require('../conf/utils');
var pgx = require('../conf/pgx_haplotypes.json');
var Promise = require('bluebird');
var constants = require("../conf/constants.json");



module.exports = function(app,dbFunctions){
	if (!dbFunctions)
		dbFunctions = rquire("../src/mongodb_functions");
	//==================================================================
	//PGX routes
	//==================================================================
	app.post("/pgx", utils.isLoggedIn, function(req,res){
		var currentPatientID= req.body[constants.dbConstants.PATIENTS.ID_FIELD];
		dbFunctions.getPGXVariants(currentPatientID)
		.then(function(result) {
			// Return all PGx information: variants from this patient along
			// with all PGx haplotype and marker data. Also return the patient
			// ID to ensure we're returning the correct patient (in case 
			// multiple clicks are happening and there's a delay in the response).
			var allPGXDetails= {
				"pgxGenes": pgx.pgxGenes,
				"pgxCoordinates": pgx.pgxCoordinates,
				"patientID": currentPatientID,
				"variants": result.variants,
				"report-footer": result["report-footer"],
				"disclaimer": result.disclaimer
			};

			return Promise.resolve(allPGXDetails);
		}).then(function(result){
			res.send(result);
		});
	});
};