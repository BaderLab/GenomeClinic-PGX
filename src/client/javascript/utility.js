/* Frangipani-utility.js
 *
 * Module containing utility functions that will be included in
 * every page that is loaded. These functions are globally 
 * accessible and are loaded prior to any additional app specific 
 * javascript being loaded

 * @author Patrick Magee
 * @author Ron Ammar
 */



// Deprecated.. to be changed in later versions of the app
var buttonClicked = false;

function UtilityFunctions(){

}

//=======================================================================
// Add an event to a button
//=======================================================================
/* When a button is clicked, calls a function. While the function is 
 * executing, button displays some intermediate text. Upon completion, button
 * reverts to original text.
 * requires the function to be in the form of a promise function
 * for proper deferred activation */
UtilityFunctions.clickAction = function(button, promiseFunction, options, useThis) {
	var originalText;

	var resetButton= function(val) {
		button.html(originalText);
		buttonClicked = false;
	};
	button.on("click", function(event) {
		event.preventDefault();
		if (!buttonClicked){
			buttonClicked=true;
			if (useThis === true) {
				button= $(this);
				options.thisButton= $(this);
			}

			originalText= button.html();
			button.text("Fetching...");

			if (options === undefined) {
				promiseFunction().then(resetButton).then();
			} else {
				promiseFunction(options).then(resetButton);
			}
		}
	});
}

/* Check to see whetehr or not a value currently exists in the spcified collection and field.
 * Return the result from the server */
UtilityFunctions.existsInDb = function (collection,field,value){
	var promise = new Promise(function(resolve,reject){
		var options = {
				collection:collection,
				field:field,
				value:value
			};
		var promise = Promise.resolve($.ajax({
			url:'/database/checkInDatabase',
			contentType:'application/json',
			type:'POST',
			dataType:'json',
			data:JSON.stringify(options)
		}));
		promise.then(function(result){
			resolve(result);
		});
	});
	return promise;
};

/* Refresh foundaiton. If opt is provided add the options and refresh with the options
 * ie. adding abide options during a refresh. Additionally if an el is added fresh
 * foundation within the context of el */
UtilityFunctions.refresh = function(opt, el){
	var context = el === undefined ? $(document):$(el);
	if (opt) return context.foundation(opt);
	context.foundation();
};

//Get information about the current user
UtilityFunctions.getUserInfo = function() {
	return Promise.resolve($.ajax({
		url:'/auth/user',
		type:'GET',
		contentType:'application/json'
	})).then(function(result){
		return result;
	});
};

//Create an assertion 
UtilityFunctions.assert = function(condition, message) {
    if (!condition) {
        message = message || "Assertion failed";
        if (typeof Error !== "undefined") {
            throw new Error(message);
        }
        throw message; // Fallback
    }
};

//Abide options for biological fields ie DNA
UtilityFunctions.bioAbide=function(){
	$(document).foundation({
		abide:{
			patterns:{
				alleles:/^[,\sacgtnACGTN\-]+$/,
				chromosomes:/^(1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|X|Y|M|m|y|x)$/,
				ref:/^[acgtnACGTN\-]+$/,
				sex:/^(m|f|male|female)$/i
			}
		}
	});
};



/* Check to see if the input matches the current search box value */
UtilityFunctions.matchSearch = function(input){
	var val = $('#search-box').val();
	var re = new RegExp(val,'i');
	if (val == '') return true;
	if (Object.prototype.toString.call(input) == '[object String]'){
		if (input.match(re) !== null) return true;
		return false;
	} else if (Object.prototype.toString.call(input) == '[object Array]'){
		for (var i = 0 ; i < input.length; i++ ){
			if (input[i].match(re) !== null) return true;
		}
		return false;
	}
};

/* Using the E-utils tool from ncbi, generate a citation from a pubmed id
 * this function accepts either a single id or an array of id's. it then submits
 * the IDS to e-utils for processing. When the ID's return it generates a citation
 * from the json data. It returns an object of citations */
