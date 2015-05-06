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
				allele_2:$(rows[i]).find(".allele_2").val()
			};
			temp.class = $(rows[i]).find('.therapeutic-class').val();
			output.push(temp);
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
		var temp,drug;
		var fields = $('.recomendation-field');
		for (var i = 0; i < fields.length; i++ ){
			drug = $(fields[i]).find('.drug-name').text();
			/*if (!output.hasOwnProperty(drug)){
				output[drug] = [];
			} */
			temp = {};
			temp.rec = $(fields[i]).find(".recomendation-rec").val();
			temp.risk = $(fields[i]).find(".recomendation-risk").text();
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
		if (output.recomendations){
			output.drugsOfInterest = Object.keys(output.recomendations).join(", ");
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
		var _this =  this;
		var tableValues = this.serializeTable();
		Promise.resolve($.ajax({
			url:'/database/dosing/recomendations/current',
			type:'POST',
			dataType:'json',
			contentType:'application/json',
			data:JSON.stringify(tableValues)
		})).then(function(result){
			console.log(result);
			return templates.drugs.rec.recs({drugs:result});
		}).then(function(renderedHtml){
			return $('#drug-recomendations').html(renderedHtml);

		}).then(function(){
			utility.refresh($("#drug-recomendations"));
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
			return _this.getRecomendations();		
		}).then(function(){
			return utility.refresh();
		}).then(function(){
			_this.staticHandlers();
		});

	}
};