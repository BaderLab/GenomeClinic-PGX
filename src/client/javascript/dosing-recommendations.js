/* Javascript for handling the dosing recommendations form
 * @author Patrick Magee
*/

var pgx = require('./pgx'),
	utility = require('./utility');


var strcmp = function( a, b ){
	if( a < b ){
		return -1;
	} else if( a > b ){
		return 1;
	} else {
		return 0;
	}
};


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
					</div>';



var abideOptions = {
	abide: {
		validators:{
			day:function(el,required,parent){
			/* if the element =pointed to by the data-requiredIf is not null then the current field must
			 * be not null as well */
				var val = el.value;
				if (isNaN(val)) return false
				var month = document.getElementById('patient-dob-month').value;
				var year = document.getElementById('patient-dob-year').value;
				var maxDays;
				if (year === '') year = 0;
				if (month === '') month = 0;
				if (val === '') return false;

				maxDays = new Date(year,month,0).getDate();
				if (val > maxDays || val <= 0) return false;
				return true;
			},

			month:function(el,required,parent){
				/* The incoming gene name must be unique */
				var val = el.value;
				if (isNaN(val)) return false
				if (val === '') return false;
				if (val > 12 || val <= 0) return false;
				return true;
			},

			year:function(el,required,parent){
				var val = el.value;
				if (isNaN(val)) return false
				var year  = new Date().getFullYear();
				if (val === '') return false;
				if (val > year || val <= 0 ) return false;
				return true;
			},
			greaterThan:function(el,required,parent){
				var val = el.value;
				if (val == 0 || val == "") return false;
				return true;
			}
		}
	}
};

var addNewDrugOfInterest = function(drug){
	var val = drug || $('#patient-drug-of-interest-input').val();
	if (val !== "" ){
		var html = "<li class='multicol'><span>" + val + "</span>&nbsp&nbsp<a href='#'><i class='fi-x'></i></a></li>";
		$('ol.multicol').append(html);
		removeLink($('ol.multicol').last('li').find('a'));
		$('#patient-drug-of-interest-input').val('')
	} else {
		$('#patient-drug-of-interest-input').addClass("glowing-error");
	}
}

var addNewCurrentMedication = function(drug, dose, route, frequency, notes){
	var val = drug || $('#patient-new-drug').val();
	var dose = dose || $('#patient-new-dose').val();
	var freq = route || $('#patient-new-frequency').val();
	var route = frequency || $('#patient-new-route').val();
	var notes = notes || $('#patient-new-notes').val();
	if (val !== "" && dose !== "" && freq !== "" && route !== ""){
		var html = "<tr><td class='patient-drug-name'>" + val + "</td><td class='patient-drug-dose text-center'>" + dose + "</td>"
		html += '<td class="patient-drug-route text-center">' + route + '</td><td class="patient-drug-frequency text-center">' + freq + '</td>';
		html += '<td class="patient-drug-notes">'+notes+"</td><td class='text-center'><a href='#'><i class='fi-x'></i></a></td></tr>";
		$('#patient-drug-table').find('tbody').append(html);
		removeRow($('#patient-drug-table').find('tbody').last('tr').find('a'));
		if (!$('#patient-drug-table').is(":visible")){
			$('#patient-drug-table').show();
		}

		$('#patient-new-drug,#patient-new-dose,#patient-new-notes,#patient-new-frequency,#patient-new-route').val('');
	}

}

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

var removeLink = function(ele){
	ele.on('click',function(e){
		e.preventDefault();
		$(this).closest('li').remove();
	});
};