UtilityFunctions.pubMedParser = function(ids){
	//Submit an ajax request
	var httpReq = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id="
	if (Object.prototype.toString.call(ids) == '[object Array]') ids = ids.join(',');
	httpReq += ids;
	httpReq += '&retmode=json';
	if (!ids) return Promise.resolve({});
	return Promise.resolve($.ajax({
		url:httpReq,
		type:"GET",
		dataType:'json',
		cache:false,
		timeout:20000
	})).then(function(result){
		var citations = {}; //citations per id;
		var citation,authorString;
		var esum = result.result;
		delete esum.uids;
		for ( var id in esum ){
			authorString = "";
			citation = "";
			if (esum.hasOwnProperty(id)){
				if (esum[id].authors.length > 5 ){
					authorString = esum[id].sortfirstauthor += ' <i>et. al</i>'
				} else {
					var authors = [];
					for (var j = 0; j < esum[id].authors.length; j++) {
						if (Object.prototype.toString.call(esum[id].authors[j]) == '[object Object]'){
							authors.push(esum[id].authors[j].name)
						} else {
							auhtors.push(esum[id].authors[j]);
						}
					}
					authorString = authors.join(', ');
				}
			
				citation = authorString + '. ' 
				if( esum[id].vernaculartitle !== "" ) citation += esum[id].vernaculartitle
				else citation += esum[id].title
				citation += ' <i>' + esum[id].source +'</i> ' + esum[id].pubdate + ';' + esum[id].volume;
				if (esum[id].issue !== '') citation+= '(' + esum[id].issue + ')';
				citation += ':' + esum[id].pages

				citations[id] = citation;
			}
		}
		return citations;
	}).catch(function(err){
		return undefined;
	});
};

/* Retrieve citations based on the passed Ids. ids can either be a single string or an array
 * First look to see if there is a saved copy of the citation on the server. if there is not
 * check to see if one exists in pubmed. Return the citation or undefined */
UtilityFunctions.retrieveCitations = function(ids){
	var _this = this;
	var promise = new Promise(function(resolve,reject){
		var query = "id=";
		if (!ids) resolve(undefined);
		if (Object.prototype.toString.call(ids) == "[object String]")
			query+= ids;
		else
			query += ids.join("&id=");
		return Promise.resolve($.ajax({
			url:"/database/citations?" + query,
			type:"GET",
			dataType:'json'
		})).then(function(citations){
			if (citations.missing.length == 0){
				resolve(citations.citations);
				return
			} else {
				return _this.pubMedParser(citations.missing).then(function(pubMedCitations){
					if (pubMedCitations)
						//if new citation was found, add it to the databse.
						_this.addNewCitations(pubMedCitations);
					resolve(pubMedCitations);
					return 
				})
			}
		});
	}).catch(function(err){
		resolve(undefined);
	});
	return promise;
}; //end retrieveCitations

/* Attempt to add a new citation to the database to enable faster retrieval times */
UtilityFunctions.addNewCitations = function(citationObj){
	var _this = this;
	var promise = new Promise(function(resolve,reject){
		if (!citationObj) return undefined;
		if (Object.prototype.toString.call(citationObj) !== "[object Object]") return undefined;
		//Prepare the citation obj array:
		var citationsToAdd = [];
		var temp;
		var keys = Object.keys(citationObj);
		if (keys.length === 0) return undefined;
		for (var i = 0; i < keys.length; i++ ){
			if (citationObj.hasOwnProperty(keys[i])){
				temp = {};
				temp._id = keys[i];
				temp.citation = citationObj[keys[i]];
				citationsToAdd.push(temp);
			}
		}//
		console.log(citationsToAdd)
		return Promise.resolve($.ajax({
			url:'/database/citations',
			type:"POST",
			dataType:'JSON',
			contentType:"application/json",
			data:JSON.stringify(citationsToAdd)
		})).then(function(result){
			if (result){
				return true;
			}
			return undefined;
		});
	});
}; //end addNewCitations

	/* Dev tool for downloading JSON data to file */
UtilityFunctions.saveDataAsJson =  function(data, filename){
    if(!data) {
        console.error('No data to save')
        return;
    }

    if(!filename) filename = 'data.json';
    if(filename.search(/.json$/) == -1 ) filename += '.json'

    if(typeof data === "object"){
        data = JSON.stringify(data, undefined, 4)
    }

    var blob = new Blob([data], {type: 'text/json'}),
        e    = document.createEvent('MouseEvents'),
        a    = document.createElement('a')

    a.download = filename
    a.href = window.URL.createObjectURL(blob)
    a.dataset.downloadurl =  ['text/json', a.download, a.href].join(':')
    e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
    a.dispatchEvent(e)
};
/* Checks the width of the element or elements defined 
* and if it is larger then a specific size, adds a scrollbar
 */	
UtilityFunctions.checkWidth = function(inner,outer,cb){
	promise = Promise.resolve().then(function(){
		var ele1 = $(inner);
		var ele2 = $(outer);
		if (ele1[0].offsetWidth < ele2[0].scrollWidth){
			ele2.addClass('scrollit2');
		} else {
			ele2.removeClass('scrollit2');
		}
		return
	}).then(function(){
		if(cb)
			return cb()
	})
};


