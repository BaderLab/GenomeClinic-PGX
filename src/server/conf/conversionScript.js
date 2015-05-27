var fs = require('fs');
var d = require('./dosing_guidelines.json');


var out = {};
var repeat = [];
var temp;
var c,e,f,g;
for (var i = 0; i < d.length; i++ ){
	temp = {};
	c = d[i];
	if (!out.hasOwnProperty(c.pgx_1)){
		out[c.pgx_1] = {
			gene:c.pgx_1,
			recomendations:{},
			haplotypes:{}
		};
	}
	if (!out[c.pgx_1].recomendations.hasOwnProperty(c.drug)){
		out[c.pgx_1].recomendations[c.drug] = {};
	}

	if (!out[c.pgx_1].recomendations[c.drug].hasOwnProperty(c.class_1)){
		out[c.pgx_1].recomendations[c.drug][c.class_1] = {};
	}

	if (!out[c.pgx_1].recomendations[c.drug][c.class_1].hasOwnProperty('secondary')){
			out[c.pgx_1].recomendations[c.drug][c.class_1].secondary = {};	
	}

	if (c.pgx_2){
		e = out[c.pgx_1].recomendations[c.drug][c.class_1].secondary;
		if (!e.hasOwnProperty(c.pgx_2)){
			e[c.pgx_2] = {};
		}
		if (!e[c.pgx_2].hasOwnProperty(c.class_2)){
			e[c.pgx_2][c.class_2] = {}
		}

		e[c.pgx_2][c.class_2].rec = c.rec;
		e[c.pgx_2][c.class_2].risk = c.risk;
		e[c.pgx_2][c.class_2].pubmed = c.pubmed.split('|');

		temp.pgx_1 = c.pgx_2;
		temp.pgx_2 = c.pgx_1;
		temp.rec = c.rec;
		temp.pubmed = c.pubmed;
		temp.risk = c.risk
		temp.class_2 = c.class_1;
		temp.class_1 = c.class_2;
		temp.drug = c.drug;
		repeat.push(temp);

	} else {
		e = out[c.pgx_1].recomendations[c.drug][c.class_1]
		e.risk = c.risk;
		e.rec = c.rec;
		e.pubmed = c.pubmed.split('|');
	}
}

console.log(repeat.length);
for (var i = 0; i < repeat.length; i++ ){
	c = repeat[i];
	if (!out.hasOwnProperty(c.pgx_1)){
		out[c.pgx_1] = {
			gene:c.pgx_1,
			recomendations:{},
			haplotypes:{}
		};
		console.log(c.pgx_1 + ' created')
	}
	if (!out[c.pgx_1].recomendations.hasOwnProperty(c.drug)){
		out[c.pgx_1].recomendations[c.drug] = {};
	}

	if (!out[c.pgx_1].recomendations[c.drug].hasOwnProperty(c.class_1)){
		out[c.pgx_1].recomendations[c.drug][c.class_1] = {};
	}

	if (!out[c.pgx_1].recomendations[c.drug][c.class_1].hasOwnProperty('secondary')){
			out[c.pgx_1].recomendations[c.drug][c.class_1].secondary = {};	
	}

	if (c.pgx_2){
		e = out[c.pgx_1].recomendations[c.drug][c.class_1].secondary;
		if (!e.hasOwnProperty(c.pgx_2)){
			e[c.pgx_2] = {};
		}
		if (!e[c.pgx_2].hasOwnProperty(c.class_2)){
			e[c.pgx_2][c.class_2] = {}
		}

		e[c.pgx_2][c.class_2].rec = c.rec;
		e[c.pgx_2][c.class_2].risk = c.risk;
		e[c.pgx_2][c.class_2].pubmed = c.pubmed.split('|');

	} else {
		e = out[c.pgx_1].recomendations[c.drug][c.class_1]
		e.risk = c.risk;
		e.rec = c.rec;
		e.pubmed = c.pubmed.split('|');
	}
}

var finalout = [];
var keys = Object.keys(out);
for (var i=0; i < keys.length; i ++ ){
	finalout.push(out[keys[i]]);
}

fs.writeFileSync('new_dosing_guidelines.json',JSON.stringify(finalout,0,4));