var addGene = function(){
	var $list = $('#added-genes');

	var id = 'added-gene-' + Date.now() + '-' + Math.round( Math.random() * 10000 );

	var $gene = $('\
		<tr class="gene-row" data-id="' + id + '">\
			<td>\
				<a class="delete-gene button tiny radius"><i class="fi-x"></i></a>\
				<input class="gene-name" type="text"></input>\
			</td>\
			<td><i><input class="allele_1" type="text"></input></i></td>\
			<td><i><input class="allele_2" type="text"></input></i></td>\
			<td><input class="therapeutic-class" type="text"></input></td>\
			<td>\
				<div class="row collapse prefix-radius">\
					<div class="large-6 small-4 medium-4 columns">\
						<a href="#" data-originalvalue="false" class="button editfixed secondary tiny radius cnv"><b>CNV</b></a>\
					</div>\
					<div class="large-6 small-8 medium-8 columns">\
						<input class="cnv-repeat-num" type="number" placeholder="#" style="display:none" required data-abide-validator="greaterThan">\
						<small class="error">Required</small>\
					</div>\
				</div>\
			</td>\
		</tr>\
	');

	$list.append( $gene );

	var dummyRec = {
		_id: id,
		class: '',
		classes: [],
		cnv: 0,
		drug: '',
		flagged: true,
		gene: '',
		genes: [''],
		haplotypes: [],
		pubmed: [],
		rec: ''
	};

	templates.drugs.rec.recs({ recommendation: [ dummyRec ], citations: {} }).then(function( html ){
		$('#drug-recommendations-added').append( html );
	});

	templates.drugs.rec.future({ future: [ dummyRec ] }).then(function( html ){
		$('#future-recommendations-added').append( html );
	});

};

var updateGeneName = function( id, name ){
	$('.future-field[data-id="'+id+'"] .gene-name i').html( name );
	$('.recommendation-field[data-id="'+id+'"] .gene-name i').html( name );
};

var updateGeneHaplotype = function( id, index, haplotype ){

};

var updateGenePredictedEffect = function( id, effect ){
	$('.future-field[data-id="'+id+'"] .class-name i').html( effect );
	$('.recommendation-field[data-id="'+id+'"] .class-name i').html( effect );
};

var deleteGene = function( id ){
	$('.gene-row[data-id="'+id+'"]').remove();
	$('.future-field[data-id="'+id+'"]').remove();
	$('.recommendation-field[data-id="'+id+'"]').remove();
};

function dosingRecommendations() {
};
/* The PGX analysis table is the basis for all recommendations. It contains not only the haplotypes,
 * but also the predicted Therapeutic class. The claass can be changed by the user (this will be remembered
 * when the user submits the new form), or it can be left the same. Serializing the table will result in an
 * array of objects, each containing the gene name, haplotypes, as well as the therapeutic class. Returns
 * and object. If genee only is true, only include the name of the gene in the array.
*/
dosingRecommendations.serializeTable = function(geneOnly){
	var output = [];
	var temp;
	var rows = $('.gene-row');
	for (var i = 0; i < rows.length; i++ ){

		if (geneOnly){
			output.push($(rows[i]).find('.gene-name').text());
		} else {
			temp = {};
			temp.gene = $(rows[i]).find('.gene-name').text();
			temp.haplotypes = [
				$(rows[i]).find(".allele_1").text(),
				$(rows[i]).find(".allele_2").text()
			];
			temp.class = $(rows[i]).find('.therapeutic-class').val();
			temp._id = $(rows[i]).find('select').data('id');
			//add the cnv
			if ($(rows[i]).find('.cnv').hasClass('warning'))
				temp.cnv = $(rows[i]).find(".cnv-repeat-num").val();
			else
				temp.cnv = 0;

			output.push(temp);
		}
	}
	return output;
};

var pagechange = false;

/* The Physician information and the patient information must be serialized into a usable format,
 * this function collects all the data and places it into an object separating Dr. and patient information
 */
