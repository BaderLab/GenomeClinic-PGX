var http = require('http');
var parseString = require('xml2js').parseString;
var fs = require('fs');
var Promise = require('bluebird');


function getRsIds(ids){

	var opposite = {
		"A":"T",
		"T":"A",
		"C":"G",
		"G":"C",
		"-":"-"
	}
	var iupac = {
		G:'G',
		A:"A",
		T:"T",
		C:"C",
		R:"A/G",
		Y:"C/T",
		M:"A/C",
		K:"G/T",
		S:"C/G",
		W:"A/T",
		H:"A/C/T",
		B:"C/G/T",
		V:"A/C/G",
		D:"A/G/T",
		N:"A/C/G/T"
	}
	

	var promise = new Promise(function(resolve,reject){
		var output = {};
		if (ids.length === 0) {
			reject('function requires an array of rsId\'s')
			return
		}

		if (Object.prototype.toString.call(ids) == '[object Array]'){
			ids = ids.join(',');
		}

		ids = ids.replace(/[A-Za-z]+/ig,"").split(',');
		var options =  {
			host:'eutils.ncbi.nlm.nih.gov',
			path:'/entrez/eutils/efetch.fcgi?db=snp&id=' + ids.join(',') + '&retmode=xml'
		}	
		var cb = function(response){
			var xml = '';

			response.on('data',function(chunk){
				xml += chunk;
			});

			response.on('end',function(){
				parseString(xml,function(err,result){
					var o,strand,point,alleles,allele,maxLength,i,j,m,ind,ind2,temp;
					var seen = [],out=[];
					var rs = result.ExchangeSet.Rs;

					// No entries were returned
					if (!rs){
						output.ids = ids;
						output.dbSnp = [];
						output.missing = ids;
					} else {
					//console.log(rs[31])//.Assembly[0].Component[0].MapLoc)//.FxnSet[j].$.allele)
						for ( i = 0; i < rs.length; i ++ ){
						//	console.log(i);
							temp = {};
							o = rs[i];
							temp._id = 'rs' + o.$.rsId;
							seen.push(o.$.rsId);
							temp.variants = o.Sequence[0].Observed[0].split('/');
							temp.build = o.Assembly[0].$.dbSnpBuild;
							temp.assembly = o.Assembly[0].$.genomeBuild;
							temp.assemblyLabel = o.Assembly[0].$.groupLabel;



		
							point =  o.Assembly[0].Component
							maxLength = 0;
							for ( m = 0; m < point.length; m++ ){
								if (Object.keys(point[m].$).length > maxLength){
									maxLength = Object.keys(point[m].$).length;
									temp.ref = point[m].MapLoc[0].$.refAllele;
									temp.orient = point[m].MapLoc[0].$.orient;
									temp.chr = point[m].$.chromosome;
									temp.pos = parseInt(point[m].MapLoc[0].$.physMapInt) + 1;
									alleles =  [];
									if (temp.orient == 'reverse'){
										for ( ind = 0; ind < temp.variants.length; ind++ ){
											allele="";
											for (ind2 = 0; ind2 < temp.variants[ind].length; ind2++){
												allele+=opposite[temp.variants[ind][ind2]];
											}

											alleles.push(allele)
										}
									} else {
										alleles = temp.variants.slice(0);
									}
									alleles.splice(alleles.indexOf(temp.ref),1)
									temp.alt = alleles;
								}
							}
							out.push(temp);
						}

						if (out.length !== ids.length ){
							var missing = [];
							for (i =0; i < ids.length; i++){
								if (seen.indexOf(ids[i].toString()) == -1) missing.push(ids[i]);
							}
							output.ids = ids;
							output.dbSnp = out;
							output.missing = missing;

						} else {
							output.ids = ids;
							output.dbSnp = out;
							output.missing = [];
						}
					}

					resolve(output);
					return;
				});
			});
		}

		http.request(options,cb).end();
	});
	return promise;
}


module.exports = getRsIds;