/* Jquery module for handling all of the login in type pages and
 * and events, such as:
 * 
 * 1. login
 * 2. Signup
 * 3. Recover Pass
 * 4. Change Pass
 *
 * Contains generic functions which allow for compatability between different
 * html pages

 * written by:
 * Patrick Magee
 */
var $ = require('jquery'),
	templates = require('./templates'),
	constants = require('../../server/conf/constants.json').dbConstants.USERS;

module.exports = function(location){

	
	//=======================================================================
  	// Abide Validation
  	//=======================================================================
  	/*
  	* Additional abide validation functions and patterns. for checking to see
  	* if the appropriate input was given. 
  	*/
	var abideVal = function(){
		$(document)
			.foundation({
				'abide':{
					patterns:{
						lower:/^.{6,40}/,
					},
					validators:{
						notEqual: function(el,required,parent){
							var from = document.getElementById(el.getAttribute(this.add_namespace('data-notEqual'))).value,
							to = el.value,
							valid = (from != to);

							return valid;
						}
					}
				}
			});
	};
	var checkAuthAndRender = function(){
		var opts;
		var template;
		Promise.resolve($.ajax({
			url:'/auth/check',
			type:'GET',
			contentType:'application/json'	
		})).then(function(result){
			opts = {};
			if (location == '/signup'){
				opts.login = true;
				opts.recover = true;
				t = template.signup;
			} else if (location =='/recover') {
				opts.login = true;
				opts.signup = true;
				t = template.recover;
			} else if (location == '/login'){
				opts.signup = true;
				opts.recover = true;
				t = template.login;
			} else if (location == '/setpassword'){
				t = template.setpassword;
			}
			if (result.oauth)
				opts.oauth = true;
			t(opts).then(function(renderedHtml){
				$('#main').html(renderedHtml);
			});
		});
	};
	//=======================================================================
  	// Submit the form, and add handlers
  	//=======================================================================
  	/*
  	* When the form is submitted it is not sent directly to the server, instead 
  	* An ajax request is sent to the fndtn.abide parameter of being either valid
  	* or invalid. Depening on the request this will then send a POST request to
  	* the server using the current pathname as the routes. If an error is returned
  	* An alert box is opened with the error message. If a success is returned,
  	* the client is redirected to the redirectURL
  	*/

	var submit = function(){

		//close alert box
		$('.close-box').on('click',function(e){
			e.preventDefault();
			$(this).closest('.alert-box').hide();
		});
		$("#frangipani-request-login").on('invalid.fndtn.abide', function () {
		// Invalid form input
			var invalid_fields = $(this).find('[data-invalid]');
			console.log(invalid_fields);
		});
		//listen on form for valid abide ajax request
		$("#frangipani-request-login").on('valid.fndtn.abide', function () {
			var data = {};
			data[constants.ID_FIELD] = $('#username').val();			
			if (location == '/setpassword'){
				data.newpassword = $('#newpassword').val();
			}

			if (location != '/recover'){
				data[constants.PASSWORD_FIELD] = $("#password").val();
			}			
			//send ajax request with form data and listen for response
			var promise = Promise.resolve($.ajax({
				url: location,
				type:'POST',
				contentType:'application/json',
				data:JSON.stringify(data),
				dataType:"json"
			}));

			promise.then(function(result){
				
				//successful request, redirect to redirectURL
				if (result.redirectURL){
					window.location.replace(result.redirectURL);
				//unsuccessful request, open errror box
				} else {
					$('#password').val('');
					$('#newPassword').val('');
					$('#confirmPassword').val('');
					$('#error-display-message').text(result.error[0]).parents().find('#error-display-box').show();
				}	
			});
			
		});
	};
	//add handlers
	var main = function(){
		checkAuthAndRender().then(function(){
			abideVal();
			submit();
		});
	};


	main();
};