/* Retrieve the suggestions passed of of the passed term from the desired 
 * collection and return only the top num of suggestions */
UtilityFunctions.getSuggestions = function(term,collection,num,gene){

	var gene = gene !== undefined ? '&gene=' + gene : ""
	// One of Marker, drug, gene, haplotype, user
	return Promise.resolve($.ajax({
		url:'/database/suggestions?term=' + term +'&num=' + num + '&col=' + collection + gene,
		type:"GET",
		dataType:'json',
		contentType:'application/json'
	})).then(function(result){
		return result;
	}).catch(function(err){
		console.log(err);
	})
};


/* Add all handlers to  suggestion box */
UtilityFunctions.suggestionHandlers = function (){
	var _this = this;

	//When a row is clciked take the row contents and add it to the attached input
	var clickRow = function(){
		$('.suggestion').on('click.suggestion',function(){
			var input = $($(this).closest('.suggestions').attr('for'));
			var multi = input.data('multi')
			if (multi) {
				var current = input.val().split(',').slice(0,-1).join(',')
				var spacer = ""
				if (current !== "")
					spacer = ',';
				input.val(current + spacer + $(this).text());
			} else input.val($(this).text());
			input.trigger('change');
			$('.suggestion-list').html('').closest('.suggestions').slideUp();
		});
	}

	$(document).on('mouseup.suggestion',function(e){
		var targ1 = $('.suggestion-input');
		var targ2 = $('.suggestion-list,.suggestion');
		var target = e.target;
		if (!targ1.is(target) && !targ2.is(target)){
			$('.suggestion-list').html('').closest('.suggestions').slideUp();
		}

	});

	/* Watch a specified input field, when a keyup event is detected
	 * retrieve the suggestions for the content of the input field
	 * what data is returned is controlled by the data attributes: 
	 * col - the type of data
	 * num - number of items to return
	 * gene - if a gene name pass this argument
	 * multi - contains multiple entries, will look at the last entry in the string
	 */
	$('.suggestion-input').on('keyup.suggestion',function(e){
		var context = $(this);
		$(this).removeClass('glowing-error').attr('placeholder','');
		var col = $(this).data('col');
		var num = $(this).data('num');
		var gene = $(this).data('gene');
		var multi = $(this).data('multi');
		if (multi) v = $(this).val().split(',').splice(-1)[0];
		else v = $(this).val();
		if (v.length  > 0 ){
			//get the suggestion from the server

			_this.getSuggestions(v,col,num,gene).then(function(result){
				var html = "";
				if (result.length > 0){
					for (var i = 0; i < result.length; i++ ){
						var val = v.replace(/\*/g,'\\*').replace(/\+/g,"\\+");
						var reg = new RegExp(val,'i')
						var searchIndex = result[i].search(reg);
						html += '<li class="suggestion">'
						for (var j = 0; j < result[i].length; j++ ){
							if (j == searchIndex) html += '<b class=suggetion-match>'
							html += result[i][j];
							if (j - searchIndex == val.length -1) html += '</b>'
						}
						html += '</li>'
					}
				} else {
					html += '<li><i>No Suggestions</i></li>'
				}
				return context.siblings('.suggestion-wrapper').find('.suggestion-list').html(html).closest('.suggestions').slideDown();
			}).then(function(){
				clickRow();
			});
		} else {
			$('.suggestion-list').html('').closest('.suggestions').slideUp();	
		}
	});
	
};

/**
 * Given an attributre, attempt to find the value of the attribute
 * in the url. this does not support object notation
 */
UtilityFunctions.getURLAtrribute = function(attr){
	var queryString = window.location.search.replace("?","");
	if (queryString == "") return undefined;

	var pairs = queryString.split("&");
	var vals = {};
	var temp;
	for (var i = 0; i < pairs.length; i++ ){
		temp = pairs[i].split("=");
		if (vals[temp[0]])
			if (Object.prototype.toString.call(vals[temp[0]]) == "[object Array]")
				vals[temp[0]].push(temp[1]);
			else
				vals[temp[0]] = [vals[temp[0]], temp[1]];
		else
			vals[temp[0]] = temp[1];
	}
	return vals[attr]
}

//literal variables
UtilityFunctions.chrRegex = /^(1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|X|Y|M|m|y|x)$/
UtilityFunctions.allelesRegex = /^[,\sacgtn\-ACGTN]+$/
module.exports = UtilityFunctions;