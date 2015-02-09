(function(){
	var submitSignup = function(){
		$('#submit').on('click',function(){
			var info = $('form').serialize();
			console.log(info);
			var promise = Promise.resolve($.ajax({
				url:'/signup',
				type:'POST',
				contentType:'application/json',
				data:info
			}))

			promise.then(function(result){
				console.log(result);
			})
		})
	}

	$(document).ready(submitSignup)	
})()