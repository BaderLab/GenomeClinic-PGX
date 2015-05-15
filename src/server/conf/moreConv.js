

var testObj = {
	recomendation:{
		Ambian:{
			'High Risk':{
				rec:'howdy',
				pubmed:'test',
				secondary:{
					'ABCB1':{
						"HIGH:RISK":{
							rec:'howdy',
							pubmed:'test'
						}
					}
				}
			}
		}
	}
};
var objString = "recomendation.Ambian.High Risk.secondary.ABCB1.HIGH:RISK";

var doc = {
	rec :"TEST",
	risk : "TESSST",
	pubmed : "TEST3333"
}

function createNestedObject(objString, refObj, doc){
	var split = objString.split('.');
	var cont = true;
	var newDoc = {};
	var point = newDoc
	var depthString = [];
	for (var i = 0; i < split.length; i++ ){
		if (refObj.hasOwnProperty(split[i]) && cont){
			refObj = refObj[split[i]];
			depthString.push(split[i]);
		} else {
			cont = false;
			point[split[i]] = {};
			point = point[split[i]];
		}
	}
	if (refObj.hasOwnProperty('secondary'));
	point.rec = doc.rec;
	point.risk = doc.risk;
	point.pubmed = doc.pubmed;
	point.secondary = refObj.secondary;
	return {cont:newDoc,depth:depthString.join('.')}
}


var x = createNestedObject(objString,testObj,doc);

console.log(x)