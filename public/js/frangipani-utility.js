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



/* 
 * Auxiliary helper functions:
 */

//=======================================================================
// RenderHBS DEBPRECATED USE asyncRenderHbs
//======================================================================= 
/* Function to retrieve and render a handlebars template. This function is
 * modified from the function provided by user koorchik on StackOverFlow:
 * http://stackoverflow.com/questions/8366733/external-template-in-underscore
 * as explained on the following blog entry:
 * http://javascriptissexy.com/handlebars-js-tutorial-learn-everything-about-handlebars-js-javascript-templating/
 *
 * NOTE: In the future, I would compile all my templates into a single
 * templates.js file and load that in the beginning rather than have many
 * small synchronous AJAX calls to get templates when the webpage loads.
 */

function renderHbs(template_name, template_data) {
	if (!renderHbs.template_cache) { 
	    renderHbs.template_cache= {};
	}

	if (!renderHbs.template_cache[template_name]) {
		var template_url= '/templates/' + template_name;
		$.ajax({
			url: template_url,
			method: 'GET',
			async: false,  // I'm keeping this async for now (from original code) - but I really don't like it
			success: function(data) {
				renderHbs.template_cache[template_name]= Handlebars.compile(data);
			},
			error: function(err,message) {
				console.log(message);
			}
			
		});
	}

	return renderHbs.template_cache[template_name](template_data);
};

//=======================================================================
// Async Rendering of handlebars templates
//=======================================================================
/* Same as above, but returns a promise. */
function asyncRenderHbs(template_name, template_data) {
	if (!asyncRenderHbs.template_cache) { 
	    asyncRenderHbs.template_cache= {};
	}

	var promise= undefined;

	if (!asyncRenderHbs.template_cache[template_name]) {
		promise= new Promise(function(resolve, reject) {
			var template_url= '/templates/' + template_name;
			$.ajax({
				url: template_url,
				method: 'GET',
				success: function(data) {
					asyncRenderHbs.template_cache[template_name]= Handlebars.compile(data);
					resolve(asyncRenderHbs.template_cache[template_name](template_data));
				},
				error: function(err, message) {
					reject(err);
				}			
			});
		});
	} else {
		promise= Promise.resolve(asyncRenderHbs.template_cache[template_name](template_data));
	}

	return promise;
};



//=======================================================================
// Add an event to a button
//=======================================================================
/* When a button is clicked, calls a function. While the function is 
 * executing, button displays some intermediate text. Upon completion, button
 * reverts to original text.
 * requires the function to be in the form of a promise function
 * for proper deferred activation */
function clickAction(button, promiseFunction, options, useThis) {
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
};


function existsInDB(collection,field,value){
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
};
//=======================================================================
// Nav Bar
//=======================================================================
/* Whenever the page is loaded add the nav bar from the template. The nav
 * Bar will change depending on whether the user loggin in is authenticated
 * or not. If they are authenticated, then the user will see the full nav bar
 * otherwise they will not get any additional options */

function addNavBar() {
	var promise;
	var options;
	promise = Promise.resolve($.ajax({
		url:'/authenticated',
		type:'GET',
		contentType:'application/json'
	}))

	return promise.then(function(result){
		options={authenticated:result}
		return getUserInfo()
	}).then(function(user){
		options['user'] = user.user;
		return asyncRenderHbs('navbar.hbs',options).then(function(html){
			$(document).find('nav').html(html);
			$(document).foundation();
		});
	});
};



function getUserInfo() {
	return Promise.resolve($.ajax({
		url:'/auth/user',
		type:'GET',
		contentType:'application/json'
	})).then(function(result){
		return result;
	});
};

$(document).ready(addNavBar)


