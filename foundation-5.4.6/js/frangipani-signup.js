(function(){

	var abideVal = function(){
		$(document)
			.foundation({
				'abide':{
					patterns:{
						lower:/^.{6,40}/,
					}
				}
			})
	}

	var submit = function(){

		$('.close-box').on('click',function(e){
			e.preventDefault();
			$(this).closest('div').hide();
		});
		$("#frangipani-request-login").on('invalid.fndtn.abide', function () {
		// Invalid form input
			var invalid_fields = $(this).find('[data-invalid]');
			console.log(invalid_fields);
		})
		
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

			
			
			var promise = Promise.resolve($.ajax({
				url: window.location.pathname,
				type:'POST',
				contentType:'application/json',
				data:JSON.stringify(data),
				dataType:"json"
			}))

			promise.then(function(result){
				console.log(result);
				if (result.redirectURL){
					window.location.replace(result.redirectURL);
				} else {
					$('#password').val('');
					$('#retypePassword').val('');
					$('#error-display-message').text(result.error[0]).parents().find('#error-display-box').show();
				}	
			})
			
		})
	}


	var main = function(){
		submit()
		abideVal();
	}
	$(document).ready(main)	
})()