dosingRecommendations.serializeInputs = function(){
	var output = {};
	var temp,field;
	var fields = $('form').serializeArray();
	var currDrugs = $('.patient-drug-name');
	var currDose = $('.patient-drug-dose');
	var currFreq = $('.patient-drug-frequency');
	var currRoute = $('.patient-drug-route');
	var currNotes = $('.patient-drug-notes');
	var moI = $('#patient-drug-of-interest').find('li');
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
		output.patient.medications= "";
		output.patient.allMedications = [];
		for (i = 0; i < currDrugs.length; i ++ ){
			output.patient.allMedications.push({name:$(currDrugs[i]).text(),dose:$(currDose[i]).text(),route:$(currRoute[i]).text(),frequency:$(currFreq[i]).text(),notes:$(currNotes[i]).text()});
			if (output.patient.medications !== "") output.patient.medications += ', '
			output.patient.medications += $(currDrugs[i]).text() + ' at ' + $(currDose[i]).text()

		}

		output.patient.allMedications.sort(function( a, b ){
			return strcmp( a.name, b.name );
		});
		//Convert the current drugs form an array into text
	}
	output.drugsOfInterest = [];
	for (var i = 0; i < moI.length; i++ ){
		output.drugsOfInterest.push($(moI[i]).find('span').text());
	}
	return output;
};
/* The recommendations are the primary goal of this page. When a recommendation is loaded, the user can change the text
 * associated with it. This function serializes the recommendations (only if they are to be included) and places them in
 * an object. Each drug has one recomednation is is the primary key of the output object
 */
dosingRecommendations.serializeRecommendations = function(){
	var temp,drug,pubmed,genes,classes,index;
	var output = {
		drugs:[],
		citations:[]
	}
	var fields = $('.recommendation-field:visible');
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
			temp.cnv = [];
			temp.rec = $(fields[i]).find(".rec").val();
			if( $(fields[i]).find('.flag').hasClass('warning') ){
				temp.flagged = true;
			}

			$(fields[i]).find('.gene-name').each(function(ind,gene){
				temp.genes.push($(gene).text());
				if ($(gene).closest(".row").find(".cnv-count").length > 0)
					temp.cnv.push(parseInt($(gene).closest(".row").find(".cnv-count").text()));
				else
					temp.cnv.push(0);
			});

			$(fields[i]).find(".class-name").each(function(ind,className){
				temp.classes.push($(className).text());
			});

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
	output.drugs = output.drugs.length > 0 ? this.sortFlaggedData(output.drugs) : undefined;
	return output;
};

/* Serialize the future recommednations and return the serialized object */
dosingRecommendations.serializeFuture = function (){
	output = [];
	var temp;
	var fields = $('.future-field:visible');
	if ($('#future-recommendations').is(':visible')){
		for (var i = 0; i < fields.length; i++ ){
			temp = {};
			temp.rec = $(fields[i]).find(".rec").val();
			temp.genes = [];
			temp.classes = [];
			temp.cnv = [];
			$(fields[i]).find('.gene-name').each(function(ind,gene){
				temp.genes.push($(gene).text());
				if ($(gene).closest(".row").find(".cnv-count").length > 0)
					temp.cnv.push(parseInt($(gene).closest(".row").find(".cnv-count").text()));
				else
					temp.cnv.push(0);
			});
			$(fields[i]).find(".class-name").each(function(ind,className){
				temp.classes.push($(className).text());
			});
			if($(fields[i]).find('.flag').hasClass('warning') ){
				temp.flagged = true;
			}
			output.push(temp);
		}

	}
	return this.sortFlaggedData(output);
};//end serializeFuture

/* Sort the input array and place all flagged content at the start
 * of the return array. */
dosingRecommendations.sortFlaggedData = function(input){
	var flagged = [];
	var unflagged = [];
	if (input){
		for (var i = 0; i < input.length; i++ ){
			if (input[i].flagged) flagged.push(input[i]);
			else unflagged.push(input[i])
		}
	}

	var byGenes = function( a, b ){
		var aGenes = a.genes.splice().sort( strcmp );
		var bGenes = b.genes.splice().sort( strcmp );
		var length = Math.min( aGenes.length, bGenes.length );

		for( var i = 0 ; i < length; i++ ){
			var cmp = strcmp( aGenes[i], bGenes[i] );

			if( cmp !== 0 ){ return cmp; }
		}

		return aGenes.length - bGenes.length;
	};

	var byDrug = function( a, b ){
		return strcmp( a.drug, b.drug );
	};

	var byDrugOrGenes = function( a, b ){
		if( a.drug && b.drug ){
			return byDrug( a, b );
		} else if( a.genes && b.genes ){
			return byGenes( a, b );
		}
	};

	flagged.sort( byDrugOrGenes );
	unflagged.sort( byDrugOrGenes );

	//return sorted input
	return flagged.concat(unflagged);

};//end sortFlaggedData

