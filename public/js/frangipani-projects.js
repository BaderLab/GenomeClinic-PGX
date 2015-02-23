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

	var matchSearch = function(input){
		var val = $('#searchBox').val()
		var re = new RegExp(val,'g','i');
		if ( val === '' )
			return true
		else if (input.match(re) != null)
			return true
		return false
	}		

	var refreshNum = function(){
		var rows = $('.patient-row:visible');
		$('#number-of-patients').text(rows.length);
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

	var patientRowHandler = function(){
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
	}

	var searchBoxHandler = function(){
		$('#searchBox').on('keyup',function(){
			for (var i=0; i < patientInformation.length; i++){
				if (matchSearch(patientInformation[i]) && selected.indexOf(patientInformation[i]) == -1 )
					$('#row-' + i).show();
				else 
					$('#row-' + i).hide();
			}

			refreshNum()
		})
	}

	var closeBox = function(){
		$('.close-box').on('click',function(e){
			e.preventDefault();
			$(this).closest('.alert-box').hide();
		});
	}

	var addNewProjectHandlers = function(){

		patientRowHandler();
		searchBoxHandler();
	
		$('#add-auth-user').on('click',function(e){
			e.preventDefault();
			var val = $('#new-user').val();
			if (val != ''){
				existsInDB('users','username',val)
				.then(function(result){
					if (result){
						$('#new-user').val("");
						var options = {
							addAuthUser:true,
							user:val
						}

						return asyncRenderHbs('frangipani-projects.hbs',options)
							.then(function(renderedHtml){
								$('#auth-users').append(renderedHtml).last('tr').find('a').on('click',function(e){
								e.preventDefault();
								$(this).closest('tr').remove();
								}).find(document).foundation();
					
							});
					} else {
						$("#new-user").addClass('error').siblings('small').show()
					}
				});
			}
		})

		$('input').on('keydown',function(){
			if ($(this).hasClass('error')){
				$(this).removeClass('error').siblings('small').hide();
			}
		})

		$('#project_id').on('keyup',function(){
			var self = $(this);
			var val = $(this).val();
			if (val == ''){
				$(this).addClass('error').siblings('small').text('Required Field').show();
			} else {
				existsInDB('projects','project_id',val)
				.then(function(result){
					console.log(result);
					if (result){
						$(self).addClass('error').siblings('small').text('Project name already exists').show();
					} else if ($(self).hasClass('error')){
						$(self).removeClass('error').siblings('small').hide();
					}
				})
			}
		})

		$('#submit-new-project').on('click',function(e){
			var description = $('#description').val();
			console.log(description);
			if( $('input').hasClass('error') == false && $('#project_id').val()!= "") {
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
						'description':description
					},
					'patients':selected,
					'users':emails
				};

				var promise = Promise.resolve($.ajax({
					url:'/database/projects/add',
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
						$('#error-display-message').text(result.error[0]).parents().find('#error-display-box').show();
					}
					
				})
			} else if ($('#project_id').val() == ""){
				$('#project_id').addClass('error').siblings('small').text('Required Field').show();
			}

		});

	};

	var projectPageHandlers = function(projectName){
		closeBox();

		$('#remove-patients').on('click',function(e){
			e.preventDefault();
			var checked  = $('input:checked').map(function(){
				return $(this).data('id').toString();
			}).toArray();
			if (checked.length > 0){
				$("#confirm-removal").find("h3").text("Are you sure you want to remove " + checked.length + " patients from " + projectName)
				
				$("#confirm-removal").find(".confirm").on('click',function(e){
					e.preventDefault();
					$(this).off('click');
					var data = {
						'patients':checked,
						'project':projectName

					}

					var promise = Promise.resolve($.ajax({
						url:'/database/projects/removepatients',
						type:'POST',
						contentType:'application/json',
						dataType:'json',
						data:JSON.stringify(data)
					}))

					promise.then(function(result){
						$('#confirm-removal').foundation('reveal','close');
						$('input:checked').closest('tr').remove()
						$('#error-display-message').text("Successfully removed " + checked.length + " patients from " + projectName)
						.parents().find("#error-display-box").show();
						refreshNum();
					});
					
				})

				$("#confirm-removal").find('.cancel').on('click',function(e){
					e.preventDefault();
					$(this).off('click');
					$('#confirm-removal').foundation('reveal','close');
				})

				$('#confirm-removal').foundation('reveal','open');
			}
		});

		$('#add-patients').on('click.modal',function(e){
			selected = [];
			e.preventDefault();
		
			getPatientInformation(projectName,true).then(function(result){
				patientInformation = result.map(function(item){
					return item['patient_id'];
				})
				var options = {patients:result};
				return asyncRenderHbs('frangipani-patients.hbs',options)
			}).then(function(renderedHtml){
				$('#add-patients-modal').find("#patient-information").html(renderedHtml);
				patientRowHandler();
				searchBoxHandler();
				$('.patient-row').on('click.resize', function(){
					if ($('#patient_id_links').height() > 150) {
						$('#patient_id_links').addClass('scrollit');
					} else {
						$('#patient_id_links').removeClass('scrollit');
					}
				})
			});
			$('#add-patients-modal').find('.cancel').on('click.modal',function(e){
				e.preventDefault();
				selected = [];
				$(this).off('click.modal');
				$('#add-patients-modal').find('#patient_id_links').empty();
				$('#add-patients-modal').find('#patient-information').empty();
				$('#add-patients-modal').foundation('reveal','close');
				$('.patient-row').off('click.modal');
			});

			$('#add-patients-modal').find('.confirm').on('click.modal',function(e){
				e.preventDefault();
				$(this).off('click.modal');
				var options = {
					patients:selected,
					project:projectName
				}
				var promise = Promise.resolve($.ajax({
					url:'/database/projects/addpatients',
					type:'POST',
					contentType:"application/json",
					dataType:'json',
					data:JSON.stringify(options)
				}))
				promise.then(function(result){
					$('#add-patients-modal').find('#patient_id_links').empty();
					$('#add-patients-modal').find('#patient-information').empty();
					$('#add-patients-modal').foundation('reveal','close')
					$('#error-display-message').text("Successfully added " + selected.length + " patients to " + projectName)
						.parents().find("#error-display-box").show();
					refreshNum();
					selected = [];
				}).then(function(){
					return getPatientInformation(projectName);
				}).then(function(result){
					var options = {
						patients:result,
						project:true
					};
					return asyncRenderHbs('frangipani-patients.hbs',options)
				}).then(function(renderedHtml){
					$('#patients-table').html(renderedHtml);
					$('.patient-row').off('click.modal');
				});
			});
			$('#add-patients-modal').foundation('reveal','open');
		});

	};

	var allProjectPageHandlers = function(){
		$('#add-new-project').on('click',function(e){
			e.preventDefault();
			asyncRenderHbs('frangipani-projects.hbs',{addProjectPage:true})
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

		$('.project-row').on('click',function(){
			var project = $(this).find('.frangipani-project-name').text();
			var promise = Promise.resolve($.ajax({
				url:'/database/projects',
				type:'POST',
				contentType:'application/json',
				dataType:'json',
				data:JSON.stringify({
					'project_id':project
					})
			}))

			promise.then(function(result){
				var options = result[0];
				options['projectInfoPage'] = true;
				return asyncRenderHbs('frangipani-projects.hbs',options)
			}).then(function(renderedHtml){
				$("#page-content").html(renderedHtml);
			}).then(function(){
				return getPatientInformation(project);
			}).then(function(result){
				var options = {
					patients:result,
					project:true
				}

				return asyncRenderHbs('frangipani-patients.hbs',options)
			}).then(function(renderedHtml){
				$('#patients-table').html(renderedHtml);
				$(document).foundation();
				projectPageHandlers(project);
			}).catch(function(err){
				console.log(err);
			});
		});

	};

	var getPatientInformation = function(project,excluded){
		var options = {
					'project':project,
					'exclude':excluded
		};

		return Promise.resolve($.ajax({
			url: "/patients",
			type: "POST",
			contentType: "application/json",
			dataType: 'json',
			data:JSON.stringify(options)
		}))

	};
	
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

			var options = {projects:result,projectPage:true};

			return asyncRenderHbs('frangipani-projects.hbs',options)
		}).then(function(renderedHtml){
			$('#page-content').html(renderedHtml);
		}).then(function(){
			allProjectPageHandlers();
			$(document).foundation();
		});
	}

	var main = function(){
		loadhtml();
	};

	$(document).ready(main);
})()