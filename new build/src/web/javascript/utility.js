/* Frangipani-utility.js
 *
 * Module containing utility functions that will be included in
 * every page that is loaded. These functions are globally 
 * accessible and are loaded prior to any additional app specific 
 * javascript being loaded

 * Written by: 
 * Patrick Magee & Ron Ammar
 */



// Deprecated.. to be changed in later versions of the app
var buttonClicked = false;
var $ = require('Jquery');

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
			buttonClicked = false
		};

		button.on("click", function(event) {
			event.preventDefault();
			if (!buttonClicked){
				buttonClicked=true
				if (useThis === true) {
					button= $(this);
					options["thisButton"]= $(this);
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
			}))
			promise.then(function(result){
				resolve(result);
			});
		});
		return promise;
	},
	//=======================================================================
	// Nav Bar
	//=======================================================================
	/* Whenever the page is loaded add the nav bar from the template. The nav
	 * Bar will change depending on whether the user loggin in is authenticated
	 * or not. If they are authenticated, then the user will see the full nav bar
	 * otherwise they will not get any additional options */
	 // this is now added during sending the layout.hbs
	/*addNavBar : function(){
		var self = this;
		var promise;
		var options;
		promise = Promise.resolve($.ajax({
			url:'/authenticated',
			type:'GET',
			contentType:'application/json'
		}))

		return promise.then(function(result){
			options={authenticated:result}
			return self.getUserInfo()
		}).then(function(user){
			options['user'] = user.user;
			$(document).find('nav').html(template.navbar(options));
			});
		});
	},*/
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
};


