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
var $ = require('jquery');

module.exports = {

//=======================================================================
// Add an event to a button
//=======================================================================
/* When a button is clicked, calls a function. While the function is 
 * executing, button displays some intermediate text. Upon completion, button
 * reverts to original text.
 * requires the function to be in the form of a promise function
 * for proper deferred activation */
	clickAction: function(button, promiseFunction, options, useThis) {
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
	},
	existsInDb : function (collection,field,value){
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
	},

	refresh : function(){
		$(document).foundation();
	},
	getUserInfo : function() {
		return Promise.resolve($.ajax({
			url:'/auth/user',
			type:'GET',
			contentType:'application/json'
		})).then(function(result){
			return result;
		});
	},

	assert: function(condition, message) {
	    if (!condition) {
	        message = message || "Assertion failed";
	        if (typeof Error !== "undefined") {
	            throw new Error(message);
	        }
	        throw message; // Fallback
	    }
	},

	bioAbide:function(){
		$(document).foundation({
			abide:{
				patterns:{
					alleles:/^[,\sacgtnACGTN-]+$/,
					chromosomes:/^(1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|X|Y|M|m|y|x)$/,
					ref:/^[acgtnACGTN-]+$/
				}
			}
		});
	},
	chrRegex:/^(1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|X|Y|M|m|y|x)$/,
	allelesRegex:/^[,\sacgtn-ACGTN]+$/,
};


