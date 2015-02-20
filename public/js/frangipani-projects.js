(function(){
	var patientInformation, projectInfo;
	var selected = [];


	var abideVal = function(){
		$(document)
			.foundation({
				'abide':{
					validators:{
						inArray: function(el,required,parent){
							to = el.value,
							valid = (projectInfo.indexOf(to) == -1)
							return valid;
						}
					}
				}
			})
	}

	var addNewProjectHandlers = function(){

		var matchSearch = function(input){
			var val = $('#searchBox').val()
			var re = new RegExp(val,'g','i');
			if ( val === '' )
				return true
			else if (input.match(re) != null)
				return true
			return false
		}	

		var patientLinkHandler = function(id){
			$(id).on('click',function(e){
				e.preventDefault();
				var text = $(this).text();
				var index = patientInformation.indexOf(text);
				selected.splice(selected.indexOf(text),1);

				if (matchSearch(text))
					$('#row-' + index).show();

				$(this).remove();
				refreshNum();
			})
		}

		var refreshNum = function(){
			var rows = $('.patient-row:visible');
			$('#number-of-patients').text(rows.length);
		}

		$('#searchBox').on('keyup',function(){
			for (var i=0; i < patientInformation.length; i++){
				if (matchSearch(patientInformation[i]) && selected.indexOf(patientInformation[i]) == -1 )
					$('#row-' + i).show();
				else 
					$('#row-' + i).hide();
			}

			refreshNum()
		})

		$('.patient-row').on('click',function(){
			$(this).hide();
			var val = parseInt($(this).attr('id').replace('row-',''));
			selected.push(patientInformation[val]);
			//var html = '<a href="#" class="small-2 button radius" style="margin-left:5px">test</a>'
			var html = "<a href='#' class='button radius patient-link' style='margin-left:2px;margin-right;2px' id='link-" + val + "'>"+ patientInformation[val] + '</a>';
			$('#patient_id_links').append(html)
			patientLinkHandler('#link-' + val);

			refreshNum()
		})

		$('#add-auth-user').on('click',function(e){
			e.preventDefault();
			var val = $('#new-user').val();
			if ($(this).hasClass('error')==false && val != ''){
				$('#new-user').val("");
				var options = {
					addAuthUser:true,
					user:val
				}

				asyncRenderHbs('frangipani-generic-templates.hbs',options)
				.then(function(renderedHtml){
					$('#auth-users').append(renderedHtml).last('tr').find('a').on('click',function(e){
						e.preventDefault();
						$(this).closest('tr').remove();
					}).find(document).foundation();
				});
			}
		})

		$('.close-box').on('click',function(e){
			e.preventDefault();
			$(this).closest('.alert-box').hide();
		});

		$('#submit-new-project').on('click',function(e){
			e.preventDefault();
			var inputEmails = $('.auth-user-email')
			var emails = []
			for( var i=0; i< inputEmails.length; i++){
				var text = $(inputEmails[i]).text();
				if (emails.indexOf(text) == -1){
					emails.push(text);
				}
			}
			var projectId = $('#project_id').val();
			var details = $('#details').val();

			var options = {
				'project':{
					'project_id':projectId,
					'details':details,
				},
				'patients':selected,
				'users':emails
			};

			var promise = Promise.resolve($.ajax({
				url:'/database/addProject',
				type:'POST',
				contentType:'application/json',
				dataType:'json',
				data:JSON.stringify(options)
			}))

			promise.then(function(result){
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


	var projectPageHandlers = function(){
		$('#add-new-project').on('click',function(e){
			e.preventDefault();
			asyncRenderHbs('frangipani-add-new-project.hbs')
			.then(function(renderedHtml){
				$('#page-content').html(renderedHtml);
				return Promise.resolve($.ajax({
					url: "/patients",
					type: "GET",
					contentType: "application/json",
				}))

				
			}).then(function(result){
				var options = {patients:result};
				patientInformation = result.map(function(item){
					return item['patient_id'];
				})

				return asyncRenderHbs('frangipani-patients.hbs',options);
				
			}).then(function(result){
				$("#patient-information").html(result);
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
			projectInfo = result.map(function(item){
				return item['project_id'];
			});

			var options = {projects:result};
			return asyncRenderHbs('frangipani-projects.hbs',options)
		}).then(function(renderedHtml){
			$('#page-content').html(renderedHtml);
		}).then(function(){
			projectPageHandlers();
			$(document).foundation();
		});
	}

	var main = function(){
		loadhtml();
	};

	$(document).ready(main);
})()