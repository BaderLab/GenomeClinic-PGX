/* Templates to be rendered and precompiled prior to be sent to webpage
 * @author Patrick Magee
 */
var statuspageIndex = require('../templates/status-page.hbs'),
	statuspageRow = require('../templates/status-page-add-status-row.hbs'),
	uploadpageVcf = require('../templates/upload-add-vcf.hbs'),
	uploadpageProgress = require('../templates/upload-add-progress-bar.hbs'),
	projectIndex = require('../templates/project.hbs'),
	projectNew = require('../templates/project-add-project.hbs'),
	projectInfo = require('../templates/project-info-page.hbs'),
	projectUser = require('../templates/project-auth-user.hbs'),
	patient = require('../templates/patients-table.hbs'),
	pgx = require('../templates/pgx-page.hbs'),
	config = require('../templates/server-config.hbs'),
	phase_page = require('../templates/phase-page.hbs'),
	phase_current = require('../templates/phase-current.hbs'),
	marker_add_row = require('../templates/marker-add-marker.hbs'),
	dosing_page = require('../templates/dosing-page.hbs'),
	dosing_current = require('../templates/dosing-current.hbs'),
	dosing_new = require('../templates/dosing-new.hbs'),
	dosing_future = require('../templates/dosing-future.hbs'),
	dosing_rec_page = require('../templates/dosing-recommendation-page.hbs'),
	dosing_rec_rec = require('../templates/dosing-recommendation-recs.hbs'),
	dosing_rec_future = require('../templates/dosing-recommendations-future.hbs'),
	dosing_haplo = require('../templates/dosing-haplotypes.hbs'),
	dosing_add = require('../templates/dosing-additional-gene.hbs'),
	spinner = require('../templates/spinner.hbs');


var Handlebars = require('hbsfy/runtime');
/* return a promisfied version of the template that accepts a single parameter
 * o to render the template */
var _t = function(t){
	return function p (o){
		return Promise.resolve().then(function(){
			return t(o);
		});
	};
};

(function(){
	/* Handlebars template helpers
	 * there are certain cases where nomral templating is not enough.
	 * in order to properly render the page custom runtime Handlebars helpers
	 * must be used in order to properly render the page. Add all the helpers
	 * below here.
	 */

	// Simple helper to take a value and increase it by one
	Handlebars.registerHelper("inc", function(value,options){
		return parseInt(value) + 1
	});


	/* Helper for looping over a group of classes that were sent to the client
	 * it takes the Class Object as the first argument followed by the Type of the 
	 * Class. then you pass it the gene. Additionally this will render a block
	 * of html text 
	 */
	Handlebars.registerHelper("classIter",function(classObj,type,gene, block){
		accum = ";"
		var list = classObj[type];
		for (var i=0; i < list.classes.length; i++ ){
			accum+= block.fn(list.classes[i]);
		}
		return accum;
	});

	/* Lookup information within a classObj given an id and a property.
	 * Return the value */
	Handlebars.registerHelper('lookUpIdInfo',function(classObj, id, prop){
		return classObj[id][prop];
	})

	/* An if black, if the marker has been added then return true, else
	 * return false */
	Handlebars.registerHelper('ifIdAdded', function(classObj,id,options){
		var fnTrue = options.fn, fnFalse = options.inverse;
		return classObj[id].added == true ? fnTrue() : fnFalse();
	});

	//bind the templates object to the global window 
	window.templates = {
		//Main Index home page content
		
		//Spinner used for laoding
		spinner:_t(spinner),

		//Page to check the status of the current uploads
		statuspage:{
			index:_t(statuspageIndex),
			row:_t(statuspageRow)
		},

		//Templates for the the uploadpage
		uploadpage:{
			vcf:_t(uploadpageVcf),
			progress:_t(uploadpageProgress)
		},

		//Templates for the Project
		project:{
			index:_t(projectIndex),
			new:_t(projectNew),
			info:_t(projectInfo),
			user:_t(projectUser)
		},

		//Templates for the patient page
		patient:_t(patient),

		//Templates for the PGX analysis page
		pgx:_t(pgx),

		//Templates for the configuration page
		config:_t(config),

		//Templates for the haplotypes
		haplotypes:{
			index:_t(phase_page),
			current:_t(phase_current)
		},

		//Templates for the Markers
		markers:{
			row:_t(marker_add_row)
		},

		//Templates for the drugs
		drugs:{
			index:_t(dosing_page),
			current:_t(dosing_current),
			new:_t(dosing_new),
			future:_t(dosing_future),
			haplo:_t(dosing_haplo),
			gene:_t(dosing_add),
			//templates to handle the recommendations
			rec:{
				index:_t(dosing_rec_page),
				recs:_t(dosing_rec_rec),
				future:_t(dosing_rec_future)
			}
		}
	};
})()