/*
 * Frangipani pharmacogenomics app JavaScript.
 * @author Ron Ammar
*/

var $ = require("jquery"),
	templates = require('./templates'),
	utility = require('./utility'),
	Handlebars = require('hbsfy/runtime');

///// main object to be returned
var pgx =  {
	//dumo for pgx data
	globalPGXData: {},
	templateData:undefined,
	// Original colour of the haplotype variant table collapse button
	originalCollapseButtonColor: "rgb(0, 123, 164)",
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
	  if(a.length === 0) return b.length; 
	  if(b.length === 0) return a.length; 
	 
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
	},
	/* Process the PGx data received from the server for this specific patient. */
	processPGXResponse:function(selectedPatientAlias, selectedPatientID, serverResponse) {
		// Ensure the ID we sent and the ID we received from the server match
		utility.assert(selectedPatientID === serverResponse.patientID, 
			"ERROR: Browser patient ID and server patient ID do not match.");

		var pgxData= serverResponse;
		pgxData.patientAlias = selectedPatientAlias;  // add the patient alias
		pgxData.geneMarkers = {};

		// Create list of all marker IDs for each gene by iterating through all 
		// haplotypes and store a unique list of markers
		var genes= Object.keys(pgxData.pgxGenes);
		for (var i= 0; i < genes.length; ++i) {
			var geneMarkers= [];
			var geneName= genes[i];

			var haplotypes= Object.keys(pgxData.pgxGenes[geneName]);
			for (var j= 0; j < haplotypes.length; ++j) {
				var haplotypeName= haplotypes[j];

				var haplotypeMarkers= pgxData.pgxGenes[geneName][haplotypeName];
				for (var k= 0; k < haplotypeMarkers.length; ++k) {
					// Make sure marker is not already in list (unique list)
					if (geneMarkers.indexOf(haplotypeMarkers[k]) === -1) {
						geneMarkers.push(haplotypeMarkers[k]);
					}
				}
			}

			// Store the list of unique markers in this object
			pgxData.geneMarkers[geneName]= geneMarkers;
		}

		return Promise.resolve(pgxData);
	},
	/* Use the GT field to determine if a variant is heterozygous or homozygous.
	 * Returns a bool. */
	isHom : function(variant) {
		var homozygous= true;
		// check that all/both genotype indices are identical
		var firstIndex= variant.gt[0];
		for (var i= 1; i < variant.gt.length; ++i) {
			if (variant.gt[i] !== firstIndex) {
				homozygous= false;
			}
		}
		return homozygous;
	},
	/* Add variants to the known diplotype. These include already phased or 
	 * homozygous unphased genotypes. The function modifies the defined diplotype
	 * passed to it. A diplotype contains exactly 2 haplotypes, and they can be
	 * equivalent.
	 * Precondition: variants passed to this function are already known to be
	 * phased or homozygous (and unphased). */
	addToDefinedDiplotype: function(marker, variant, diplotype) {
		var definedDiplotype= diplotype;

	 	// if empty, initialize defined diplotypes to exactly 2 haplotypes
	 	if (definedDiplotype === null) {
	 		definedDiplotype= [[], []];
	 	}

	 	// not using alleles directly, but this may come in handy later:
	 	//var alleles= [variant["ref"]].concat(variant["alt"]);

	 	for (var i= 0; i < variant.gt.length; ++i) {
	 		if (variant.gt[i] > 0) {
	 			definedDiplotype[i].push(marker);
	 		}
	 	}

	 	return definedDiplotype;
	},
	/* Remove duplicate haplotypes (lists of markers) from the input array. */
	removeDuplicates: function(haplotypes) {
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
	},
	/* Return all possible haplotypes by combining already defined haplotypes
	 * (based on phased genotypes and unphased homozygous calls) with unphased
	 * heterozygous calls. */
	getPossibleHaplotypes: function(definedDiplotype, unphasedHets) {
		var self = this;
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
				possibleHaplotypes= self.removeDuplicates(possibleHaplotypes);
			}

			// For each defined haplotype, create a version with the het ref call
			// and a version with the het alt call. 
			// NOTE: potential source of inefficiency here - duplicate haplotypes
			// can occur. By removing these, we shorten our computation. Not urgent.
			var newPossibleHaplotypes= [];
			for (var j= 0; j < possibleHaplotypes.length; ++j) {
				var hetRefCall= possibleHaplotypes[j];
				var hetAltCall= possibleHaplotypes[j].concat(unphasedHetKeys[i]);

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
	},
	/* Generate all possible haplotypes from the genotype data.
	 * This takes into account 
	 * Returns a promise. */
	generateAllHaplotypes: function(pgxData) {
		var self = this;
		pgxData.possibleHaplotypes= {};

		// Iterate through all genes
		var geneNames= Object.keys(pgxData.pgxGenes);  ///// UNBLOCK AFTER MERGED WITH NEW ANNOTATOR
		
		// keep track of markers while iterating over variants
		var markerByID= {};

		for (var i= 0; i < geneNames.length; ++i) {
			// see lab notebook for ideas here: - lists of hashes
			var definedDiplotype= null;
			var unphasedHets= {};
			var possibleHaplotypes= [];

			// Iterate through the markers for this gene, and match variants by
			// coordinates not gene name (which is annotated by annovar)
			var currentGeneMarkers= pgxData.geneMarkers[geneNames[i]];
			var allVariants= pgxData.variants;
			for (var j= 0; j < currentGeneMarkers.length; ++j) {
				var m= currentGeneMarkers[j];
				var chrom= pgxData.pgxCoordinates[m].chr;
				var pos= pgxData.pgxCoordinates[m].pos;

				// Match with this patient's variants. Simplest to iterate through
				// all patient variants and match coordinates for current marker
				var found= false;
				for (var k= 0; k < allVariants.length; ++k) {
					var currentVariant= allVariants[k];
					if (chrom === currentVariant.chr && pos === currentVariant.pos) {
						// marker found
						found= true;
						markerByID[m]= currentVariant;

						if (currentVariant.phased_status || self.isHom(currentVariant)) {
							definedDiplotype= self.addToDefinedDiplotype(m, currentVariant, definedDiplotype);
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

			possibleHaplotypes= self.getPossibleHaplotypes(definedDiplotype, unphasedHets);

			// add the possible haplotypes to the main pgx
			pgxData.possibleHaplotypes[geneNames[i]]= possibleHaplotypes;
			pgxData.markerByID= markerByID;
		}

		return Promise.resolve(pgxData);
	},
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
	haplotypeToString: function(markerByID, haplotype, markers) {
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
	},

	/* Translate haplotypes into star nomenclature (or similar) using edit distance
	 * allowing us to identify matches to known haplotypes and to indicate 
	 * haplotypes which are most similar to the patient's.
	 * Returns a promise. */
	translateHaplotypes: function(pgxData) {
		var knownHaplotypes= {};
		var patientHaplotypes= {};
		var self = this;

		// Convert all haplotypes (from patient or predefined known ones) to a
		// string representation that can be compared using edit distance.

		var ph= Object.keys(pgxData.possibleHaplotypes);
		for (var i= 0; i < ph.length; ++i) {
			var currentGene= ph[i];
			var currentGeneMarkers= pgxData.geneMarkers[currentGene];

			var haplotypes= pgxData.possibleHaplotypes[currentGene];
			for (var j= 0; j < haplotypes.length; ++j) {
				var currentHaplotype= haplotypes[j];
				var stringRep= self.haplotypeToString(
					pgxData.markerByID, currentHaplotype, currentGeneMarkers);

				// Store patient haplotype, arbitrarily labeled "h1", "h2", etc.
				var tempHaplotypeName= "h" + (j + 1);
				// initialize
				if (patientHaplotypes[currentGene] === undefined) {
					patientHaplotypes[currentGene]= {};
				}
				if (patientHaplotypes[currentGene][tempHaplotypeName] === undefined) {
					patientHaplotypes[currentGene][tempHaplotypeName]= {};
				}

				patientHaplotypes[currentGene][tempHaplotypeName].haplotype= currentHaplotype;
				patientHaplotypes[currentGene][tempHaplotypeName].stringRep= stringRep;
			}
		}

		var pg= Object.keys(pgxData.pgxGenes);
		for (var i= 0; i < pg.length; ++i) {
			var currentGene= pg[i];
			var currentGeneMarkers= pgxData.geneMarkers[currentGene];

			var haplotypeNames= Object.keys(pgxData.pgxGenes[currentGene]);
			for (var j= 0; j < haplotypeNames.length; ++j) {
				var currentHaplotype= pgxData.pgxGenes[currentGene][haplotypeNames[j]];
				var stringRep= self.haplotypeToString(
					null, currentHaplotype, currentGeneMarkers);

				// Store known haplotype using standard names (e.g. star nomenclature)
				// initialize
				if (knownHaplotypes[currentGene] === undefined) {
					knownHaplotypes[currentGene]= {};
				}
				if (knownHaplotypes[currentGene][haplotypeNames[j]] === undefined) {
					knownHaplotypes[currentGene][haplotypeNames[j]]= {};
				}

				knownHaplotypes[currentGene][haplotypeNames[j]].haplotype= currentHaplotype;
				knownHaplotypes[currentGene][haplotypeNames[j]].stringRep= stringRep;
			}
		}

		pgxData.pgxGenesStringRep= knownHaplotypes;
		pgxData.possibleHaplotypesStringRep= patientHaplotypes;

		return Promise.resolve(pgxData);
	},
	/* Find the closest matching known haplotypes to the observed patient 
	 * haplotypes. Stores the edit distance and all known haplotypes that are that
	 * edit distance from this haplotype.
	 * Returns a promise. */
	findClosestHaplotypeMatches: function(pgxData) {
		var self = this;
		var genes= Object.keys(pgxData.possibleHaplotypesStringRep);
		for (var i= 0; i < genes.length; ++i) {
			
			var patientHaplotypes= Object.keys(pgxData.possibleHaplotypesStringRep[genes[i]]);
			for (var j= 0; j < patientHaplotypes.length; ++j) {
				
				/* For each haplotype, compute the distance to each known haplotype
				 * for this gene. Keep track of the distance and only store the
				 * closest match. If more than one haplotype matches at the same
				 * minimum distance, store all haplotypes. */
				 var minDistance= null;
				 var closestMatch= null;
				 var currentPatientHaplotypeString= 
				 	pgxData.possibleHaplotypesStringRep[genes[i]][patientHaplotypes[j]].stringRep;

				 var knownHaplotypes= Object.keys(pgxData.pgxGenesStringRep[genes[i]]);
				 for (var k= 0; k < knownHaplotypes.length; ++k) {
				 	var currentKnownHaplotypeString= 
				 		pgxData.pgxGenesStringRep[genes[i]][knownHaplotypes[k]].stringRep;
				 	var tempDistance= self.getEditDistance(
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
				 pgxData.possibleHaplotypesStringRep[genes[i]][patientHaplotypes[j]].minDistance=
				 	minDistance;
				 pgxData.possibleHaplotypesStringRep[genes[i]][patientHaplotypes[j]].closestMatch=
				 	closestMatch;

			}
		}

		return Promise.resolve(pgxData);
	},
	/* Displays the processed PGx data for this specific patient. */
	loadPGx: function(selectedPatientID,selectedPatientAlias) {
		var self = this;
		// NOTE: rendering the handlebars template triggers the handlebars block
		// helpers, which dynamically render the HTML.
		self.generatePgxResults(selectedPatientID,selectedPatientAlias)
		.then(function(){
			return self.convertTotemplateData();
		}).then(function(result){
			return templates.pgx(result);
		}).then(function(html) {
			$('#main').html(html);
			self.addEventListeners();
		}).then(function(){
			utility.refresh();
		});
	},
	generatePgxResults: function(selectedPatientID,selectedPatientAlias){
		var self = this;
		return Promise.resolve($.ajax({
			url: "/pgx",
			type: "POST",
			contentType: "application/json",
			dataType: "json",
			data: JSON.stringify({
				"patient_id": selectedPatientID
			})
		}))
		.then(function(result) {
				return self.processPGXResponse(selectedPatientAlias, selectedPatientID, result);
		})
		.then(function(result) {
			return self.generateAllHaplotypes(result);
		})
		.then(function(result) {
			return self.translateHaplotypes(result);
		})
		.then(function(result) {
			return self.findClosestHaplotypeMatches(result);
		})
		.then(function(result) {
			self.globalPGXData= result;  // set the globally-scoped PGX Data
			return result;
		});
	},

	/* Add the event listeners */
 	addEventListeners: function() {
 		var self = this;
		// Animate haplotype variant tables with buttons and sliding tables
		var expand= function(element) {
			$(element).attr("expanded", "yes");
			$(element).css("color", "#FFAD99");
			$(element).css("transform", "rotate(45deg)");
		};

		var collapse= function(element) {
			$(element).attr("expanded", "no");
			$(element).css("color", self.originalCollapseButtonColor);
			$(element).css("transform", "rotate(0deg)");
		};

		$("i.haplotype-expand").on("click", function(event) {
			// prevent default <a href="#"> click event (jumps to top of page)
			event.preventDefault();

			// set the original colour for the collapse/expand toggle button
			if (self.originalCollapseButtonColor === undefined) {
				self.originalCollapseButtonColor= $(this).css("color");
			}

			// toggle expand/collapse
			if ($(this).attr("expanded") === "no") {
				expand($(this));
			} else if ($(this).attr("expanded") === "yes") {
				collapse($(this));
			}

			var currentTable= "#table" + $(this).attr("gene");
			$(currentTable).slideToggle();
		});

		// Collapse all haplotype variant tables
		$("#collapse-all-haplotypes").on('click',function(event) {
			event.preventDefault();

			var collapseText= "Show less";
			var expandText= "Show more";
			var allCollapseButtons= $("i.haplotype-expand");

			// Toggle collapse/expand
			if ($("#collapse-all-haplotypes").text() === collapseText) {
				$("#collapse-all-haplotypes").text(expandText);
				for (var i= 0; i < allCollapseButtons.length; ++i) {
					collapse(allCollapseButtons[i]);
				}
				$(".haplotype-expand-div").slideUp();
			} else {
				$("#collapse-all-haplotypes").text(collapseText);
				for (var i= 0; i < allCollapseButtons.length; ++i) {
					expand(allCollapseButtons[i]);
				}
				$(".haplotype-expand-div").slideDown();
			}
		});
	},

	//Yes I know this is wasteful, However I really dont want to break any of the previous code
	convertTotemplateData:function(){
		var self = this;
		var promise = new Promise(function(resolve,reject){
			var templateData = {pgxGenes : []};
			templateData.disclaimer = self.globalPGXData.disclaimer;
			templateData.patientID = self.globalPGXData.patientID;
			templateData.patientAlias = self.globalPGXData.patientAlias;
			var _o;
			for (var gene in self.globalPGXData.pgxGenes){
				_o = {};
				_o.gene = gene;
				_o.heads = self.markerHeads(gene);
				_o.possibleHaplotypes = self.listPossibleHaplotypes(gene);
				_o.patientHaplotypes = self.listPatientHaplotypes(gene);
				_o.haplotypes = self.listHaplotypes(gene);
				templateData.pgxGenes.push(_o);
			}
			resolve(templateData);
		});
		return promise;
	},

	listHaplotypes:function(gene){
		var m, uppercaseAlts,o,_v;
		var out = [];
		var currentHaplotype;
		var haplotypes = this.globalPGXData.pgxGenes[gene];
		var m = this.globalPGXData.geneMarkers[gene];
		for (var hap in haplotypes){
			o = {};
			o.name = hap;
			o.variants = [];
			if (haplotypes.hasOwnProperty(hap)){
				for (var i = 0; i < m.length; i++){
					_v = {};
					//If there are alt alleles present, and the current haplotype has the current marker
					if (this.globalPGXData.pgxCoordinates[m[i]].alt.length > 0 && haplotypes[hap].indexOf(m[i]) !== -1 ){
						_v.class="alt";
						_v.variant=this.globalPGXData.pgxCoordinates[m[i]].alt.toString().toUpperCase();
					} else {
						_v.class="ref";
						_v.variant=this.globalPGXData.pgxCoordinates[m[i]].ref.toString().toUpperCase();
					}
					o.variants.push(_v);
				}
				out.push(o);
			}
		}
		return out;
	},

	listPossibleHaplotypes:function(gene){
		var out = [];
		var possibleHaplotypeKeys = [];
		var possibleHaplotypeStrings = [];
		var o;
		if (pgx.globalPGXData.possibleHaplotypesStringRep[gene] !== undefined)
			possibleHaplotypeKeys= Object.keys(pgx.globalPGXData.possibleHaplotypesStringRep[gene]);
		for (var i= 0; i < possibleHaplotypeKeys.length; ++i) {
			o = {};
			if (i == possibleHaplotypeKeys.length - 1)
				o.after = '';
			else
				o.after = ',';

			o.string = pgx.globalPGXData.possibleHaplotypesStringRep[gene][possibleHaplotypeKeys[i]].closestMatch;
			out.push(o);
		}
		return out;
	},

	listPatientHaplotypes:function(gene){
		var hname,o,v,m; 
		var out = [];
		if (this.globalPGXData.possibleHaplotypesStringRep[gene] === undefined)
			return undefined;
		var markers = this.globalPGXData.markerByID;
		var phap = Object.keys(this.globalPGXData.possibleHaplotypesStringRep[gene]);
		console.log(phap);
		for (var i=0; i< phap.length; i++){
			o = {};
			o.name = phap[i];
			if (this.globalPGXData.possibleHaplotypesStringRep[gene][o.name].minDistance > 0) {
				o.name += " ( similar to " + this.globalPGXData.possibleHaplotypesStringRep[gene][o.name].closestMatch.toString() + ")";
			}
			console.log(o);
			m = pgx.globalPGXData.geneMarkers[gene];
			o.variants = [];
			for (var j=0; j < m.length; j++){
				v = {};
				if (!markers[m[j]]){
					v.variant = 'missing';
					v.class = 'alt';
				} else if (this.globalPGXData.possibleHaplotypesStringRep[currentGene][haplotypeName].haplotype.indexOf(m[j]) !== -1) {
					var altGenotype= markers[m[j]].alt;
					if (Object.prototype.toString.call(altGenotype) == "[object String]") {
						v.variant=altGenotype;
						v.class='alt';
					} else if (Object.prototype.toString.call(altGenotype) == "[object Array]") {
						var indexes= [];
						var gtArray= markers[m[j]].gt;
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
						v.variant = possibleAltGenotypes.toString().toUpperCase();
						v.class="alt";
					}
				} else {  // ref
					v.variant = markers[m[j]].ref.toUpperCase();
					v.class = "ref";
				}
				o.variants.push(v);
			}
			out.push(o);
		}
		return out;
	},

	markerHeads:function(gene){
		var markers = [];
		var c = this.globalPGXData.geneMarkers[gene];
		var pattern=/rs(\d+)/;
		for (var i=0; i < c.length; i++){
			var o = {};
			var match = pattern.exec(c[i]);
			if (match !== null)
				o.url = "http://www.ncbi.nlm.nih.gov/projects/SNP/snp_ref.cgi?rs=" + match[1];
			o.id = c[i];
			markers.push(o);
		}
		return markers;
	}

};

module.exports = pgx;



