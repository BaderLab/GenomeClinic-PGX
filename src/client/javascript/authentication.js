/* Jquery module for handling all of the login in type pages and
 * and events, such as:
 * 
 * 1. login
 * 2. Signup
 * 3. Recover Pass
 * 4. Change Pass
 *
 * Contains generic functions which allow for compatability between different
 * html page
 * @author Patrick Magee
 */
var utility = require('./utility'),
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
		return Promise.resolve($.ajax({
			url:'/auth/check',
			type:'GET',
			contentType:'application/json'	
		})).then(function(result){
			var opts = {};
			if (location == '/signup'){
				if (result.signup){
					opts.login = result.login;
					opts.recover = result.recover;
					t = templates.signup;
				} else {	
					t = templates.notfound;
				}
			} else if (location =='/recover') {
				if (result.recover){
					opts.login = result.login;
					opts.signup = result.signup;
					t = templates.recover;
				} else {
					t = templates.notfound;
				}
			} else if (location == '/login'){
				opts.signup = result.signup;
				opts.recover = result.recover;
				t = templates.login;
			} else if (location == '/setpassword'){
				t = templates.setpassword;
			}
			if (result.oauth)
				opts.oauth = true;
			t(opts).then(function(renderedHtml){
				$('#main').html(renderedHtml);
			}).then(function(){
				utility.refresh();
			}).then(function(){
				abideVal();
			}).then(function(){
				submitHandler();
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

	var submitHandler = function(){

		//close alert box
		$('.close-box').on('click',function(e){
			e.preventDefault();
			$(this).closest('.alert-box').hide();
		});
		$("#webapp-request-login").on('invalid.fndtn.abide', function () {
		// Invalid form input
			var invalid_fields = $(this).find('[data-invalid]');
			console.log(invalid_fields);
		});
		//listen on form for valid abide ajax request
		$("#webapp-request-login").on('valid.fndtn.abide', function () {
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
				if (result.alert){
					// display status redirect message
					if (result.statusCode == '200'){
						var message = result.message;
						$('#error-display-box').removeClass('alert').addClass('success')
						.find("#error-display-message").text(message + ". You will be redirected in 5 seconds")
						.parents().find("#error-display-box").show();

						var counter = 0;
						var interval = setInterval(function() {
						    counter++;
						    $('#error-display-message').text(message + ". You will be redirected in "  + (5 - counter).toString() + " seconds");
						    if (counter == 5) {
						        clearInterval(interval);
						        window.location.replace('/');
						    }
						}, 1000);
					}
				//successful request, redirect to redirectURL
				} else if (result.statusCode == "200"){
					window.location.replace(result.redirectURL);
				//unsuccessful request, open errror box
				} else {
					$('#password').val('');
					$('#newpassword').val('');
					$('#confirmPassword').val('');
					$('#error-display-message').text(result.error[0]).parents().find('#error-display-box').show();
				}	
			});
			
		});
	};
	return checkAuthAndRender();
};