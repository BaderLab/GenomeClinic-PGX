var fs = require('fs');
var d = require('./old_dosing_guidelines.json');

var out = {};
var genes = [];
var future = [];
var recomendations = [];


function sortWithIndeces(toSort) {
  for (var i = 0; i < toSort.length; i++) {
    toSort[i] = [toSort[i], i];
  }
  toSort.sort(function(left, right) {
    return left[0] < right[0] ? -1 : 1;
  });
  toSort.sortIndices = [];
  for (var j = 0; j < toSort.length; j++) {
    toSort.sortIndices.push(toSort[j][1]);
    toSort[j] = toSort[j][0];
  }
  return toSort;
}


// recomendation
/* {_id:"",genes =[alphabetically ordered genes],classes=[classes with same ordering as genes],rec:<recording>,pubmed:[],risk:"",drug:""}
 *
 * Future:
 * {_id: "", gene: "", class:"",rec:""}
 *
 */
var tempF = {};
var tempR = {};
var tempG = {};
var risk,riskKeys,secondaryKeys,secClasses,unsortG,unsortC;
for (var i=0; i<d.length; i++ ){
	//set new TempG
	tempG = {};
	tempG.gene = d[i].gene;
	tempG.recomendations = [];
	tempG.future = [];
	tempG.haplotypes = [];

	genes.push(tempG);

	//now set future Recomendaitons;
	for (risk in d[i].future){
		if (d[i].future.hasOwnProperty(risk)){
			tempF = {};
			tempF.gene = d[i].gene;
			tempF.class = risk;
			tempF.rec = d[i].future[risk].rec;

			future.push(tempF);
		}
	}
	var drugs = Object.keys(d[i].recomendations);
	for (var j = 0; j < drugs.length; j++ ) {
		riskKeys = Object.keys(d[i].recomendations[drugs[j]]);
		for (var k= 0; k < riskKeys.length; k++ ){
			tempR = {};
			//base level;
			tempR.genes = [d[i].gene];
			tempR.classes = [riskKeys[k]]
			tempR.rec = d[i].recomendations[drugs[j]][riskKeys[k]].rec
			tempR.drug = drugs[j];
			var pubmed = d[i].recomendations[drugs[j]][riskKeys[k]].pubmed;
			if (pubmed == undefined) pubmed = [];
			else if (pubmed.length == 1 && pubmed[0] == "" ) pubmed = [];
			tempR.pubmed = pubmed; 
			tempR.risk = d[i].recomendations[drugs[j]][riskKeys[k]].risk;

			recomendations.push(tempR);

			//Descend into secondary;
			secondaryKeys = Object.keys(d[i].recomendations[drugs[j]][riskKeys[k]].secondary);
			for (var l = 0; l < secondaryKeys.length; l++ ){
				secClasses = Object.keys(d[i].recomendations[drugs[j]][riskKeys[k]].secondary[secondaryKeys[l]]);
				for (var m = 0; m < secClasses.length; m ++ ){
					unsortG = undefined;
					unsortC = undefined;
					tempR = {};
					unsortG = [d[i].gene,secondaryKeys[l]];
					unsortC = [riskKeys[k],secClasses[m]];
					sortWithIndeces(unsortG);
					tempR.genes = unsortG.splice(0,unsortG.length);
					tempR.classes = [];
					for (var ind = 0; ind < unsortC.length; ind++){
						tempR.classes.push(unsortC[unsortG.sortIndices[ind]]);
					}
					tempR.rec = d[i].recomendations[drugs[j]][riskKeys[k]].secondary[secondaryKeys[l]][secClasses[m]].rec;
					tempR.drug = drugs[j];
					var pubmed = d[i].recomendations[drugs[j]][riskKeys[k]].secondary[secondaryKeys[l]][secClasses[m]].pubmed;
					if (pubmed == undefined) pubmed = [];
					else if (pubmed.length == 1 && pubmed[0] == "" ) pubmed = [];
					tempR.pubmed = d[i].recomendations[drugs[j]][riskKeys[k]].secondary[secondaryKeys[l]][secClasses[m]].pubmed;
					tempR.risk = d[i].recomendations[drugs[j]][riskKeys[k]].secondary[secondaryKeys[l]][secClasses[m]].risk
					

					recomendations.push(tempR);
				}
			}
		}
	}
}


fs.writeFileSync('dosing_guidelines.json',JSON.stringify(recomendations,0,4));
fs.writeFileSync('future_guidelines.json',JSON.stringify(future,0,4));