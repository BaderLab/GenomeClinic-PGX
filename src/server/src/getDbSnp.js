/* Query dbSNP database based on the speicified rsID's and
 * retrieve information for each rsID. Submitts an http request
 * to the NCBI eutils url.
 * @author Patrick Magee */
var http = require('http');
var https = require('https');
var parseString = require('xml2js').parseString;
var fs = require('fs');
var Promise = require('bluebird');


/* submit an http request to the NCBI's e-utils server and retrieve information
 * for a set of rsID's in xml format. The Data is parsed and then put into an object
 * that is ready to be inserted into the database.
 * The returned object contains thre constant returned fields:
 * ids : an array containing all the initial ids
 * dbSnp : an array of objects with all of the returned objects from dbSnp
 * missing : Array of missing ids from the returned dbSNp object
 */
function getRsIds(ids){


	// object for opposites
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


	//Perform the call in a promise so the function knows when to return the appropriate data
	var promise = new Promise(function(resolve,reject){
		var output = {};

		//No ids were provide
		if (ids.length === 0) {
			reject('function requires an array of rsId\'s')
			return
		}

		//if an array was provided; join them
		if (Object.prototype.toString.call(ids) == '[object Array]'){
			ids = ids.join(',');
		}

		//replace all non nummeric characters
		ids = ids.replace(/[A-Za-z]+/ig,"").split(',');

		//options to be passed to the httprequest
		var options =  {
			host:'eutils.ncbi.nlm.nih.gov',
			path:'/entrez/eutils/efetch.fcgi?db=snp&id=' + ids.join(',') + '&retmode=xml'
		}

		// call back function to be executed when the httprequest receices data
		var cb = function(response){
			var xml = '';


			//when data comes in add each chunk to the xml object
			response.on('data',function(chunk){
				xml += chunk;
			});

			response.setTimeout(50000);
			//Error Occured, Reject the infromation.
			response.on('error',function(err){
				reject(err);
			});

			// execute on the end
			response.on('end',function(){

				//Parse the xml into a js objct
				parseString(xml,function(err,result){
					var o,strand,point,alleles,allele,maxLength,i,j,m,ind,ind2,temp;
					var seen = [],out=[],merged=[];
					var rs = result.ExchangeSet.Rs;

					// No entries were returned
					if (!rs){
						output.ids = ids;
						output.dbSnp = [];
						output.missing = ids;
					} else {
						//cycle over each rsID
						for ( i = 0; i < rs.length; i ++ ){
							temp = {};
							o = rs[i];
							temp._id = 'rs' + o.$.rsId;
							if (ids[i] !== o.$.rsId) {
								temp.merged = {
									from : 'rs'+ids[i]
								}
								merged.push(o.$.rsId)
							}
							seen.push(o.$.rsId);
							temp.variants = o.Sequence[0].Observed[0].split('/');
							// not enough information on the assemblhy of the dbSnp entry
							// cannot automatically parse this information, it must be manually entered
							if (o.Assembly){ // we are using the stable assembly information to produce the file.
								temp.build = o.Assembly[0].$.dbSnpBuild;
								temp.assembly = o.Assembly[0].$.genomeBuild;
								temp.assemblyLabel = o.Assembly[0].$.groupLabel;

								point =  o.Assembly[0].Component
								maxLength = 0;
								//retrieve the appropriate reference material from the xml object
								//there are occassionally multiple fields within the assembly, if this is the case
								//take the most completely annotataed one.
								for ( m = 0; m < point.length; m++ ){
									if (Object.keys(point[m].$).length > maxLength){
										temp.asgenes = []
										if (point[m].MapLoc[0].FxnSet){
											for (l = 0; l < point[m].MapLoc[0].FxnSet.length;l++){
												if(temp.asgenes.indexOf(point[m].MapLoc[0].FxnSet[l].$.symbol) == -1)
													temp.asgenes.push(point[m].MapLoc[0].FxnSet[l].$.symbol);
											}
										} else {
										}
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
										temp.type = 'dbsnp';
										temp.date = new Date().toDateString();
									}
								}
								out.push(temp);
							}
						}

						if (out.length !== ids.length ){
							var missing = [];
							for (i =0; i < ids.length; i++){
								if (seen.indexOf(ids[i].toString()) == -1 || merged.indexOf(ids[i].toString()) ==-1) missing.push(ids[i]);
							}
							output.ids = ids;
							output.dbSnp = out;
							output.missing = missing;
							output.merged = merged

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

		https.request(options,cb).end();
	});
	return promise;
}


module.exports = getRsIds;
