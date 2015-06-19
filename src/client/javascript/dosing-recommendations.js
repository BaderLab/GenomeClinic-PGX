/* Javascript for handling the dosing recommendations form 
 * @author Patrick Magee
*/

var pgx = require('./pgx'),
	utility = require('./utility');


//container for page options to be stored in
var pageOptions = {};

/* jshint multistr:true */
var emptyFieldhtml = '<div class="row">\
						<div class="small-12 columns">\
					    	<div data-alert class="alert-box radius secondary">\
					    	<!-- Alert message goes here -->\
						      	<div class="row">\
						        	<div class="small-12 columns">\
						        	  	<p class="alert-message">{{message}}</p>\
						        	</div>\
						    	</div>\
						    </div>\
						</div>\
					</div>'

module.exports = {

	/* The PGX analysis table is the basis for all recommendations. It contains not only the haplotypes,
	 * but also the predicted Therapeutic class. The claass can be changed by the user (this will be remembered 
	 * when the user submits the new form), or it can be left the same. Serializing the table will result in an
	 * array of objects, each containing the gene name, haplotypes, as well as the therapeutic class. Returns
	 * and object. If genee only is true, only include the name of the gene in the array.
	*/
	serializeTable : function(geneOnly){
		var output = [];
		var temp;
		var rows = $('.gene-row');
		for (var i = 0; i < rows.length; i++ ){
			if (geneOnly){
				output.push($(rows[i]).find('.gene-name').text())
			} else {
				temp = {};
				temp.gene = $(rows[i]).find('.gene-name').text();
				temp.haplotypes = [
					$(rows[i]).find(".allele_1").text(),
					$(rows[i]).find(".allele_2").text()
				];
				temp.class = $(rows[i]).find('.therapeutic-class').val();
				temp._id = $(rows[i]).find('select').data('id');
				output.push(temp);
			}
		}
		return output;
	},
	/* The Physician information and the patient information must be serialized into a usable format,
	 * this function collects all the data and places it into an object separating Dr. and patient information
	 */
	serializeInputs : function(){
		var output = {};
		var temp,field;
		var fields = $('form').serializeArray();
		var currDrugs = $('.patient-drug-name');
		output.patient = {};
		output.dr = {};
		//Loop over all the fields
		for (var i = 0; i < fields.length; i++){
			if (fields[i].name.search(/^dr/) !== -1){
				field = fields[i].name.replace(/^dr-/,""); //dr- is appended to a field name that is meant for the doctor
				field = field.split('-');
				//properties are nested by adding additional '-' it will add a new document each time a new dash is came across
				if (field.length > 1){
					if (! output.dr.hasOwnProperty(field[0])) {
						output.dr[field[0]] = {};
					}
					output.dr[field[0]][field[1]] = fields[i].value;
				} else {
					output.dr[field[0]] = fields[i].value;
				}

			} else if ( fields[i].name.search(/^patient/) !== -1){
				field = fields[i].name.replace(/^patient-/,"");
				field = field.split('-');
				if (field.length > 1){
					if (! output.patient.hasOwnProperty(field[0])) {
						output.patient[field[0]] = {};
					}
					output.patient[field[0]][field[1]] = fields[i].value;
				} else {
					output.patient[field[0]] = fields[i].value;
				}
			} else {
				output[fields[i].name] = fields[i].value;
			}
		}
		//Add the current drugs that the patient is taking.
		if (currDrugs.length > 0 ){
			output.patient.medications = [];
			for (var i = 0; i < currDrugs.length; i ++ ){
				output.patient.medications.push($(currDrugs[i]).text());
			}
			//Convert the current drugs form an array into text
			output.patient.medications = output.patient.medications.join(", ");
		}
		return output;
	},

	/* The recommendations are the primary goal of this page. When a recommendation is loaded, the user can change the text
	 * associated with it. This function serializes the recommendations (only if they are to be included) and places them in
	 * an object. Each drug has one recomednation is is the primary key of the output object
	 */
	serializeRecomendations : function(){
		var output = {drugs:[],citations:[]}
		var temp,drug,pubmed,genes,classes,index;
		var fields = $('.recommendation-field'); 
		// Gather all of the receomendations
		//If the user has toggled the recommendations off dont iterate over them
		if ($('#drug-recommendations').is(':visible')){
			for (var i = 0; i < fields.length; i++ ){
				drug = $(fields[i]).find('.drug-name').text();
				temp = {};
				temp.drug = drug;
				temp.genes = [];
				temp.classes = [];
				temp.pubmed = [];
				temp.rec = $(fields[i]).find(".rec").val();
				temp.risk = $(fields[i]).find(".risk").text();

				genes = $(fields[i]).find('.gene-name');
				for (var j = 0; j < genes.length; j++){
					temp.genes.push($(genes[i]).text());
				}

				classes = $(fields[i]).find('.class-name');
				for (var j = 0; j < genes.length; j++){
					temp.classes.push($(genes[i]).text());
				}
				pubmed = $(fields[i]).find(".pubmed");
				//add the associated citations
				for(var j=0; j < pubmed.length; j++ ){
					index = output.citations.indexOf($(pubmed[j]).text());
					if (index == -1 ) {
						output.citations.push($(pubmed[j]).text());
						index = output.citations.length
					}
					temp.pubmed.push(output.citations.length);
					temp.pubmedString = temp.pubmed.join(', ');

				}
				//remove any fields not filled in
				output.drugs.push(temp);
			}
		}

		//If there are no recommendations do not return an empty doc, instead return undefined
		console.log(output.drugs);
		output.drugs = output.drugs.length > 0 ? output.drugs : undefined;
		return output;
	},

	serializeFuture : function (){
		output = [];
		var temp;
		var fields = $('.future-field')
		if ($('#drug-recommendations').is(':visible')){
			for (var i = 0; i < fields.length; i++ ){
				temp = {};
				temp.rec = $(fields[i]).find(".rec").val();
				temp.class = $(fields[i]).find(".class-name").text();
				temp.gene = $(fields[i]).find(".gene-name").text();

				output.push(temp);
			}
		
		}
		return output;
	}, 

	/* function to serialize the entire form. Calls the other serialize functions in order and 
	 * adds the results to a single output object
	 */
	serializeForm : function(){
		var output  = this.serializeInputs();
		var recs = this.serializeRecommendations();
		output.citations = recs.citations.map(function(item,ind){
			return {index:ind+1,citation:item}
		});
		output.recommendations = recs.drugs;
		output.genes = this.serializeTable();
		output.future = this.serializeFuture();
		if (output.recommendations){
			output.drugsOfInterest = [];
			for (var i = 0; i < output.recommendations.length; i++ ){
				output.drugsOfInterest.push(output.recommendations[i].drug);
			}

			output.drugsOfInterest = output.drugsOfInterest.join(', ');
		}
		console.log(output);
		return output;
	},

	/* When data is first loaded, check to see if any of the haplotype combinations for a gene have an associated therapeutic risk,
	 * if they do, set the value of the current risk to the associated therapeutic risk. */
	getHaplos : function(){
		//this is a preliminary search in an attempt to cut down the amount of searching that must be done.
		var tableValues = this.serializeTable();
		return Promise.resolve($.ajax({
			url:'/database/recommendations/haplotypes/get',
			type:"POST",
			contentType:"application/json",
			dataType:'json',
			data:JSON.stringify(tableValues)
		})).then(function(result){
			var rows = $('.gene-row');
			for (var i = 0; i < rows.length; i++ ){
				if (result[i].hasOwnProperty('class')){
					$(rows[i]).find('select').val(result[i].class);
				}
				$(rows[i]).find('select').data('id',result[i]._id);
			}
		});
	},

	/* Collect the current state of the haplotypes and therapeutic classes for each gene and send them to the server to be 
	 * remembered for next time. This acts a method to speed up the process for the user, essentially adding a haplotype
	 * association without them having to navigate to the manage dosinng recommendations page.
	 */
	sendHaplos : function(){
		var tableValues = this.serializeTable();
		var promises = [];
		var rows = $('.gene-row');
		// Iterate over each row
		$.each(tableValues,function(index,data){
			var promise,update={};
			var def = new $.Deferred();

			if (data._id !== undefined ){
				update.class = data.class;
				promise = Promise.resolve($.ajax({
					url:"/database/dosing/genes/" + data.gene + '/update?type=haplotype&id=' + data._id,
					type:'POST',
					contentType:'application/json',
					dataType:'json',
					data:JSON.stringify(update)
				}));
			} else {
				delete data._id
				promise = Promise.resolve($.ajax({
					url:'/database/recommendations/haplotypes/set',
					type:'POST',
					contentType:'application/json',
					dataType:'json',
					data:JSON.stringify(data)
				}));
			}
			
			//Submit an ajax request for each gene  to update their haplotype;
			promise.then(function(result){
				if (result){
					if (result.hasOwnProperty('_id')){
						$(rows[index]).find("select").data('id',result._id);
					}
				}
				def.resolve(result);	
			}).catch(function(err){
				def.reject(err)
			});
			promises.push(def)
		});
		//return only when all Ajax request have been successfully completeed and return a single promise.
		return $.when.apply(promises).promise();
	},

	/* When the page is first loaded get information for all the genes used in the pgx analysis.
	 * This returns an array of objects, each object corresponding to a single gene, and containing
	 * all the informationr regarding the recommendations, future, and haplotypes. Once this has been 
	 * loaded, set the set the therapeutic classes of the haplotypes, then render the recommendations
	 */
	getFutureRecommendations : function(){
		var _this = this;
		var tableValues = this.serializeTable();
		return Promise.resolve($.ajax({
			url:'/database/recommendations/future/get',
			type:"POST",
			contentType:"application/json",
			dataType:'json',
			data:JSON.stringify(tableValues)
		})).then(function(result){
			if (result.length === 0) {
				return $('#future-recommendations').html(emptyFieldhtml.replace(/\{\{message\}\}/,'There are no future considerations to report'))
			} else {
			 	return templates.drugs.rec.future({future:result}).then(function(renderedHtml){
					$('#future-recommendations').html(renderedHtml);
				}).then(function(){
					return _this.recomendationHandlers("#future-recommendations");
				});
			}
		});
	},

	/* based on the current status of the therapeutic classes on the PGX table, get and render the current
	 * drug recomednations. Look in the global geneData and find any and all recommendations taht are associated
	 * with a drug. Only one recommendation is included per drug, this takes into consideration mutliple interacitons
	 * between different genes. Once the recomendaitons have been determined, render the html and insert it into the
	 * page. returns a promise, once html is rendered*/
	getRecommendations : function(){
		var _this = this;
		var tableValues = this.serializeTable();

		return Promise.resolve($.ajax({
			url:"/database/recommendations/recommendations/get",
			type:"POST",
			contentType:'application/json',
			dataType:'json',
			data:JSON.stringify(tableValues)
		})).then(function(result){
			var pubMedIDs = [];
			for (var i=0; i < result.length; i++ ){
				pubMedIDs = pubMedIDs.concat(result[i].pubmed);
			}
			if ( result.length === 0 ){
				return $('#drug-recommendations').html(emptyFieldhtml.replace(/\{\{message\}\}/,'There are no recommendations to report'))

			} else {
				return utility.pubMedParser(pubMedIDs).then(function(citations){
					return templates.drugs.rec.recs({recomendation:result,citations:citations})
				}).then(function(renderedHtml){
					$('#drug-recommendations').html(renderedHtml);
				}).then(function(){
					_this.recomendationHandlers('#drug-recommendations');
				})
			}
		});
	},
	/* Page handlers */
	staticHandlers : function(){
		var _this = this; // reference to the function

		//function to remove a row of a table
		var removeRow = function(ele){
			ele.on('click',function(e){
				e.preventDefault();
				var context = $(this).closest('tbody');
				$(this).closest('tr').remove();
				if (!$(context).find('tr').length){
					$(context).closest('table').hide();
				}
			});
		};

		/* anytime the user changes any of therapeutic classes in the PGX analyisis table, check to see if
		 * there are any new recommendations and re-render the contents */
		$('.therapeutic-class').on('change',function(){
			_this.getRecomendations();
			_this.getFutureRecommendations();
		});

		/* If on, recomednations are included, however if the user selects off, then no recomendations are included */
		$('#turnoffrecommendations').on('click',function(){
			var isChecked = $(this).is(':checked');
			if (isChecked){
				$('#drug-recommendations').slideDown();
			} else {
				$('#drug-recommendations').slideUp();
			}
		});

		$('#turnofffuture').on('click',function(){
			var isChecked = $(this).is(':checked');
			if (isChecked){
				$('#future-recommendations').slideDown();
			} else {
				$('#future-recommendations').slideUp();
			}
		});

		//prevent form from being submitted prematurely
		$('form').on("keyup keypress", function(e) {
		  var code = e.keyCode || e.which; 
		  if (code  == 13) {               
		    e.preventDefault();
		    return false;
		  }
		});

		/* Add a drug to the new-drug table. additionally add the hanlers to it as well 
		 * //Eventually link to db with current drug list to offer suggestions
		*/
		$('#patient-add-drug').on('click',function(e){
			e.preventDefault();
			var val = $('#patient-new-drug').val();
			if (val !== ""){
				$('#patient-new-drug').val('');
				var html = "<tr><td class='patient-drug-name'>" + val + "</td><td class='text-center'><a href='#'><i class='fi-x'></i></a></td></tr>";
				$('#patient-drug-table').find('tbody').append(html);
				removeRow($('#patient-drug-table').find('tbody').last('tr').find('a'));
				if (!$('#patient-drug-table').is(":visible")){
					$('#patient-drug-table').show();
				}
				

			}
		});

		/* Once the form is submitted, listen for a valid event. When all fields are validated, serialize the form and submit
		 * and Ajax request to the server with the form info. If the submission is successful and returns the name of the report,
		 * open the report while simultaneously sending the currently updated haplotypes. */
		$('form').on('valid.fndtn.abide',function(){
			var formInfo = _this.serializeForm();
			$(this).find('button').text('Generating...');
			Promise.resolve($.ajax({
				url:window.location.pathname + '/report',
				type:"POST",
				dataType:'json',
				contentType:'application/json',
				data:JSON.stringify(formInfo)
			})).then(function(result){
				if (result.name){
					_this.sendHaplos()
					open(window.location.pathname + '/download/' + result.name);	
				}
			}).then(function(){
				$('form').find('button').text('Generate Report');
			}).catch(function(err){
				console.log(err);
			});
		});
	},

	recommendationHandlers:function(context){
		$(context).find('a.button').on('click',function(e){
			e.preventDefault();
			$(this).closest('fieldset').slideUp(function(){
				$(this).remove()
			})
		});	
	},

	/* Render the initial, get all gene information, re-run the pgx-analysis to get haplotype information and
	 * add all helpers */
	render : function(){
		var _this = this;
		var pgxTemplateData, therapeuticClasses, drugRecommendations;
		//load information on patient and generate pgx info.
		var location = window.location.pathname;
		var patientID = location.split('/').splice(-1)[0];
		//Generate pgx results and convert them into a usable format;
		pgx.generatePgxResults(patientID).then(function(result){
			return pgx.convertTotemplateData(result);
		}).then(function(result){
			var genes = [];
			//Extract infromation for each gene and the haplotypes that were predicted
			for (var gene in result.pgxGenes){
				if (result.pgxGenes.hasOwnProperty(gene)){
					if (result.pgxGenes[gene].possibleHaplotypes !== undefined){
						result.pgxGenes[gene].hap1 = result.pgxGenes[gene].possibleHaplotypes.h1.closestMatch.join(',');
						result.pgxGenes[gene].hap2 = result.pgxGenes[gene].possibleHaplotypes.h2.closestMatch.join(',');
						genes.push(result.pgxGenes[gene]);
					}
				}
			}
			result.pgxGenes = genes;
			pgxTemplateData= result;
		}).then(function(){
			//Retrieve the classes from the db
			return Promise.resolve($.ajax({
				url:"/database/dosing/classes",
				type:"GET",
				dataType:"json"
			}));
		}).then(function(result){
			pgxTemplateData.classes = result[0].classes;
			// render the main htmnl
			return templates.drugs.rec.index(pgxTemplateData);
		}).then(function(renderedHtml){
				$('#main').html(renderedHtml);
		}).then(function(){
			return _this.getHaplos();
			
			// get information from each gene
		}).then(function(){
			return _this.getRecommendations();
		}).then(function(){
			return _this.getFutureRecommendations();
		}).then(function(){
			// refresh foundation
			return utility.refresh();
		}).then(function(){
			//add hanlders
			_this.staticHandlers();
		});
	}
};