(function(){

	var addNewProjectHandlers = function(){

	}

	var projectPageHandlers = function(){
		$('#add-new-project').on('click',function(e){
			e.preventDefault();
			asyncRenderHbs('frangipani-add-new-project.hbs')
			.then(function(renderedHtml){
				$('#page-content').html(renderedHtml);
				addNewProjectHandlers();
			});
		})

	}

	
	var loadhtml = function(){
		var promise = Promise.resolve($.ajax({
			url:'/database/projects',
			type:'GET',
			contentType:'application/json'
		}))

		promise.then(function(result){
			console.log(result);
			var options = {projects:result};
			return asyncRenderHbs('frangipani-projects.hbs',options)
		}).then(function(renderedHtml){
			$('#page-content').html(renderedHtml);
			projectPageHandlers();
		})
	}

	var main = function(){
		loadhtml();
	};

	$(document).ready(main);
})()