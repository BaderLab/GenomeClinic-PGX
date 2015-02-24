(function(){
	var patientInformation, projectInfo, projectName;
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
	
	var renderPatientInformation = function(project,excluded,ele,handlers,callback){
		return getPatientInformation(project,excluded)
		.then(function(result){
			patientInformation = result.map(function(item){
				return item['patient_id'];
			})
			var options = {
				patients:result,
				project:true
			}
			return asyncRenderHbs('frangipani-patients.hbs',options)
		}).then(function(renderedHtml){
			$(ele).html(renderedHtml).find(document).foundation();
		}).then(function(){
			if (handlers)
				return handlers(ele);
		}).then(function(){
			if (callback)
				callback(ele)
		});
	};		

	var refreshNum = function(ele){
		var rows = $(ele).find('.patient-row:visible');
		$(ele).find('#number-of-patients').text(rows.length);
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

	var patientRowHandler = function(ele){
		$(ele).find('.patient-row').on('click',function(){
			$(this).hide();
			var val = parseInt($(this).attr('id').replace('row-',''));
			selected.push(patientInformation[val]);
			//var html = '<a href="#" class="small-2 button radius" style="margin-left:5px">test</a>'
			var html = "<a href='#' class='button radius patient-link' style='margin-left:2px;margin-right;2px' id='link-" + val + "'>"+ patientInformation[val] + '</a>';
			$('#patient_id_links').append(html)
			patientLinkHandler('#link-' + val);

			refreshNum(ele);
		});
	};

	var searchBoxHandler = function(ele){
		$('#searchBox').on('keyup',function(){
			for (var i=0; i < patientInformation.length; i++){
				if (matchSearch(patientInformation[i]) && selected.indexOf(patientInformation[i]) == -1 )
					$(ele).find('#row-' + i).show();
				else 
					$(ele).find('#row-' + i).hide();
			}
			refreshNum(ele);
		});
	};

	var closeBox = function(){
		$('.close-box').on('click',function(e){
			e.preventDefault();
			$(this).closest('.alert-box').hide().removeClass('alert');
		});
	}

	var confirm = function(ele, modal, clickFunction, callback){
		$(ele).on('click',function(e){
			e.preventDefault();
			var result = true;
			if (clickFunction)
				result = clickFunction(modal);

			console.log(result);
			if(result){
				console.log($(modal));
				$(modal).find('.confirm').on('click',function(e){
					e.preventDefault();
					$(this).off('click');
					$(modal).foundation('reveal','close');
					callback(true,result)					
				});
				$(modal).find('.cancel').on('click',function(e){
					e.preventDefault();
					$(this).off('click');
					$(modal).foundation('reveal','close');
					callback(undefined,result);
					
				});
				$(modal).foundation('reveal','open');
			}
		});
	}

	var addNewProjectHandlers = function(){
		patientRowHandler('#patient-information');
		searchBoxHandler('#patient-information');
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

	var projectPageHandlers = function(){
		closeBox();
		confirm('#remove-patients','#confirm-removal',function(modal){
			var checked = $('input:checked').map(function(){
				return $(this).data('id').toString();
			}).toArray();
			if (checked.length > 0){
				$(modal).find('h3').text("Are you sure you want to remove " + checked.length + " patients from " + projectName)
				return checked;
			}
			return undefined;
		}, function(confirm,checked){
			if (confirm){
				var data = {
						'patients':checked,
						'project':projectName
				};
				Promise.resolve($.ajax({
					url:'/database/projects/removepatients',
					type:'POST',
					contentType:'application/json',
					dataType:'json',
					data:JSON.stringify(data)
				})).then(function(result){
					$('input:checked').closest('tr').remove()
					$('#error-display-message').text("Successfully removed " + checked.length + " patients from " + projectName)
					.parents().find("#error-display-box").show();
					refreshNum('#patients-table');
				})
			}
		})
		
		confirm('#add-patients','#add-patients-modal',function(modal){
			selected = [];
			return renderPatientInformation(projectName,true,'#patient-information',function(){
				patientRowHandler('#patient-information');
				searchBoxHandler('#patient-information');
				$('.patient-row').on('click.resize', function(){
					if ($('#patient_id_links').height() > 150) {
						$('#patient_id_links').addClass('scrollit');
					} else {
						$('#patient_id_links').removeClass('scrollit');
					}
				});
				return true;
			})
		},function(confirm,result,modal){
			if (confirm){
				var options = {
					patients:selected,
					project:projectName
				}

				Promise.resolve($.ajax({
					url:'/database/projects/addpatients',
					type:'POST',
					contentType:"application/json",
					dataType:'json',
					data:JSON.stringify(options)
				})).then(function(result){
					$(modal).find('#patient_id_links').empty();
					$(modal).find('#patient-information').empty();
					$('#error-display-message').text("Successfully added " + selected.length + " patients to " + projectName)
						.parents().find("#error-display-box").show();
					selected = [];
					$(modal).find('#patient_id_links').empty().removeClass('scrollit');
					$(modal).find('#patient-information').empty();
				}).then(function(){
					return renderPatientInformation(projectName,undefined,'#patients-table',function(){
						$('.patient-row').off('click')
					})
				});
			} else {
				selected = [];
				$(modal).find('#patient_id_links').empty().removeClass('scrollit');
				$(modal).find('#patient-information').empty();
				$('.patient-row').off('click')
			}
		})

		confirm('#delete-project','#confirm-removal',function(modal){
			$(modal).find('h3').text("Are you sure you want to delete this project? the operation is permanent and you will not be able to recover it afterwards. You will be redirected if the request is successful")
			return true;
		}, function(confirm,result,modal){
			if (confirm){
				Promise.resolve($.ajax({
					url:'/database/projects/delete',
					type:'POST',
					contentType:'application/json',
					dataType:'json',
					data:JSON.stringify({project:projectName})

				})).then(function(result){
					if (result.statusCode == '200'){
						window.location.replace((result.redirectURL || '/projects'))
					} else {
						$('#error-display-message').text(result.error).addClass('alert')
						.parents().find("#error-display-box").show();
					}
				});
			}
		})	
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
			projectName = $(this).find('.frangipani-project-name').text();
			var promise = Promise.resolve($.ajax({
				url:'/database/projects',
				type:'POST',
				contentType:'application/json',
				dataType:'json',
				data:JSON.stringify({
					'project_id':projectName
					})
			}))

			promise.then(function(result){
				var options = result[0];
				options['projectInfoPage'] = true;
				return asyncRenderHbs('frangipani-projects.hbs',options)
			}).then(function(renderedHtml){
				$("#page-content").html(renderedHtml);
			}).then(function(){
				return getPatientInformation(projectName);
			}).then(function(result){
				var options = {
					patients:result,
					project:true
				}

				return asyncRenderHbs('frangipani-patients.hbs',options)
			}).then(function(renderedHtml){
				$('#patients-table').html(renderedHtml);
				$(document).foundation();
				projectPageHandlers();
			}).catch(function(err){
				console.log(err);
			});
		});

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