/* function to serialize the entire form. Calls the other serialize functions in order and
 * adds the results to a single output object
 */
dosingRecommendations.serializeForm = function(){
	var output  = this.serializeInputs();
	var recs = this.serializeRecommendations();

	output.citations = recs.citations.map(function(item,ind){
		return {index:ind+1,citation:item}
	});

	output.recommendations = recs.drugs;
	output.genes = this.serializeTable();
	output.future = this.serializeFuture();
	output.changed  = utility.getURLAtrribute('archived') == 'true' ? pagechange : true;

	var flags = $('.flag:visible');

	for (var i = 0; i < flags.length; i++ ){
		if($(flags[i]).hasClass('warning')) output.flagged = true;
	}

	var classIsOk = function( cls ){
		cls = cls.toLowerCase();

		if( cls.match(/normal/) ){
			return true;
		} else if( cls.match(/unfavorable/) ){
			return false;
		} else if( cls.match(/favorable/) ){
			return true;
		}

		return false;
	};

	var classIsProblematic = function( cls ){
		return !classIsOk( cls );
	};

	if( output.recommendations ){

		// mark drugs with non-normal status with a warning
		output.recommendations.forEach(function( rec ){
			if( rec.classes.some( classIsProblematic ) ){
				rec.warning = true;
			}
		});

		// flagged or warning drugs should have a concern state to be bumped up in the report
		output.recommendations.forEach(function( rec ){
			if( rec.warning || rec.flagged ){
				rec.concern = true;
			}
		});

		var findMed = function( rec ){
			var meds = output.patient.allMedications;

			return (meds || []).filter(function( med ){
				return med.name.toLowerCase() === rec.drug.toLowerCase();
			})[0];
		};

		// meds that are flagged should have the flagged state in the patient's med list
		output.recommendations.forEach(function( rec ){
			if( rec.flagged ){
				var med = findMed( rec );

				if( med ){
					med.flagged = true;
				}
			}

			if( rec.warning ){
				var med = findMed( rec );

				if( med ){
					med.warning = true;
				}
			}
		});

		// note if we have an "other" drug flagged
		output.recommendationsHasOtherFlagged = output.recommendations.filter(function( rec ){
			return rec.drug.toLowerCase() === 'other' && rec.flagged;
		}).length > 0;

		// whether we have no flags
		output.recommendationsHasNoneFlagged = output.recommendations.filter(function( rec ){
			return rec.flagged;
		}).length === 0;

		// note whether the drug is specified for the recs
		output.recommendations.forEach(function( rec ){
			rec.specifiedDrug = rec.drug.toLowerCase() !== 'other';
		});

	}

	if( output.future ){

		output.futureHasNoneFlagged = !output.future.some(function( rec ){ return rec.flagged; });

		// mark warning and concern state
		output.future.forEach(function( rec ){
			if( rec.classes.some( classIsProblematic ) ){
				rec.warning = true;
			}

			if( rec.flagged || rec.warning ){
				rec.concern = true;
			}
		});

		// organise the genes properly
		output.future.forEach(function( rec ){
			rec.geneStatus = [];

			rec.genes.forEach(function( gene, i ){
				var status = rec.classes[i];

				rec.geneStatus.push({
					gene: gene,
					status: status
				});
			});

			rec.geneStatus.sort(function( a, b ){
				return strcmp( a.gene, b.gene );
			});
		});

	}

	return output;
};//end serializeFuture

