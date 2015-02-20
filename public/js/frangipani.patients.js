/*
 * Frangipani pharmacogenomics app JavaScript.
 * @author Ron Ammar
 */

/* Wrap all code in an immediately-invoked function expressions to avoid 
 * global variables. */
(function() {

var appMain= $("#frangipani-patients-main");

/* 
 * Auxiliary helper functions and constants.
 */
var aux= {

	/* Cache of handlebars templates. */
	template_cache: undefined,
	/*
	/* Function to retrieve and render a handlebars template. This function is
	 * an async version of that provided by user koorchik on StackOverFlow:
	 * http://stackoverflow.com/questions/8366733/external-template-in-underscore
	 * as explained on the following blog entry:
	 * http://javascriptissexy.com/handlebars-js-tutorial-learn-everything-about-handlebars-js-javascript-templating/
	 *
	 * NOTE: In the future, I would compile all my templates into a single
	 * templates.js file and load that in the beginning rather than have many
	 * small asynchronous AJAX calls to get templates when the webpage loads.
	 *
	 * Returns a promise. 
	asyncRenderHbs: function(template_name, template_data) {
		if (!aux.template_cache) { 
		    aux.template_cache= {};
		}

		var promise= undefined;

		if (!aux.template_cache[template_name]) {
			promise= new Promise(function(resolve, reject) {
				var template_url= '/templates/' + template_name;
				$.ajax({
					url: template_url,
					method: 'GET',
					success: function(data) {
						aux.template_cache[template_name]= Handlebars.compile(data);
						resolve(aux.template_cache[template_name](template_data));
					},
					error: function(err, message) {
						reject(err);
					}			
				});
			});
		} else {
			promise= Promise.resolve(aux.template_cache[template_name](template_data));
		}
		
		return promise;
	},
	*/

	/* Convert form into JSON.
	 * Function adapted from http://stackoverflow.com/questions/1184624/convert-form-data-to-js-object-with-jquery */
	serializeObject: function(form) {
	    var o = {};
	    var a = form.serializeArray();
	    $.each(a, function() {
	        if (o[this.name] !== undefined) {
	            if (!o[this.name].push) {
	                o[this.name] = [o[this.name]];
	            }
	            o[this.name].push(this.value || '');
	        } else {
	            o[this.name] = this.value || '';
	        }
	    });
	    return o;
	},


	/* Assert function, because it's not built into browser.
	 * Code from: http://stackoverflow.com/questions/15313418/javascript-assert */
	assert: function(condition, message) {
	    if (!condition) {
	        message = message || "Assertion failed";
	        if (typeof Error !== "undefined") {
	            throw new Error(message);
	        }
	        throw message; // Fallback
	    }
	},

	/*
	 * Compute the Levenshtein distance (edit distance) between the two given strings.
	 * Sources:
	 * http://en.wikibooks.org/wiki/Algorithm_Implementation/Strings/Levenshtein_distance#JavaScript
	 * or
	 * http://gist.github.com/andrei-m/982927
	 * Copyright (c) 2011 Andrei Mackenzie
	 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
	 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
	 */
	getEditDistance: function(a, b){
	  if(a.length == 0) return b.length; 
	  if(b.length == 0) return a.length; 
	 
	  var matrix = [];
	 
	  // increment along the first column of each row
	  var i;
	  for(i = 0; i <= b.length; i++){
	    matrix[i] = [i];
	  }
	 
	  // increment each column in the first row
	  var j;
	  for(j = 0; j <= a.length; j++){
	    matrix[0][j] = j;
	  }
	 
	  // Fill in the rest of the matrix
	  for(i = 1; i <= b.length; i++){
	    for(j = 1; j <= a.length; j++){
	      if(b.charAt(i-1) == a.charAt(j-1)){
	        matrix[i][j] = matrix[i-1][j-1];
	      } else {
	        matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
	                                Math.min(matrix[i][j-1] + 1, // insertion
	                                         matrix[i-1][j] + 1)); // deletion
	      }
	    }
	  }
	 
	  return matrix[b.length][a.length];
	}


};  // End of aux methods


/* AJAX call to application server to retrieve patients.
 * This is based on the local MongoDB collections, not GA4GH. */
var getPatients= function() {
	//Promise Function
	var promise= Promise.resolve($.ajax({
		url: "/patients",
		type: "GET",
		contentType: "application/json",
	}))
	.then(function(result) {
		var context= {
			"patients": result
		};
		return context;
	});

	return promise;
};


/* Create a promise function to wrap our browse button tasks. */
var loadPatients= function() {
	getPatients()
	.then(function(result) {
		appMain.children().remove();  // clear the current page
		var context= result;
		return asyncRenderHbs('frangipani-patients.hbs', context);
	})
	.then(function(html) {
		appMain.append(html);
		addEventListeners();
	});
};


/* Create globally-scoped PGx data. */
var globalPGXData= {};


/* Process the PGx data received from the server for this specific patient. */
var processPGXResponse= function(selectedPatientAlias, selectedPatientID, serverResponse) {
	// Ensure the ID we sent and the ID we received from the server match
	aux.assert(selectedPatientID === serverResponse.patientID, 
		"ERROR: Browser patient ID and server patient ID do not match.");

	var pgxData= serverResponse;
	pgxData["patientAlias"]= selectedPatientAlias;  // add the patient alias
	pgxData["geneMarkers"]= {}

	// Create list of all marker IDs for each gene by iterating through all 
	// haplotypes and store a unique list of markers
	var genes= Object.keys(pgxData["pgxGenes"]);
	for (var i= 0; i < genes.length; ++i) {
		var geneMarkers= [];
		var geneName= genes[i];

		var haplotypes= Object.keys(pgxData["pgxGenes"][geneName]);
		for (var j= 0; j < haplotypes.length; ++j) {
			var haplotypeName= haplotypes[j];

			var haplotypeMarkers= pgxData["pgxGenes"][geneName][haplotypeName];
			for (var k= 0; k < haplotypeMarkers.length; ++k) {
				// Make sure marker is not already in list (unique list)
				if (geneMarkers.indexOf(haplotypeMarkers[k]) === -1) {
					geneMarkers.push(haplotypeMarkers[k]);
				}
			}
		}

		// Store the list of unique markers in this object
		pgxData["geneMarkers"][geneName]= geneMarkers;
	}

	return Promise.resolve(pgxData);
};


/* Use the GT field to determine if a variant is heterozygous or homozygous.
 * Returns a bool. */
var isHom= function(variant) {
	var homozygous= true;

	// check that all/both genotype indices are identical
	var firstIndex= variant["gt"][0];
	for (var i= 1; i < variant["gt"].length; ++i) {
		if (variant["gt"][i] !== firstIndex) {
			homozygous= false;
		}
	}

	return homozygous;
};


/* Add variants to the known diplotype. These include already phased or 
 * homozygous unphased genotypes. The function modifies the defined diplotype
 * passed to it. A diplotype contains exactly 2 haplotypes, and they can be
 * equivalent.
 * Precondition: variants passed to this function are already known to be
 * phased or homozygous (and unphased). */
var addToDefinedDiplotype= function(marker, variant, diplotype) {
	var definedDiplotype= diplotype;

 	// if empty, initialize defined diplotypes to exactly 2 haplotypes
 	if (definedDiplotype === null) {
 		definedDiplotype= [[], []];
 	}

 	// not using alleles directly, but this may come in handy later:
 	//var alleles= [variant["ref"]].concat(variant["alt"]);

 	for (var i= 0; i < variant["gt"].length; ++i) {
 		if (variant["gt"][i] > 0) {
 			definedDiplotype[i].push(marker);
 		}
 	}

 	return definedDiplotype;
};


/* Remove duplicate haplotypes (lists of markers) from the input array. */
var removeDuplicates= function(haplotypes) {
	var alreadyObservedHaplotypes= {};
	var uniqueHaplotypes= [];
	for (var i= 0; i < haplotypes.length; ++i) {
		var key= haplotypes[i].sort().toString();
		if (alreadyObservedHaplotypes[key] === undefined) {
			alreadyObservedHaplotypes[key]= true;
			uniqueHaplotypes.push(haplotypes[i]);
		}
	}
	return uniqueHaplotypes;
};


/* Return all possible haplotypes by combining already defined haplotypes
 * (based on phased genotypes and unphased homozygous calls) with unphased
 * heterozygous calls. */
var getPossibleHaplotypes= function(definedDiplotype, unphasedHets) {
	var possibleHaplotypes= [];
	if (definedDiplotype !== null) {
		possibleHaplotypes= definedDiplotype.slice();  // copy the array
	}

	var alreadyObservedHaplotypes= {};

	var unphasedHetKeys= Object.keys(unphasedHets);
	for (var i= 0; i < unphasedHetKeys.length; ++i) {
		// If we are entering this loop, we have unphased hets. This means we
		// are going to have more than 2 possible haplotypes. I allow duplicate
		// haplotypes if they are phased. But if unphased, I remove duplicates 
		// because they have no biological significance. Therefore in the first
		// iteration, remove duplicates from defined diplotype.
		if (i === 0) {
			possibleHaplotypes= removeDuplicates(possibleHaplotypes);
		}

		// For each defined haplotype, create a version with the het ref call
		// and a version with the het alt call. 
		// NOTE: potential source of inefficiency here - duplicate haplotypes
		// can occur. By removing these, we shorten our computation. Not urgent.
		var newPossibleHaplotypes= [];
		for (var j= 0; j < possibleHaplotypes.length; ++j) {
			var hetRefCall= possibleHaplotypes[j];
			var hetAltCall= possibleHaplotypes[j].concat(unphasedHetKeys[i])

			// Ensure list of computed/derived possible haplotypes is unique.
			// Don't include duplicates.
			var hetRefCallKey= hetRefCall.sort().toString();
			alreadyObservedHaplotypes[hetRefCallKey]= true;

			var hetAltCallKey= hetAltCall.sort().toString();
			if (alreadyObservedHaplotypes[hetAltCallKey] === undefined) {
				alreadyObservedHaplotypes[hetAltCallKey]= true;
				newPossibleHaplotypes.push(hetAltCall);
			}
		}

		possibleHaplotypes= possibleHaplotypes.concat(newPossibleHaplotypes);
	}

	return possibleHaplotypes;
};


/* Generate all possible haplotypes from the genotype data.
 * This takes into account 
 * Returns a promise. */
var generateAllHaplotypes= function(pgxData) {
	var pgxData= pgxData;
	pgxData["possibleHaplotypes"]= {};

	// Iterate through all genes
	var geneNames= Object.keys(pgxData["pgxGenes"]);  ///// UNBLOCK AFTER MERGED WITH NEW ANNOTATOR
	
	// keep track of markers while iterating over variants
	var markerByID= {};

	for (var i= 0; i < geneNames.length; ++i) {
		// see lab notebook for ideas here: - lists of hashes
		var definedDiplotype= null;
		var unphasedHets= {};
		var possibleHaplotypes= [];

		// Iterate through the markers for this gene, and match variants by
		// coordinates not gene name (which is annotated by annovar)
		var currentGeneMarkers= pgxData["geneMarkers"][geneNames[i]];
		var allVariants= pgxData["variants"];
		for (var j= 0; j < currentGeneMarkers.length; ++j) {
			var m= currentGeneMarkers[j];
			var chrom= pgxData["pgxCoordinates"][m]["chr"];
			var pos= pgxData["pgxCoordinates"][m]["pos"];

			// Match with this patient's variants. Simplest to iterate through
			// all patient variants and match coordinates for current marker
			var found= false;
			for (var k= 0; k < allVariants.length; ++k) {
				var currentVariant= allVariants[k];
				if (chrom === currentVariant["chr"] && pos === currentVariant["pos"]) {
					// marker found
					found= true;
					markerByID[m]= currentVariant;

					if (currentVariant["phased_status"] || isHom(currentVariant)) {
						definedDiplotype= addToDefinedDiplotype(m, currentVariant, definedDiplotype);
					} else {
						unphasedHets[m]= currentVariant;
					}
				}
			}

			// Keep track of markers that weren't found
			if (!found) {
				// arbitrary value, but false makes more sense because it's missing
				markerByID[m]= false;
			}
		}

		possibleHaplotypes= getPossibleHaplotypes(definedDiplotype, unphasedHets);

		// add the possible haplotypes to the main pgx
		pgxData["possibleHaplotypes"][geneNames[i]]= possibleHaplotypes;
		pgxData["markerByID"]= markerByID;
	}

	return Promise.resolve(pgxData);
};


/* Map haplotype representation to markers to create a format that can be used
 * with the edit distance metric. For example (not showing missing marker 
 * representation):
 * 		patient haplotype = [rs1]
 *		markers = [rs1, rs2, rs3, rs4, rs5]
 *		output = "10000"
 * OR
 * 		patient haplotype = [] ; with rs4, rs5 missing
 *		markers = [rs1, rs2, rs3, rs4, rs5]
 *		output = "000mm"	
 * OR
 * 		patient haplotype = [rs3, rs5] ; with rs2 missing
 *		markers = [rs1, rs2, rs3, rs4, rs5]
 *		output = "0m101"
 */	
var haplotypeToString= function(markerByID, haplotype, markers) {
	var output= "";

	for (var i= 0; i < markers.length; ++i) {
		if (markerByID !== null && !markerByID[markers[i]]) {
			output += "m";  // missing
		} else if (haplotype.indexOf(markers[i]) !== -1) {
			output += "1";  // alt (marker found)
		} else {
			output += "0";  // ref (marker not missing and not found)
		}
	}

	return output;
};


/* Translate haplotypes into star nomenclature (or similar) using edit distance
 * allowing us to identify matches to known haplotypes and to indicate 
 * haplotypes which are most similar to the patient's.
 * Returns a promise. */
var translateHaplotypes= function(pgxData) {
	var knownHaplotypes= {};
	var patientHaplotypes= {};

	// Convert all haplotypes (from patient or predefined known ones) to a
	// string representation that can be compared using edit distance.

	var ph= Object.keys(pgxData["possibleHaplotypes"]);
	for (var i= 0; i < ph.length; ++i) {
		var currentGene= ph[i];
		var currentGeneMarkers= pgxData["geneMarkers"][currentGene];

		var haplotypes= pgxData["possibleHaplotypes"][currentGene];
		for (var j= 0; j < haplotypes.length; ++j) {
			var currentHaplotype= haplotypes[j];
			var stringRep= haplotypeToString(
				pgxData["markerByID"], currentHaplotype, currentGeneMarkers);

			// Store patient haplotype, arbitrarily labeled "h1", "h2", etc.
			var tempHaplotypeName= "h" + (j + 1);
			// initialize
			if (patientHaplotypes[currentGene] === undefined) {
				patientHaplotypes[currentGene]= {};
			}
			if (patientHaplotypes[currentGene][tempHaplotypeName] === undefined) {
				patientHaplotypes[currentGene][tempHaplotypeName]= {};
			}

			patientHaplotypes[currentGene][tempHaplotypeName]["haplotype"]= currentHaplotype;
			patientHaplotypes[currentGene][tempHaplotypeName]["stringRep"]= stringRep;
		}
	}

	var pg= Object.keys(pgxData["pgxGenes"]);
	for (var i= 0; i < pg.length; ++i) {
		var currentGene= pg[i];
		var currentGeneMarkers= pgxData["geneMarkers"][currentGene];

		var haplotypeNames= Object.keys(pgxData["pgxGenes"][currentGene]);
		for (var j= 0; j < haplotypeNames.length; ++j) {
			var currentHaplotype= pgxData["pgxGenes"][currentGene][haplotypeNames[j]];
			var stringRep= haplotypeToString(
				null, currentHaplotype, currentGeneMarkers);

			// Store known haplotype using standard names (e.g. star nomenclature)
			// initialize
			if (knownHaplotypes[currentGene] === undefined) {
				knownHaplotypes[currentGene]= {};
			}
			if (knownHaplotypes[currentGene][haplotypeNames[j]] === undefined) {
				knownHaplotypes[currentGene][haplotypeNames[j]]= {};
			}

			knownHaplotypes[currentGene][haplotypeNames[j]]["haplotype"]= currentHaplotype;
			knownHaplotypes[currentGene][haplotypeNames[j]]["stringRep"]= stringRep;
		}
	}

	pgxData["pgxGenesStringRep"]= knownHaplotypes;
	pgxData["possibleHaplotypesStringRep"]= patientHaplotypes;

	return Promise.resolve(pgxData);
};


/* Find the closest matching known haplotypes to the observed patient 
 * haplotypes. Stores the edit distance and all known haplotypes that are that
 * edit distance from this haplotype.
 * Returns a promise. */
var findClosestHaplotypeMatches= function(pgxData) {
	var genes= Object.keys(pgxData["possibleHaplotypesStringRep"]);
	for (var i= 0; i < genes.length; ++i) {
		
		var patientHaplotypes= Object.keys(pgxData["possibleHaplotypesStringRep"][genes[i]]);
		for (var j= 0; j < patientHaplotypes.length; ++j) {
			
			/* For each haplotype, compute the distance to each known haplotype
			 * for this gene. Keep track of the distance and only store the
			 * closest match. If more than one haplotype matches at the same
			 * minimum distance, store all haplotypes. */
			 var minDistance= null;
			 var closestMatch= null;
			 var currentPatientHaplotypeString= 
			 	pgxData["possibleHaplotypesStringRep"][genes[i]][patientHaplotypes[j]]["stringRep"];

			 var knownHaplotypes= Object.keys(pgxData["pgxGenesStringRep"][genes[i]]);
			 for (var k= 0; k < knownHaplotypes.length; ++k) {
			 	var currentKnownHaplotypeString= 
			 		pgxData["pgxGenesStringRep"][genes[i]][knownHaplotypes[k]]["stringRep"];
			 	var tempDistance= aux.getEditDistance(
			 		currentPatientHaplotypeString, currentKnownHaplotypeString);

			 	if (minDistance === null || tempDistance < minDistance) {
			 		minDistance= tempDistance;
			 		closestMatch= [knownHaplotypes[k]];
			 	} else if (tempDistance === minDistance) {
			 		closestMatch.push(knownHaplotypes[k]);
			 	}  // if distance is greater than current min, ignore

			 	/*
			 	// TESTING output
			 	console.log(patientHaplotypes[j], currentPatientHaplotypeString,
			 		knownHaplotypes[k], currentKnownHaplotypeString, "Dist=", tempDistance);
			 	*/
			 }

			 // Store results of this computation
			 pgxData["possibleHaplotypesStringRep"][genes[i]][patientHaplotypes[j]]["minDistance"]=
			 	minDistance;
			 pgxData["possibleHaplotypesStringRep"][genes[i]][patientHaplotypes[j]]["closestMatch"]=
			 	closestMatch;

		}
	}

	return Promise.resolve(pgxData);
};


/* Displays the processed PGx data for this specific patient. */
var loadPGx= function(pgxData) {
	appMain.children().remove();  // clear the current page

	// NOTE: rendering the handlebars template triggers the handlebars block
	// helpers, which dynamically render the HTML.
	asyncRenderHbs('frangipani-pgx.hbs', pgxData)
	.then(function(html) {
		appMain.append(html);
		addEventListeners();
	});
};


/* Handlebars block helper to output all PGx markers for this gene. */
Handlebars.registerHelper('markerHeader', function(context, options) {
	var renderedHtml= "";
	var currentGene= context;

	// Match dbSNP rs IDs and capture the number
	var rsPattern= /rs(\d+)/;

	var currentGeneMarkers= globalPGXData["geneMarkers"][currentGene];
	for (var i= 0; i < currentGeneMarkers.length; ++i) {
		var rsMatch= rsPattern.exec(currentGeneMarkers[i])
		if (rsMatch !== null) {
			var url= "http://www.ncbi.nlm.nih.gov/projects/SNP/snp_ref.cgi?rs=" + rsMatch[1];
			renderedHtml += "<th><a target='_blank' href='" + url + "'>" + currentGeneMarkers[i] + "</a></th>";
		} else {
			renderedHtml += "<th>" + currentGeneMarkers[i] + "</th>";
		}
	}

	return renderedHtml;
});


/* Handlebars block helper to output PGx known haplotype genotypes.
 * This helper is going to be a little messy, but this particular task is a bit
 * complicated and I don't think can be acheived within the template itself. */
Handlebars.registerHelper('haplotypeMarkers', function(context, options) {
	var renderedHtml= "";
	var currentGene= options.data._parent.key;
	var currentHaplotype= context;

	var currentGeneMarkers= globalPGXData["geneMarkers"][currentGene];

	for (var i= 0; i < currentGeneMarkers.length; ++i) {
		var m= currentGeneMarkers[i];

		// Convert Alt genotypes to uppercase (Alts are in array, unlike Ref)
		var uppercaseAlts= [];
		for (var j= 0; j < globalPGXData["pgxCoordinates"][m]["alt"].length; ++j) {
			uppercaseAlts.push(globalPGXData["pgxCoordinates"][m]["alt"][j].toUpperCase());
		}

		var haplotypeMarkers= globalPGXData["pgxGenes"][currentGene][currentHaplotype];
		if (haplotypeMarkers.indexOf(m) !== -1) {  // haplotype is defined by this marker
			renderedHtml += "<td class='variant-alt'>" + 
				uppercaseAlts.toString() + "</td>"; // alt is an array
		} else {
			renderedHtml += "<td>" + globalPGXData["pgxCoordinates"][m]["ref"].toUpperCase() + "</td>";
		}
	}

	return renderedHtml;
});


/* Handlebars block helper to output PGx patient haplotype genotypes.
 * This helper is going to be a little messy, but this particular task is a bit
 * complicated and I don't think can be acheived within the template itself. */
Handlebars.registerHelper('patientGenotypes', function(options) {
	var renderedHtml= "";
	var currentGene= options.data.key;

	// If there are no haplotypes recorded for this individual, skip
	if (globalPGXData["possibleHaplotypesStringRep"][currentGene] === undefined) {
		return;
	}

	// Iterate over all patient possible haplotypes
	var markerByID= globalPGXData["markerByID"];
	var patientHaplotypes= Object.keys(globalPGXData["possibleHaplotypesStringRep"][currentGene]);
	for (var i= 0; i < patientHaplotypes.length; ++i) {
		var haplotypeName= patientHaplotypes[i];

		// Output the haplotype name and haplotype matches. If a the minimum
		// distance to the nearest reference haplotype == 0, it's a match.
		// Otherwise, we will consider it "similar to".
		var similarString= "";
		if (globalPGXData["possibleHaplotypesStringRep"][currentGene][haplotypeName]["minDistance"] > 0) {
			similarString= "similar to ";
		}
		var hapNameAndMatches= haplotypeName + " (" + similarString +
			globalPGXData["possibleHaplotypesStringRep"][currentGene][haplotypeName]["closestMatch"]
			.toString() + ")";

		renderedHtml += "<tr class='patient-genotype-row'><td><em>" + hapNameAndMatches + "<em></td>";
	
		var currentGeneMarkers= globalPGXData["geneMarkers"][currentGene];
		for (var j= 0; j < currentGeneMarkers.length; ++j) {
			var m= currentGeneMarkers[j];

			// if this marker isn't missing, check if patient is ref or alt
			if (!markerByID[m]) {  // missing
				renderedHtml += "<td class='variant-alt'>missing</td>";
			} else if (globalPGXData["possibleHaplotypesStringRep"][currentGene][haplotypeName]["haplotype"].indexOf(m) !== -1) {  // alt

				var altGenotype= markerByID[m]["alt"];

				if (Object.prototype.toString.call(altGenotype) == "[object String]") {
					renderedHtml += "<td class='variant-alt'>" + altGenotype.toUpperCase() + "</td>";
				} else if (Object.prototype.toString.call(altGenotype) == "[object Array]") {
				/* How to process GT alts into haplotypes:
				 * NOTE: at this point, haplotypes have already been phased by
				 * generateAllHaplotypes().
				 * 1) If only one GT index > 0 (eg. 0/1, 1|0, 2/0) use the
				 * index that is > 0.
				 * 2) If there are 2 GT indexes > 0 (eg. 1/2, 2|1) output both
				 * the corresponding genotypes.
				 * 3) If the genotypes are phased, we run into a complication
				 * for GT's like "2|1" because this appears as a heterozygous
				 * call, even though the call is effectively homozygous for the
				 * marker (using two different alt alleles). So in this case,
				 * we ignore the phased status and output both alleles. It's
				 * also hard to incorporate these phased exceptions if some
				 * markers of this gene are unphased. Outputting both alts is
				 * acceptable:
				 * ex.	Ref= "A", Alt= "G,C,T", GT= 2|1
				 * 		we output, "G,C"
				 */
					var indexes= [];
					var gtArray= markerByID[m]["gt"];
					for (var k= 0; k < gtArray.length; ++k) {
						if (gtArray[k] > 0) {
							indexes.push(gtArray[k]);
						}
					}

					var possibleAltGenotypes= [];
					for (var k= 0; k < indexes.length; ++k) {
						// subtract 1 from index because 0 == ref and we're starting from alt #1
						possibleAltGenotypes.push(altGenotype[indexes[k] - 1]);
					}

					renderedHtml += "<td class='variant-alt'>" + possibleAltGenotypes.toString().toUpperCase() + "</td>";
				}
			} else {  // ref
				renderedHtml += "<td>" + markerByID[m]["ref"].toUpperCase() + "</td>";
			}
		}

		renderedHtml += "</tr>";
	}

	return renderedHtml;
});


/* Add the event listeners */
var addEventListeners= function() {
	// Listen for row clicks and then select the patient ID child.
	$("tr.patient-row").on("click", function() {
		var selectedPatientID= $(this).children("[class~='frangipani-patient-id']").text();
		var selectedPatientAlias= $(this).children("[class~='frangipani-patient-alias']").text();
		Promise.resolve($.ajax({
				url: "/pgx",
				type: "POST",
				contentType: "application/json",
				dataType: "json",
				data: JSON.stringify({
					"patient_id": selectedPatientID
				})
		}))
		.then(function(result) {
			return processPGXResponse(selectedPatientAlias, selectedPatientID, result);
		})
		.then(function(result) {
			return generateAllHaplotypes(result);
		})
		.then(function(result) {
			return translateHaplotypes(result);
		})
		.then(function(result) {
			return findClosestHaplotypeMatches(result);
		})
		.then(function(result) {
			globalPGXData= result;  // set the globally-scoped PGX Data
			loadPGx(result);

			console.log("TESTING globalPGXData:", globalPGXData); ////////////// TESTING
		});
	});
};


/* 
 * Set up a ready handler, a function to run when the DOM is ready
 */
var handler= function() {
	loadPatients();
};


/* 
 * Wait for the DOM to load before any processing.
 */
$(document).ready(handler);

})();




