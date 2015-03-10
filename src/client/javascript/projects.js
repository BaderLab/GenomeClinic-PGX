/* Projects module
 *
 * Javascript and handlers for working and manipulating all projects requests / html
 * this module adds the ability to add/remove projects, additionally add or remove 
 * patients from a specific module
 * @Patrick Magee
 */
var $ = require('jquery'),
	templates = require('./templates'),
	utility = requite('./utility'),
	patientConstants = require('../../server/conf/constants.json').dbConstants.PATIENTS,
	projectConstants = require('../../server/conf/constants.json').dbConstants.PROJECTS,
	userConstants = require('../../server/conf/constants.json').dbConstants.USERS;


module.exports = function(){
	var patientInformation, projectInfo, projectName, owner,user;
	var selected = [];

	//=========================================================
	// General Functions
	//=========================================================


	/* Match the current contents of the search box
	 * to the input value using regex. if the values
	 * the search value is contained within the input
	 * the function returns true
	 * otherwise False
	*/
	var matchSearch = function(input){
		var val = $('#searchBox').val();
		var re = new RegExp(val,'g','i');
		if ( val === '' )
			return true;
		else if (input.match(re) !== null)
			return true;
		return false;
	};

	/* Submit an ajax request to the server to retrieve the patient
	 * information for a given project. If the additional parameter
	 * excluded is passed, then the returned data will not include
	 * the current project. returns a promise
	 */
	var getPatientInformation = function(project,excluded){
		if (project){
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
			}));
		} else {
			return Promise.resolve($.ajax({
				url:'/patients',
				type:'GET',
				contentType:'application/json'
			}));
		}

	};
	
	/* Render the Patient information into a table, adding it to the 
	 * specificed element. It will additionally add any passed handlers
	 * to the table.
	 * returns a promise
	 */
	var renderPatientInformation = function(project,excluded,remove,ele,handlers,callback){
		return getPatientInformation(project,excluded)
		.then(function(result){
			patientInformation = result.map(function(item){
				return item[patientConstants.ID_FIELD];
			});
			var options = {
				patients:result,
			};
			if (remove){
		 		options.project = true;
			}
			return templates.patient(options);
		}).then(function(renderedHtml){
			$(ele).html(renderedHtml);
		}).then(function(){
			if (handlers)
				return handlers(ele);
		}).then(function(){
			if (callback)
				callback(ele);
		});
	};		

	/* Refresh the number beside the patient table within a given
	 * element to reflect the current number of active rows
	 */
	var refreshNum = function(ele){
		var rows = $(ele).find('.patient-row:visible');
		$(ele).find('#number-of-patients').text(rows.length);
	};	


	/* Close the alert box
	 */
	var closeBox = function(){
		$('.close-box').on('click',function(e){
			e.preventDefault();
			$(this).closest('.alert-box').hide().removeClass('alert');
		});
	};


	//=========================================================
	// Page Handlers
	//=========================================================

	/* Add handlers to the patient links and refresh the rest of
	 * the content
	 */
	var patientLinkHandler = function(id,ele){
		$(id).on('click',function(e){
			e.preventDefault();
			var text = $(this).text();
			var index = patientInformation.indexOf(text);
			selected.splice(selected.indexOf(text),1);
			if (matchSearch(text))
				$('#row-' + index).show();

			$(this).remove();
			refreshNum(ele);
		});
	};

	/* Add handlers to the patient rows. when they are clicked, generate a button
	 * that will be placed within the patient_link_id div, and add the patient
	 * to the selected variable
	 */
	var patientRowHandler = function(ele){
		$(ele).find('.patient-row').on('click',function(){
			$(this).hide();
			var val = parseInt($(this).attr('id').replace('row-',''));
			selected.push(patientInformation[val]);
			var html = "<a href='#' class='button radius patient-link' style='margin-left:2px;margin-right;2px' id='link-" + val + "'>"+ patientInformation[val] + '</a>';
			$('#patient_id_links').append(html);
			patientLinkHandler('#link-' + val,ele);
			refreshNum(ele);
		});
	};

	
	/* Add the listeners onto the searchBox. hide the content that does not match
	 * the field within the search box. Alternatively display content that matches
	 * in the search box
	 */
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

	/* Confirmation modal function
	 * when the specified button is click, reveal the targeted modal.
	 * When the button is first clicked, execute the clickFunction,
	 * upon completetion of the click function add handlers to the 
	 * confirm and cancel buttons. WHen one of the buttons is clicked
	 * execute the callback, then hide the modal
	 */
	var confirm = function(ele, secEle, useModal, clickFunction, callback){
		$(ele).on('click',function(e){
			e.preventDefault();
			var clickFunctionPromise = Promise.resolve();
			if (clickFunction)
				clickFunctionPromise = Promise.resolve().then(function(){ return clickFunction(secEle);});

			clickFunctionPromise.then(function(result){
				if (result){
					$(secEle).find('.confirm').on('click',function(e){
						e.preventDefault();
						$(this).off('click');
						if (useModal)
							$(secEle).foundation('reveal','close');
						return callback(true,result,secEle);			
					});
					$(secEle).find('.cancel').on('click',function(e){
						e.preventDefault();
						$(this).off('click');
						if (useModal)
							$(secEle).foundation('reveal','close');
						callback(undefined,result,secEle);
					});
					if(useModal)
						$(secEle).foundation('reveal','open');
				}
			});
		});
	};

	var addNewAuthUser = function(){
		$('#new-user').on('keyup',function(e){
			if (e.keyCode == 13){
				$('#add-auth-user').trigger('click');
			}
		});
		$('#add-auth-user').on('click',function(e){
			e.preventDefault();
			var val = $('#new-user').val();
			var inputEmails = $('.auth-user-email');
			var emails = [];
			for( var i=0; i< inputEmails.length; i++){
				var text = $(inputEmails[i]).text();
				if (emails.indexOf(text) == -1){
					emails.push(text);
				}
			}
			if (emails.indexOf(val) != -1) {
				$("#new-user").addClass('error').siblings('small').text('That user already has authorization').show();
			} else if (val !== ''){
				//submit ajax requst to check to see if the username exists in the db
				utility.existsInDB(userConstants.COLLECTION,userConstants.ID_FIELD,val)
				.then(function(result){
					//user exists so add to Auth user table
					if (result){
						var currentUsers = $('#new-user').val("");
						var options = {
							addAuthUser:true,
							user:val
						};
						templates.project.user(options)
						.then(function(renderedHtml){
							$('#auth-users').append(renderedHtml).last('tr').find('a').on('click',function(e){
								e.preventDefault();
								$(this).closest('tr').remove();
							});
						}).then(function(){
							utility.refresh();
						});
					} else {
						//user does not exists, activate error
						$("#new-user").addClass('error').siblings('small').show();
					}
				});
			}
		});
	};

	var removeInputErrors = function(){
		$('input').on('keydown',function(){
			if ($(this).hasClass('error')){
				$(this).removeClass('error').siblings('small').hide();
			}
		});
	};
	/* New Project Handlers
	 * add all the page handlers for facilitating the addition of a new project
	 * to the database. This is a rendered page from frangipani-projects.hbs'.
	 */ 
	var addNewProjectHandlers = function(){
		//generic handlers
		patientRowHandler('#patient-information');
		searchBoxHandler('#patient-information');
		addNewAuthUser();
		removeInputErrors();
		//add a new authorized user

		//Clear the error whenever you start typing within an input
		$('#add-all-visible').on('click',function(e){
			e.preventDefault();
			$('tr:visible').each(function(ind,item){
				$(item).trigger('click');
			});
		});

		$("#remove-all-visible").on('click',function(e){
			e.preventDefault();
			$('#patient_id_links').children('.patient-link').each(function(ind,item){
				$(item).trigger('click');
			});
		});
		//Check to see if the currnent input field for the project id exists within the database
		$('#project_id').on('keyup',function(){
			var self = $(this);
			var val = $(this).val();
			if (val === ''){
				$(this).addClass('error').siblings('small').text('Required Field').show();
			} else {
				utility.existsInDB(projectConstants.COLLECTION,projectConstants.ID_FIELD,val)
				.then(function(result){
					if (result){
						$(self).addClass('error').siblings('small').text('Project name already exists').show();
					} else if ($(self).hasClass('error')){
						$(self).removeClass('error').siblings('small').hide();
					}
				});
			}
		});

		//Make a ajax request to submit the form
		$('#submit-new-project').on('click',function(e){
			//ensure there are no errors within the page
			if( $('input').hasClass('error') === false && $('#project_id').val()!== "") {
				e.preventDefault();
				var description = $('#description').val();
				var inputEmails = $('.auth-user-email');
				var emails = [];
				for( var i=0; i< inputEmails.length; i++){
					var text = $(inputEmails[i]).text();
					if (emails.indexOf(text) == -1){
						emails.push(text);
					}
				}
				var projectId = $('#project_id').val();
				var keywords = $('#keywords').val();
				var options = {
					'project':{},
					'patients':selected,	
				};
				options.project[projectConstants.ID_FIELD] = projectId;
				options.project[projectConstants.KEYWORDS_FIELD] = keywords;
				options.project[projectConstants.INFO_FIELD] = description;
				options[projectConstants.AUTH_USER_FIELD] = emails; 
				//send the data
				var promise = Promise.resolve($.ajax({
					url:'/database/projects/add',
					type:'POST',
					contentType:'application/json',
					dataType:'json',
					data:JSON.stringify(options)
				}));

				promise.then(function(result){
					if (result.redirectURL){
						window.location.replace(result.redirectURL);
					//unsuccessful request, open errror box
					} else {
						$('#error-display-message').text(result.error[0]).parents().find('#error-display-box').show();
					}
				});
			} else if ($('#project_id').val() === ""){
				//no input within the project_id field
				$('#project_id').addClass('error').siblings('small').text('Required Field').show();
			}

		});

	};

	/* Project Page handlers
	 * Add all of the handlers for the rendered project page for the
	 * specific project
	 */
	var projectPageHandlers = function(){
		//generic handlers
		closeBox();
		addNewAuthUser();
		removeInputErrors();
		$('.auth-user-email').closest('tr').find('a').on('click',function(e){
			e.preventDefault();
			$(this).closest('tr').hide();
		});
		var remove = (user==owner);
		confirm('#edit-page','#change-details',false,function(ele){
			$(ele).show().closest('fieldset').find('#fixed-details').hide(0);
			var _default = {
				keywords:$('#keywords').val(),
				description:$('#description').val()
			};
			return _default;
		},function(confirm,_default,content){
			if (confirm){
				var inputEmails = $('.auth-user-email:visible');
				var emails = [];
				for( var i=0; i< inputEmails.length; i++){
					var text = $(inputEmails[i]).text();
					if (emails.indexOf(text) == -1){
						emails.push(text);
					}
				}
				var projectId = projectName;
				var description = $('#description').val();
				var keywords = $('#keywords').val();
				var _o = {
					project:projectId,
					update:{}
				};
				_o.update[projectConstants.INFO_FIELD] = description;
				_o.update[projectConstants.KEYWORDS_FIELD] = keywords;
				_o.update[projectConstants.AUTH_USER_FIELD] = emails;
				
				Promise.resolve($.ajax({
					url:'/database/project/update',
					type:'POST',
					contentType:'application/json',
					dataType:'json',
					data:JSON.stringify(_o)
				})).then(function(result){
					if (result.statusCode == "200"){
						return renderProjectInfo(projectName);
					} else {
						$('#error-display-message').text(result.error)
						.parents().find("#error-display-box").show();
					}
				});
			} else {
				$('.auth-user-email').closest('tr').find('a').show();
				$('#keywords').val(_default.keywords);
				$('#description').val(_default.description);
				$(content).hide().parents().find('#fixed-details').show();
			}

		});


		//add handlers to remove patients
		//

		confirm('#remove-patients','#confirm-removal',true,function(modal){
			var checked = $('input:checked').map(function(){
				return $(this).data('id').toString();
			}).toArray();
			if (checked.length > 0){
				$(modal).find('h3').text("Are you sure you want to remove " + checked.length + " patients from " + projectName);
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
					$('input:checked').closest('tr').remove();
					$('#error-display-message').text("Successfully removed " + checked.length + " patients from " + projectName)
					.parents().find("#error-display-box").show();
					refreshNum('#patients-table');
				});
			}
		});
		
		//add handlers to add-patients
		confirm('#add-patients','#add-patients-modal',true,function(modal){
			selected = [];
			
			return renderPatientInformation(projectName,true,false,'#patient-information',function(){
				patientRowHandler('#patient-information');
				searchBoxHandler('#patient-information');
				$('.patient-row').on('click.resize', function(){
					if ($('#patient_id_links').height() > 150) {
						$('#patient_id_links').addClass('scrollit');
					} else {
						$('#patient_id_links').removeClass('scrollit');
					}
				});
			}).then(function(result){return true;});
		},function(confirm,result,modal){
			if (confirm){
				var options = {
					patients:selected,
					project:projectName
				};
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
					return renderPatientInformation(projectName,undefined,remove,'#patients-table',function(){
						$('.patient-row').off('click');
					});
				});
			} else {
				selected = [];
				$(modal).find('#patient_id_links').empty().removeClass('scrollit');
				$(modal).find('#patient-information').empty();
				$('.patient-row').off('click');
			}
		});
		
		//Add handlers to delete project
		confirm('#delete-project','#confirm-removal',true,function(modal){
			$(modal).find('h3').text("Are you sure you want to delete this project? the operation is permanent and you will not be able to recover it afterwards. You will be redirected if the request is successful");
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
						window.location.replace((result.redirectURL || '/projects'));
					} else {
						$('#error-display-message').text(result.error).addClass('alert')
						.parents().find("#error-display-box").show();
					}
				});
			}
		});	
	};

	/* Add page handlers to the All Project Page.
	 * this page displays all fo the current active projects for a given
	 * user
	 */
	var allProjectPageHandlers = function(){
		$('#add-new-project').on('click',function(e){
			e.preventDefault();
			templates.project.new()
			.then(function(renderedHtml){
				$('#main').html(renderedHtml);
				return renderPatientInformation(undefined,false,false,'#patient-information',addNewProjectHandlers);
			});
		});

		$('.project-row').on('click',function(){
			project = $(this).find('.frangipani-project-name').text();
			renderProjectInfo(project);
		});
	};

	

	var renderProjectInfo = function(project){
		var remove;
		projectName = project;
		Promise.resolve($.ajax({
			url:'/database/projects',
			type:'POST',
			contentType:'application/json',
			dataType:'json',
			data:JSON.stringify({
				'project_id':projectName
			})
		})).then(function(result){
			owner = result[0].owner;
			remove = (owner == user);
			var options = result[0];
			options.isOwner = remove;
			return templates.project.info(options);	
		}).then(function(renderedHtml){
			$('#main').html(renderedHtml);
			return renderPatientInformation(projectName,undefined,remove,'#patients-table',function(){
				projectPageHandlers();
			});	
		}).then(function(){
			utility.refresh();
		}).catch(function(err){
			console.log(err);
		});
	};

	var loadhtml = function(){
		var promise = Promise.resolve($.ajax({
			url:'/database/projects',
			type:'GET',
			contentType:'application/json'
		}));

		promise.then(function(result){
			projectInfo = result.map(function(item){
				return item[projectConstants.ID_FIELD];
			});

			var options = {projects:result,projectPage:true};

			return templates.project.index(options);
		}).then(function(renderedHtml){
			$('#main').html(renderedHtml);
		}).then(function(){
			allProjectPageHandlers();
		}).then(function(){
			utility.refresh();
		});
	};

	var main = function(){
		utility.getUserInfo().then(function(result){
			user = result.user;
		}).then(function(){
			return loadhtml();
		});
	};

	main();

};