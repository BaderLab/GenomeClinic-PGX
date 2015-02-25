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


(function(){

	
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
			})
	}


	var checkAuth = function(){
		var opts;
		Promise.resolve($.ajax({
			url:'/auth/check',
			type:'GET',
			contentType:'application/json'	
		})).then(function(result){
			var options = []
			var location = window.location.pathname
			if (location == '/signup'){
				options.push(['login',1]);
				options.push(['recover',2]);
			} else if (location =='/recover') {
				options.push(['login',1]);
				options.push(['signup',2]);
			} else if (location == '/login'){
				options.push(['signup',1]);
				options.push(['recover',2]);
			}
			if (result.oauth)
				options.push(['oauth',3]);
			return $.each(options,function(index,item){
				var opt = {}
				opt[item[0]] = result[item[0]];
				return asyncRenderHbs('frangipani-generic-templates.hbs',opt).then(function(renderedHtml){
					if (renderedHtml)
						$("#extra-field-" + item[1]).html(renderedHtml);
				})
			});
		})
	}

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
		})
		
		//listen on form for valid abide ajax request
		$("#frangipani-request-login").on('valid.fndtn.abide', function () {
			var data = {
				'username':$('#username').val()
			};
			
			if (window.location.pathname == '/setpassword'){
				data['newpassword'] = $('#newpassword').val();
			}

			if (window.location.pathname != '/recover'){
				data['password'] = $("#password").val()

			}

			
			//send ajax request with form data and listen for response
			var promise = Promise.resolve($.ajax({
				url: window.location.pathname,
				type:'POST',
				contentType:'application/json',
				data:JSON.stringify(data),
				dataType:"json"
			}))

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
			})
			
		})
	}

	//add handlers
	var main = function(){
		checkAuth();
		abideVal();
		submit()
	}
	$(document).ready(main)	
})()