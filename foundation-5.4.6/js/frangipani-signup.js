(function(){
	var submit = function(){
		$('#submit-signup').on('click',function(){
			var data = {
				'username':$('#username').val(),
				'password':$("#password").val()
			}
			var promise = Promise.resolve($.ajax({
				url:'/signup',
				type:'POST',
				contentType:'application/json',
				data:JSON.stringify(data),
				dataType:"json"
			}))

			promise.then(function(result){
				if (result.redirectURL){
					window.location.replace(result.redirectURL);
				} else {
					console.log(result);
				}
			})
		})

		$('#submit-login').on('click',function(){
			var data = {
				'username':$('#username').val(),
				'password':$("#password").val()
			}
			var promise = Promise.resolve($.ajax({
				url:'/login',
				type:'POST',
				contentType:'application/json',
				data:JSON.stringify(data),
				dataType:"json"
			}))

			promise.then(function(result){
				if (result.redirectURL){
					window.location.replace(result.redirectURL);
				} else {
					console.log(result);
				}
			})
		})
	}
	$(document).ready(submit)	
})()