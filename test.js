var http = require('http');
var $ = require('jquery')
var parseString = require('xml2js').parseString;

var options =  {
	host:'eutils.ncbi.nlm.nih.gov',
	path:'/entrez/eutils/efetch.fcgi?db=snp&id=1045642,1051266,1057910,1061235,1065852,1128503,1135840,1142345,12248560,12979860,16947,17884712,1799853,1800460,1800462,1800497,1800584,1801131,1801133,1954787,2032582,2108622,2228001,2231137,2231142,2306283,2395029,28371686,28371706,28371725,28399504,2844682,35742686,3892097,3909184,3918290,41291556,4149056,4244285,4633,4680,4818,4986893,5030655,5030656,67376798,776746,9332131,9923231,28371735,72549346,72549352,61736512,72549357,5030862,769258&retmode=xml'
}


var opposite = {
	"A":"T",
	"T":"A",
	"C":"G",
	"G":"C"
}

var cb = function(response){
	var xml = '';
	var obj;

	response.on('data',function(chunk){
		xml += chunk;
	});

	response.on('end',function(){
		parseString(xml,function(err,result){
			var o,strand,alts = [],ref="",tempString;
			var out = [];
			var temp;
			var rs = result.ExchangeSet.Rs;
			console.log(rs[31].Assembly[0].Component[0].MapLoc[0])//.FxnSet[j].$.allele)
			for (var i = 0; i < rs.length; i ++ ){
			//	console.log(i);
				temp = {};
				o = rs[i];
				//console.log(o);
				temp._id = 'rs' + o.$.rsId;
				temp.build = o.Assembly[0].$.dbSnpBuild;
				temp.assembly = o.Assembly[0].$.genomeBuild;
				temp.assemblyLabel = o.Assembly[0].$.groupLabel;
				temp.chr = o.Assembly[0].Component[0].$.chromosome;
				temp.pos = o.Assembly[0].Component[0].MapLoc[0].$.asnFrom;
				temp.end = o.Assembly[0].Component[0].MapLoc[0].$.asnTo;

				strand = o.Assembly[0].Component[0].MapLoc[0].$.orient;
				if (strand.search(/rev/i) == 0){
					for (var k = 0; k < o.Assembly[0].Component[0].MapLoc[0].$.refAllele.length; k++){
						ref += opposite[o.Assembly[0].Component[0].MapLoc[0].$.refAllele[k]]
					}

				} else {
					ref = o.Assembly[0].Component[0].MapLoc[0].$.refAllele;
				}

				temp.ref = ref;


				for (var j = 0;j < o.Assembly[0].Component[0].MapLoc[0].FxnSet.length; j++){
					if (o.Assembly[0].Component[0].MapLoc[0].FxnSet[j].$.allele){
						if(strand.search(/rev/i) == 0){
							for (var k = 0; k <o.Assembly[0].Component[0].MapLoc[0].FxnSet[j].$.allele.length; k ++){
								tempString += opposite[o.Assembly[0].Component[0].MapLoc[0].FxnSet[j].$.allele[k]];
							}
						} else {
							tempString = o.Assembly[0].Component[0].MapLoc[0].FxnSet[j].$.allele;
						}
						if (alts.indexOf(tempString) === -1 ) alts.push(tempString)
					}
				}

				temp.alt = alts;
				out.push(temp);				
			}
			console.log(out);
		});
	});
}

http.request(options,cb).end();