/* When data is first loaded, check to see if any of the haplotype combinations for a gene have an associated therapeutic risk,
 * if they do, set the value of the current risk to the associated therapeutic risk. */
dosingRecommendations.getHaplos = function(){
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
};

/* Collect the current state of the haplotypes and therapeutic classes for each gene and send them to the server to be
 * remembered for next time. This acts a method to speed up the process for the user, essentially adding a haplotype
 * association without them having to navigate to the manage dosinng recommendations page.
 */
dosingRecommendations.sendHaplos = function(){
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
};
/* based on the current status of the therapeutic classes on the PGX table, get and render the current
 * drug recomednations. Look in the global geneData and find any and all recommendations taht are associated
 * with a drug. Only one recommendation is included per drug, this takes into consideration mutliple interacitons
 * between different genes. Once the recomendaitons have been determined, render the html and insert it into the
 * page. returns a promise, once html is rendered*/
dosingRecommendations.getRecommendations = function(){
	var _this = this;
	var tableValues = this.serializeTable();
	var otherValues = tableValues.filter(function(item){
		if (item.class=="Other") {
			item.genes = [item.gene];
			item.classes = [item.class];
			item.flagged = true;
			item.pubmed = [];
			item.rec = "";
			item.drug = "Other"
			return item;
		}
	});

	return Promise.resolve($.ajax({
		url:"/database/recommendations/recommendations/get",
		type:"POST",
		contentType:'application/json',
		dataType:'json',
		data:JSON.stringify(tableValues)
	})).then(function(result){
		var pubMedIDs = [];
		var doseRes = result.dosing;
		var futureRes = result.future;

		//Add Drug recommendations for drug dosing
		for (var i=0; i < doseRes.length; i++ ){
			pubMedIDs = pubMedIDs.concat(doseRes[i].pubmed);
		}
		if ( doseRes.length === 0 && otherValues.length == 0){
			$('#drug-recommendations').html(emptyFieldhtml.replace(/\{\{message\}\}/,'There are no recommendations to report'))

		} else {
			//TODO: decouple citations from rendering, so they render after and do not hold up page dispkay
			utility.retrieveCitations(pubMedIDs).then(function(citations){
				doseRes = doseRes.concat(otherValues);
				return templates.drugs.rec.recs({recommendation:doseRes,citations:citations})
			}).then(function(renderedHtml){
				$('#drug-recommendations').html(renderedHtml);
			}).then(function(){
				_this.recommendationHandlers('#drug-recommendations');
			}).catch(function(err){
				console.error(err);
			})
		}

		if (futureRes.length === 0 && otherValues.length == 0) {
			$('#future-recommendations').html(emptyFieldhtml.replace(/\{\{message\}\}/,'There are no future considerations to report'))
		} else {
			futureRes = futureRes.concat(otherValues);
		 	templates.drugs.rec.future({future:futureRes}).then(function(renderedHtml){
				$('#future-recommendations').html(renderedHtml);
			}).then(function(){
				return _this.recommendationHandlers("#future-recommendations");
			}).catch(function(err){
				console.error(err);
			});
		}
	});
};

