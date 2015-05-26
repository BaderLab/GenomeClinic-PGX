var pgx = require('./pgx'),
	templates = require('./templates'),
	utility = require('./utility');

var pageOptions = {};


function checkNested(obj) {
  var args = Array.prototype.slice.call(arguments, 1);

  for (var i = 0; i < args.length; i++) {
    if (!obj || !obj.hasOwnProperty(args[i])) {
      return false;
    }
    obj = obj[args[i]];
  }
  return true;
}

module.exports = {
	//helpers
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
				temp.hap = {
					allele_1:$(rows[i]).find(".allele_1").val(),
					allele_2:$(rows[i]).find(".allele_2").val()
				};
				temp.class = $(rows[i]).find('.therapeutic-class').val();
				output.push(temp);
			}
		}
		return output;
	},
	serializeInputs : function(){
		var output = {};
		var temp,field;
		var fields = $('form').serializeArray();
		var currDrugs = $('.patient-drug-name');
		output.patient = {};
		output.dr = {};
		for (var i = 0; i < fields.length; i++){
			if (fields[i].name.search(/^dr/) !== -1){
				field = fields[i].name.replace(/^dr-/,"");
				field = field.split('-');
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
		if (currDrugs.length > 0 ){
			output.patient.medications = [];
			for (var i = 0; i < currDrugs.length; i ++ ){
				output.patient.medications.push($(currDrugs[i]).text());
			}
			output.patient.medications = output.patient.medications.join(", ");
		}
		return output;
	},
	serializeRecomendations : function(){
		var output = {};
		var temp,drug,pubmed;
		var fields = $('.recomendation-field');
		for (var i = 0; i < fields.length; i++ ){
			drug = $(fields[i]).find('.drug-name').text();
			/*if (!output.hasOwnProperty(drug)){
				output[drug] = [];
			} */
			temp = {};
			temp.rec = $(fields[i]).find(".recomendation-rec").val();
			temp.risk = $(fields[i]).find(".recomendation-risk").text();
			temp.pgx_1 = $(fields[i]).find(".recomendation-pgx-1").text();
			temp.class_1 = $(fields[i]).find(".recomendation-class-1").text();
			temp.pgx_2 = $(fields[i]).find(".recomendation-pgx-2").text();
			temp.class_2 = $(fields[i]).find(".recomendation-class-2").text();
			pubmed = $(fields[i]).find(".recomendation-pubmed").find('a');
			temp.pubmed = [];
			for(var j=0; j < pubmed.length; j++ ){
				temp.pubmed.push($(pubmed[j]).attr('href'));
			}
			if (temp.pubmed.length == 0 ) delete temp.pubmed;
			if (!temp.class_2) delete temp.class_2;
			if (!temp.pgx_2) delete temp.pgx_2;
			//output[drug].push(temp);
			output[drug] = temp;
		}
		output = Object.keys(output).length > 0 ? output : undefined;
		return output;
	},

	serializeForm : function(){
		var output  = this.serializeInputs();
		output.recomendations = this.serializeRecomendations();
		output.genes = this.serializeTable();
		output.future = this.setFuture();
		if (output.recomendations){
			output.drugsOfInterest = Object.keys(output.recomendations).join(", ");
		}
		return output;
	},

	setHaplos : function(){
		//this is a preliminary search in an attempt to cut down the amount of searching that must be done.
		var haplo;
		var tableValues = this.serializeTable();
		var rows = $('.gene-row');
		for (var i=0; i < tableValues.length; i++ ){
			if (pageOptions.geneData.hasOwnProperty(tableValues[i].gene)){
				for (tclass in pageOptions.geneData[tableValues[i].gene].haplotypes){
					if (pageOptions.geneData[tableValues[i].gene].haplotypes[tclass].indexOf(tableValues[i].hap.allele_1) !== -1 && pageOptions.geneData[tableValues[i].gene].haplotypes[tclass].indexOf(tableValues[i].hap.allele_2) !== -1){
						$(rows[i]).find('select').val(tclass)
					}
				}
			}
		}
	},

	setFuture : function(){
		var temp;
		var output = {};
		var tableValues = this.serializeTable();
		for (var i=0; i < tableValues.length; i++ ){
			temp = {};
			if (pageOptions.geneData.hasOwnProperty(tableValues[i].gene)){
				if (pageOptions.geneData[tableValues[i].gene].hasOwnProperty('future')){
					if (pageOptions.geneData[tableValues[i].gene].future.hasOwnProperty(tableValues[i].class)){
						temp.class = tableValues[i].class;
						temp.rec = pageOptions.geneData[tableValues[i].gene].future[tableValues[i].class].rec
						output[tableValues[i].gene] =  temp;
					}	
				}
			}
		}
		return output;
	},

	getGenes : function(){
		var _this = this;
		var genes = this.serializeTable(true);
		return Promise.resolve($.ajax({
			url:'/database/dosing/genes',
			type:"POST",
			contentType:'application/json',
			dataType:'json',
			data:JSON.stringify({genes:genes})
		})).then(function(result){
			pageOptions.geneData = {};
			for (var i=0; i< result.length; i++ ){
				pageOptions.geneData[result[i].gene] = result[i];
			}
		}).then(function(){
			return _this.getRecomendations();
		}).catch(function(err){
			console.log(err);
		})
	},
	getRecomendations : function(){
		var _this =  this;
		var tableValues = this.serializeTable();
		var geneClasses = {};
		for (var i=0; i < tableValues.length; i++ ){
			geneClasses[tableValues[i].gene] = tableValues[i].class;
		}
		var recByDrug = {};
		var point,gene,drug,j,secKeys;
		var set;
		for (gene in pageOptions.geneData){
			for (drug in pageOptions.geneData[gene].recomendations){
				set = false;
				point = pageOptions.geneData[gene].recomendations
				if (point[drug].hasOwnProperty(geneClasses[gene])){
					point = point[drug][geneClasses[gene]];
					if (point.hasOwnProperty('secondary')){
						secKeys = Object.keys(point.secondary);
						for (j=0; j < secKeys.length; j++){
							if (point.secondary.hasOwnProperty(secKeys[i])){
								if (point.secondary[secKeys[i]].hasOwnProperty(geneClasses[secKeys[i]])){
									recByDrug[drug] = {
										rec:point.secondary[secKeys[i]].rec,
										pubmed:point.secondary[secKeys[i]].pubmed,
										risk:point.secondary[secKeys[i]].risk,
										pgx_1:gene,
										pgx_2:keys[i],
										class_1:geneClasses[gene],
										class_2:geneClasses[secKeys[i]]
									}
									set = true;
								}
							}
						}
					} 
					if (!set) {
						recByDrug[drug] = {
							rec:point.rec,
							pubmed:point.pubmed,
							risk:point.risk,
							pgx_1:gene,
							class_1:geneClasses[gene],
						}

					}
				}
			}
		}
		templates.drugs.rec.recs({drugs:recByDrug}).then(function(renderedHtml){
			$('#drug-recomendations').html(renderedHtml);
		});
	},
	//handlers
	staticHandlers : function(){
		var _this = this;
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

		
		$('.therapeutic-class').on('change',function(){
			_this.getRecomendations();
		});

		//prevent form from being submitted prematurely
		$('form').on("keyup keypress", function(e) {
		  var code = e.keyCode || e.which; 
		  if (code  == 13) {               
		    e.preventDefault();
		    return false;
		  }
		});

		/* Eventually link to db with current drug list to offer suggestions
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

		//submit form
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
					open(window.location.pathname + '/download/' + result.name);	
				}
			}).then(function(){
				$('form').find('button').text('Generate Report');
			}).catch(function(err){
				console.log(err);
			});
		});
	},

	//render
	render : function(){
		var _this = this;
		var pgxTemplateData, therapeuticClasses, drugRecomendations;
		//load information on patient and generate pgx info.
		var location = window.location.pathname;
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
			}));
		}).then(function(result){
				therapeuticClasses = result;
		}).then(function(){
			pgxTemplateData.classes = therapeuticClasses[0].classes;
			return templates.drugs.rec.index(pgxTemplateData);
		}).then(function(renderedHtml){
				$('#main').html(renderedHtml);
		}).then(function(){
			return _this.getGenes()	
		}).then(function(){
			_this.setHaplos();
			return utility.refresh();
		}).then(function(){
			_this.staticHandlers();
		});

	}
};