/* Page handlers */
dosingRecommendations.staticHandlers = function(){
	var _this = this; // reference to the function
	var $body = $('body');

	$body.on("click", '.cnv', function(e){
		e.preventDefault();
		if ($(this).hasClass("editfixed")){
			if ($(this).hasClass('secondary')){
				$(this).removeClass('secondary').addClass('warning');
				$(this).closest(".row").find(".cnv-repeat-num").show();
			} else {
				$(this).addClass('secondary').removeClass('warning');
				$(this).closest(".row").find(".cnv-repeat-num").hide().val("");
			}
		}
	});


	$body.on('click', '#add-drug-of-interest', function(e){
		e.preventDefault();
		addNewDrugOfInterest();
	});

	/* anytime the user changes any of therapeutic classes in the PGX analyisis table, check to see if
	 * there are any new recommendations and re-render the contents */
	$body.on('change', 'select.therapeutic-class,.cnv-repeat-num', function(){
		_this.getRecommendations();
		//_this.getFutureRecommendations();
	});

	/* If on, recomednations are included, however if the user selects off, then no recomendations are included */
	$body.on('click', '#turnoffrecommendations', function(){
		var isChecked = $(this).is(':checked');
		if (isChecked){
			$('#drug-recommendations, #drug-recommendations-added').slideDown();
		} else {
			$('#drug-recommendations, #drug-recommendations-added').slideUp();
		}
	});

	$body.on('click', '#turnofffuture', function(){
		var isChecked = $(this).is(':checked');
		if (isChecked){
			$('#future-recommendations, #future-recommendations-added').slideDown();
		} else {
			$('#future-recommendations, #future-recommendations-added').slideUp();
		}
	});

	//prevent form from being submitted prematurely
	$body.on("keyup keypress", 'form', function(e) {
	  var code = e.keyCode || e.which;
	  if (code  == 13 && document.activeElement.type !== 'textarea') {
	    e.preventDefault();
	    return false;
	  }
	});

	/* Add a drug to the new-drug table. additionally add the hanlers to it as well
	 * //Eventually link to db with current drug list to offer suggestions
	*/
	$body.on('click','#patient-add-drug',function(e){
		e.preventDefault();
		addNewCurrentMedication();

	});

	$body.on('keyup','#patient-dob-date,#patient-dob-month,#patient-dob-year',function(){
		var date = $('#patient-dob-date').val();
		var month = $('#patient-dob-month').val();
		var year = $('#patient-dob-year').val();
		if (year.length == 4 && date.length <= 2 && month.length <= 2 && year > 0 && date > 0 && month > 0){
			$('#patient-dob-date,#patient-dob-month,#patient-dob-year').trigger('change');
			if(!$('#patient-dob-date').hasClass('error') && !$('#patient-dob-month').hasClass('error') && !$('#patient-dob-year').hasClass('error')){
				var todayDate = new Date();
				var todayYear = todayDate.getFullYear();
				var todayMonth = todayDate.getMonth();
				var todayDay = todayDate.getDate();
				var age = todayYear - year;
				if (todayMonth < month - 1) {
					age--;
				}
				if (month - 1 == todayMonth && todayDay < date){
					age--;
				}
				$('input[name=patient-age]').val(age);
			}
		}
	});

	$body.on('click', '.add-gene', function( e ){
		e.preventDefault();

		addGene();
	});

	var getGeneIdFromChildEle = function( childEle ){
		return $(childEle).parents('[data-id]').attr('data-id');
	};

	var debounce = Foundation.utils.debounce.bind( Foundation.utils );

	$body.on('click', '.delete-gene', function( e ){
		e.preventDefault();

		var id = getGeneIdFromChildEle( this );

		deleteGene( id );
	});

	$body.on('keydown', 'input.gene-name', debounce(function( e ){
		var id = getGeneIdFromChildEle( this );
		var name = $(this).val();

		updateGeneName( id, name );
	}, 150));

	$body.on('keydown', 'input.therapeutic-class', debounce(function( e ){
		var id = getGeneIdFromChildEle( this );
		var effect = $(this).val();

		updateGenePredictedEffect( id, effect );
	}, 150));

	/* Once the form is submitted, listen for a valid event. When all fields are validated, serialize the form and submit
	 * and Ajax request to the server with the form info. If the submission is successful and returns the name of the report,
	 * open the report while simultaneously sending the currently updated haplotypes. */
	$body.on('valid.fndtn.abide','form',function(){
		var formInfo = _this.serializeForm();
		$(this).find('button').text('Generating...');
		Promise.resolve($.ajax({
			url:window.location.pathname + '/generate',
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
			pagechange = false;
		}).catch(function(err){
			console.error(err);
		});
	});
	if (utility.getURLAtrribute('archived') == 'true'){
		$(document).on('change',function(){
			pagechange = true;
		});
	}
};

dosingRecommendations.recommendationHandlers = function(context){
	$(context).find('a.remove').on('click',function(e){
		var _this = this;
		e.preventDefault();
		$(this).closest('fieldset').slideUp(function(){
			$(_this).remove()
		})
	});

	$(context).find('.flag').on('click',function(e){
		e.preventDefault();
		if ($(this).hasClass('secondary')) $(this).removeClass('secondary').addClass('warning');
		else $(this).addClass('secondary').removeClass('warning');

	});
};


/* take the PGX output data as the input and putthe data into a form
 * that can easily displayed on the page */
dosingRecommendations.generateData = function(templateData){
	var genes = [];
	var geneData = [];
	var ignoredGenes = [];
	var otherGenes = [];
	var closestMatches;
	//Extract infromation for each gene and the haplotypes that were predicted
	//Select the case where there is only Two possible Haplotypes.
	//Any other cases cannot be determined
	for (var i = 0; i <templateData.pgxGenes.length; i++ ){
		if (templateData.pgxGenes[i].possibleHaplotypes !== undefined){
				/* if there are multiple possible haplotypes beacuse the patient
				 * data is unphased or heterozygous unphased then we cannot interpret
				 * it appropriately, therefore we should only take genes that for
				 * Sure are known. */
			 var keys = Object.keys(templateData.pgxGenes[i].possibleHaplotypes);
			 closestMatches = [];
			 $.each(keys,function(ind,item){
			 	closestMatches = closestMatches.concat(templateData.pgxGenes[i].possibleHaplotypes[item].closestMatch);
			 })
			 //There are only 2 possible haploptypes and there are only 2 possible matches
			 //THis means it is a distinct match.
			 if (keys.length <= 2 && closestMatches.length <= 2){
			 	geneData.push(templateData.pgxGenes[i]);
			 	genes.push(templateData.pgxGenes[i].gene);
			 } else {
			 	otherGenes.push(templateData.pgxGenes[i]);
			 }
		} else {
			otherGenes.push(templateData.pgxGenes[i]);
		}

	}

	templateData.ignoredGenes = ignoredGenes;
	templateData.otherGenes = otherGenes;
	templateData.pgxGenes = geneData;
	templateData.pgxGeneNames = genes;

	return templateData;
}//end generateData


/**
 * Given an object that can be mapped to input names, recursively search through the objecct
 * and set all of the input vals. The keys of the object can be concatenated together to build
 * the input field name ie:
 * patient: {
 *	 name:{
 *		last: jim
 *	}
 *}
 * would concatentae to patient-name-last with the value being set as jim
 *@param the object to iterate over
 *@param currString the current state of the name string
 */
dosingRecommendations.settAttributesRecursive = function(obj,currString){
	var _this = this;
	var promise = Promise.resolve().then(function(){
		if (!currString)
			currString = "";
		if (Object.prototype.toString.call(obj) != "[object Object]"){
			$("input[name=" + currString + "],textarea[name=" + currString + "],select[name=" + currString + "]").val(obj);
		}
		else {
			for (var attr in  obj){
				if (obj.hasOwnProperty(attr)){

					_this.settAttributesRecursive(obj[attr], currString == "" ? attr : currString + "-" + attr);
				}
			}
		}
	});
	return promise;

}

/**
 * Retrieve archived data from the databse and set all of the page inputs according
 * to the state that the archived report was in.
 */
dosingRecommendations.setArchivedData = function(){
	var _this = this;
	this.getArchivedData().then(function(result){
		result = result[0];
		var data = result.data;
		if (!result)
			//If there is no result load the default page.
			return _this.getRecommendations();
		else {
			//SET THE VALUES FOR THE PATIENT
			_this.settAttributesRecursive(data.patient,"patient");
			_this.settAttributesRecursive(data.dr, "dr");
			_this.settAttributesRecursive(data.summary,"summary");

			var genes = $('.gene-row');
			for (var i = 0; i < data.genes.length;i++){
				$(genes[i]).find(".therapeutic-class").val(data.genes[i].class);
				if (data.genes[i].cnv > 0)
					$(genes[i]).find('.cnv').trigger("click").closest('.row').find('.cnv-repeat-num').val(data.genes[i].cnv);
			}

			for (var i = 0; i < data.drugsOfInterest.length; i++ )
				addNewDrugOfInterest(data.drugsOfInterest[i]);
			var medication;
			if (data.patient.allMedications)
				for (var i = 0; i < data.patient.allMedications.length; i++ ){
					medication = data.patient.allMedications[i];
					addNewCurrentMedication(medication.name,medication.dose,medication.frequency,medication.route,medication.notes)
				}


			if (!data.recommendations)
					$('#drug-recommendations').html(emptyFieldhtml.replace(/\{\{message\}\}/,'There are no recommendations to report'))
			else {
				utility.retrieveCitations(data.citations).then(function(citations){
					return templates.drugs.rec.recs({recommendation:data.recommendations,citations:citations})
				}).then(function(renderedHtml){
					$('#drug-recommendations').html(renderedHtml);
				}).then(function(){
					_this.recommendationHandlers('#drug-recommendations');
				}).catch(function(err){
					console.error(err);
				});
			}


			if (data.future.length === 0) {
				$('#future-recommendations').html(emptyFieldhtml.replace(/\{\{message\}\}/,'There are no future considerations to report'))
			} else {
			 	templates.drugs.rec.future({future:data.future}).then(function(renderedHtml){
					$('#future-recommendations').html(renderedHtml);
				}).then(function(){
					return _this.recommendationHandlers("#future-recommendations");
				}).catch(function(err){
					console.error(err);
				});
			}
		}
	});
};

dosingRecommendations.getArchivedData = function(){
	var _this = this;
	var id = utility.getURLAtrribute("reportID");
	var promise = Promise.resolve($.ajax({
		url:"/database/recommendations/archived?reportID=" + id,
		type:"GET",
		contentType:"application/json"
	})).then(function(result){
		if (Object.prototype.toString.call(result) == "[object Array]" && result.length > 0)
			return result;
		else
			return undefined;
	});
	return promise;
}
/* Render the initial, get all gene information, re-run the pgx-analysis to get haplotype information and
 * add all helpers */
dosingRecommendations.render = function(){
	var _this = this;
	var pgxTemplateData, therapeuticClasses, drugRecommendations;
	//load information on patient and generate pgx info.
	var location = window.location.pathname;
	var archived = utility.getURLAtrribute('archived') == 'true';
	var patientID = location.split('/').splice(-2)[0];
	//Generate pgx results and convert them into a usable format;
	pgx.generatePgxResults(patientID).then(function(result){
		return pgx.convertTotemplateData(result);
	}).then(function(result){
		pgxTemplateData=_this.generateData(result);
		var promises = pgxTemplateData.pgxGeneNames.map(function(gene,ind){
			return Promise.resolve($.ajax({
				url:"/database/dosing/genes/"+ gene + '?type=true',
				type:"GET"
			})).then(function(result){
				pgxTemplateData.pgxGenes[ind].type = result;
			});
		});
		return Promise.all(promises);
	}).then(function(){
		//Retrieve the classes from the db
		return Promise.resolve($.ajax({
			url:"/database/dosing/classes",
			type:"GET",
			dataType:"json"
		}));
	}).then(function(result){
		pgxTemplateData.classes = result;

		// render the main htmnl
		return templates.drugs.rec.index(pgxTemplateData);
	}).then(function(renderedHtml){
			$('#main').html(renderedHtml);
	}).then(function(){
		return _this.getHaplos();
		// get information from each gene
	}).then(function(){
		if (!archived)
			return _this.getRecommendations();
		else
			return _this.setArchivedData();
	}).then(function(){
		// refresh foundation
		return utility.refresh(abideOptions);
	}).then(function(){
		//add hanlders
		utility.suggestionHandlers();
		_this.staticHandlers();
	}).catch(function(err){
		console.error(err);
	});
};

module.exports = dosingRecommendations;
