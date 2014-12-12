/*
 * Frangipani app Javascript.
 * @author Ron Ammar
 * @patrick Magee
 */

/* 
 * Auxiliary helper functions:
 */

/* Function to retrieve and render a handlebars template. This function is
 * modified from the function provided by user koorchik on StackOverFlow:
 * http://stackoverflow.com/questions/8366733/external-template-in-underscore
 * as explained on the following blog entry:
 * http://javascriptissexy.com/handlebars-js-tutorial-learn-everything-about-handlebars-js-javascript-templating/
 *
 * NOTE: In the future, I would compile all my templates into a single
 * templates.js file and load that in the beginning rather than have many
 * small synchronous AJAX calls to get templates when the webpage loads.
 */
var renderHbs= function(template_name, template_data) {
	if (!renderHbs.template_cache) { 
	    renderHbs.template_cache= {};
	}

	if (!renderHbs.template_cache[template_name]) {
		var template_url= '/templates/' + template_name;
		$.ajax({
			url: template_url,
			method: 'GET',
			async: false,  // I'm keeping this async for now (from original code) - but I really don't like it
			success: function(data) {
				renderHbs.template_cache[template_name]= Handlebars.compile(data);
			}
		});
	}

	return renderHbs.template_cache[template_name](template_data);
};



/* AJAX call to application server to retrieve projects. */
var getProjects= function() {

	var promise= Promise.resolve($.ajax({
		url: "/datasets",  // Need the "http://" here or will get CORS error
		type: "GET",
		contentType: "application/json",
	}));

	return promise.then( function(result) {
		updateProjectTable(result);
	});
};

/* Get patients from this project. Project details are passed in via
 * options object keyed by "thisButton".
 * @return {Object} A promise describing state of request. */
var getProjectPatients= function(options) {
	// Find out if this is a new table or rows to be appended to existing table
	if (options["pageToken"] === undefined) {
		var projectButton= options["thisButton"];
		var projectId= projectButton.data("id");
		var projectName= projectButton.data("project");
		var currentTemplate= "frangipani-project-details.hbs";
		var domInsertPoint= patientTable;
		var pageToken= undefined;
		resetPatientTable();
	} else {
		console.log('here')
		currentTemplate= "frangipani-more-patients.hbs";
		domInsertPoint= patientTable.find("tbody");
		projectId= options["id"];
		pageToken= options["pageToken"];
	}

	//Promise Function
	var promise= Promise.resolve($.ajax({
		url: "/callsets/search",
		type: "POST",
		contentType: "application/json",
		dataType: "json",
		data: JSON.stringify({
			"variantSetIds": [projectId],
			"pageSize": 30,
			"pageToken": pageToken
		})
	}));

	promise.then(function(result) {
		var context= {
			"callSets": result["callSets"],
			"nextPageToken": result["nextPageToken"],
			"projectName": projectName,
			"id": projectId
		}
		var html= renderHbs(currentTemplate, context);
		domInsertPoint.append(html);


		//Add Click event handlers to new rendered html
		$('.frangipani-patient-link').on('click',getPatientVariantQuery);
		$('.frangipani-back-button').off('click');
		$(".frangipani-back-button").on('click',function(event){
				event.preventDefault();
				patientTable.empty();
				toggleProjectsSideBar();
			});

		// update the progress spinner's next page token, if the spinner already exists
		progressSpinner.data("next-page", context["nextPageToken"]);
	
		return context;

	}).then(function(context) {
		// set scrolledToBottom to false, to allow for AJAX request triggers
		// on scroll events only after the table has been appended. If there
		// are no more page tokens, we have reached the bottom.
		refresh();
		if (context["nextPageToken"] !== undefined) {
			scrolledToBottom= false;
		}
		progressSpinner.hide();
	});

	return promise;
};

/* construct an ajax call to the google server to retrive variant information
 * based on passed in information or informatiuon contained in the page footer.
* If there are more patients, load them when scrolled to the bottom of the
 * patient table. */
var getVariantCallSet = function(options){
		//new search
		if (options['pageToken']===undefined){
			var dataToAdd = options;
			var template = "frangipani-variant-table.hbs";
			var domInsertPoint = $('#tableContents');

		//adding on to previous table
		} else {
			var dataholder = progressSpinner.data();
			var template = "frangipani-more-variants-table.hbs";
			var domInsertPoint = $('#tableContents').find("tbody");

			//data construct to pass to the ajax call
			var dataToAdd = {
				'pageToken': options['pageToken'],
				'pageSize': 30,
				'callSetIds': [progressSpinner.data('patient-id')],
				'variantSetIds': [progressSpinner.data('dataset-id')],
				'referenceName': progressSpinner.data('reference-name'),				
			};

			//optionally add start and stop positions if they were provided
			if (progressSpinner.data('start-pos') !== "none"){
				dataToAdd['start'] = progressSpinner.data('start-pos');
			} 
			if (progressSpinner.data('end-pos') !== "none"){
				dataToAdd['end'] = progressSpinner.data('end-pos');
			}

		}

		//promise function takes in previously parsed dataToAdd
		var promise = Promise.resolve($.ajax({
			url: "/variants/search",
			type: "POST",
			contentType: "application/json",
			dataType: "json",
			data: JSON.stringify(dataToAdd)}));

		promise.then(function(results){
			//need to modify the start and stop fields from undefined in order to allow
			//proper page displahy
			if (dataToAdd['start'] === undefined){
				dataToAdd['start'] = "none";

			} 
			if (dataToAdd['end'] === undefined){
				dataToAdd['end'] = "none";
			}

			//Searcgh through results variants and determine
			//zygosity and genotype to add to the table
			var variants = results['variants'];
			for (var i=0; i < variants.length; i++){
				variants[i]['phase'] = variants[i].calls[0].phaseset;
				var genotypeArray = variants[i].calls[0].genotype;
				var zygosity = 0;
				var genotype = [];
				for (var j = 0; j < genotypeArray.length; j++){
					if (genotypeArray[j] === 0){
						genotype.push(variants[i]['referenceBases']);
					} else {
						zygosity += 1;
						genotype.push(variants[i]['alternateBases'][genotypeArray[j]-1]);
					}
				}
				genotype = genotype.join('/');
				if (zygosity === 0){
					zygosity = 'homo_ref';
				} else  if (zygosity === 1){
					zygosity = 'hetero';
				} else {
					zygosity = 'homo_alt';
				}
				variants[i]['zygosity'] = zygosity;
				variants[i]['genotypeCall'] = genotype;
			};


			results['patientName'] = patientTable.find("h3").data('patient-name')	;
			results['callSetIds'] = dataToAdd['callSetIds'][0]
			results['referenceName'] = dataToAdd['referenceName'];
			results['variantSetIds'] = dataToAdd['variantSetIds'][0];
			results['start'] = dataToAdd['start'];
			results['end'] = dataToAdd['end'];
			//render HTML onto the page populating the table
			var html = renderHbs(template,results);	
			domInsertPoint.append(html);
			//add in evenet listeners to rs numbers here

			progressSpinner.data('next-page',results['nextPageToken']);
			return results;
		}).then(function(result) {
		// set scrolledToBottom to false, to allow for AJAX request triggers
		// on scroll events only after the table has been appended. If there
		// are no more page tokens, we have reached the bottom.
		refresh();
		if (result["nextPageToken"] !== undefined) {
			scrolledToBottom= false;
		}
		progressSpinner.hide();
		});

		return promise;
};


/* Code snippet taken from jqeury github page for reliablly scrolling
 * to top or bottom of body when it is called. This function runs once. */
var scrolltoTop = function(){

	$.Deferred(function( defer ) {
    	$( "html, body" ).animate({
        // scroll to end of page
        	scrollTop: 0,
        	scrollLeft: 0,
        },'fast', defer.resolve );
		}).done(function() {
    	});
}


/* Clear the main application div. */
var clearApplicationMain= function() {
	// Scroll to the top of the page using animation
	//$("body").animate({scrollTop: 0, scrollLeft: 0}, "fast");
	scrolltoTop();
	applicationMain.children().remove();
};

/* Reset the patient table. */
var resetPatientTable= function() {
	// Scroll to the top of the page using animation, and set scrolledToBottom
	// as true to block AJAX request triggers on scroll events until we're at the top
	scrolledToBottom= true;
	scrolltoTop();

	
	// Clear patient table
	patientTable.children().remove();
};


//adds a class to a div
var toggleClassOnDiv = function(component,classIdentifier){
	component.toggleClass(classIdentifier);
};

/* Update the table of projects. */
var updateProjectTable= function(context) {
	clearApplicationMain();
	if (!projectSideBarState){
		projectSideBarState = true
		toggleClassOnDiv($('.frangipani-project-details'),'large-12');
	}
	// sort datasets in case-insensitive manner by name key
	var compare= function (d1, d2) {
		var a= d1.name.toUpperCase();
		var b= d2.name.toUpperCase();
		if (a < b)
			return -1;
		if (a > b)
			return 1;
		return 0;
	};
	context.datasets= context.datasets.sort(compare);


	var html= renderHbs('frangipani-projects.hbs', context);
	applicationMain.append(html);

	// Add event listeners and refresh jQuery DOM objects.
	addProjectEventListeners();
	refresh();
};


/*
 * Event listeners
 */

/* When a button is clicked, calls a function. While the function is 
 * executing, button displays some intermediate text. Upon completion, button
 * reverts to original text. */
var clickAction= function(button, promiseFunction, options, useThis) {
	var originalText;

	var resetButton= function(val) {
		button.text(originalText);
		buttonClicked = false
	};

	button.on("click", function(event) {
		event.preventDefault();
		if (!buttonClicked){
			buttonClicked=true
			if (useThis === true) {
				button= $(this);
				options["thisButton"]= $(this);
			}

			originalText= button.text();
			button.text("Fetching...");

			if (options === undefined) {
				promiseFunction().then(resetButton).then();
			} else {
				promiseFunction(options).then(resetButton);
			}
		}
	});
};



/* When triggered this button will toggle the side projects bar
 * Hiding it and increasing the main div size to 12 columns.
 * Its behaviour is controlled by a global variable: ProjectBarState
 * Which several functions (including the Browse function) set back
 * to true when activated.
*/
var projectSideBarState = true;
var previousHtml;
var projectSideBar = $(".frangipani-available-projects");
var toggleProjectsSideBar = function(){
	if (projectSideBarState === true){	
		//save the contents of the div
		previousHtml = $('#frangipani-title-description').html()
		$('#frangipani-title-description').empty().append('<a href="#" class="button"><i class="fi-arrow-left"> Back</i></a>').find('a')
		.addClass('frangipani-back-button');
		$('.frangipani-available-projects').toggle('slide');
		$('#frangipani-project-details').addClass('large-12');

		projectSideBarState = false;
	} else {
		//remove the button and repopulate with the previously saved html
		$('#frangipani-title-description').empty().append(previousHtml);
		$('#frangipani-project-details').removeClass('large-12')	
		$('.frangipani-available-projects').toggle('slide');

		//reset the state
		projectSideBarState = true;
	}
};

/* Main Function for handling Variant searches and queries.
 * Starts by loading a form into the browswer into the patientDetails
 * div. When data is inputted and then submitted the a request is sent
 * to the google server to retrieve variant information. it is then
 * displayed in the browser
*/
var getPatientVariantQuery = function(options){
	$(window).off('scroll.table');
	var isSearching;
	var button = this.dataset;
	var patientName = button['patientName'];
	var callSetIds = button['patientId'];
	var variantSetIds = $('#frangipani-progress-spinner').data('id');
	var context = {'patientName': patientName,'callSetIds': callSetIds,'variantSetIds': variantSetIds};
	var html = renderHbs("frangipani-request-variants.hbs",context);	

	//empty the current contents of the patientTable Div and append the search html
	applicationDataPreviousState = patientTable.html()	
	patientTable.empty();
	patientTable.append(html);

	//refresh the progressSpinner, this will be used later
	refresh();
	progressSpinner.hide();
	scrolledToBottom = false;

	// field data validation. eventually to be replaced
	// by data validation within the html itself
	var validate = function(){

		var validObjects = new Object();
		var start = +$('#start-position').val();
		var end = +$('#end-position').val();
		var referenceName = $('#reference-name').val();

		if (referenceName.length !== 0){
			validObjects['referenceName'] = referenceName;
		} else {
			return undefined;
		}
		if(start > 0 && start !== NaN ){
			validObjects['start'] = start;
		}
		if (end > 0 && end !== NaN){
			validObjects['end'] = end;
		}
		return validObjects;
	};

	//add information to the back button event handler
	$('.frangipani-back-button').data({'id':variantSetIds,'project':""}).data()
	$('.frangipani-back-button').off('click');
	$('.frangipani-back-button').on('click',function(event){
		if (!buttonClicked){
			buttonClicked = true;
			event.preventDefault();
			var options = {'thisButton':$(this)};
			getProjectPatients(options).then(function(){
				buttonClicked = false;
			});
		}
	});

	/*  when the new search button is clicked it will cause
     *  the Search box to drop dowm. the new search button
     * itself is hid
     */
	$('#frangipani-new-search').on('click',function(event){
		event.preventDefault();
		if(!buttonClicked){
			$(this).toggle();
			$('.variant-query-fields').slideDown().find("input").val("");
		}
	});

	//Fill the input fields with example data
	$("#frangipangi-query-field-example").on('click',function(event){
		event.preventDefault();
		$('#start-position').val('41200000');
		$('#end-position').val('412800000');
		$('#reference-name').val('17');
	});

	//Cancel the search. Cannot be used when a button is already clicked.
	$('#frangipani-cancel-variant-request').on('click',function(event){
		event.preventDefault();
		$('.variant-query-fields').slideUp().parent().find('#frangipani-new-search').slideDown();
		buttonClicked = false;
	});


	/* When this button is clicked a the data from the form is first
	 * Parsed and then validated. A query is then sent to retrieve
	 * variant information for the specified individual. Succesful searches
	 * populate a table
	 */
	$('#frangipani-submit-variant-request').on('click', function(event){

		if (!buttonClicked){
			buttonClicked = true;
			event.preventDefault();
			var searchObjects = validate();
			if (searchObjects !== undefined){
				//hide the search tab and add a spinner to the new search button while data is loading
				$('.variant-query-fields').slideUp().parent().find('#frangipani-new-search')
				.text("")
				.append('<i class="fa fa-refresh fa-spin"></i>')
				.slideDown();
				$("#tableContents").empty();

				//options to send to the variantCall
				var options = $.extend({'callSetIds': [callSetIds],
					'variantSetIds': [variantSetIds],
					'pageSize': 30,
					'pageToken': undefined}, 
					searchObjects);
				//variant Call
				getVariantCallSet(options).then(function(){
					$("frangipani-new-search").text = "New Search";
					//isSearching = false;
					buttonClicked = false;
					loadPatientsOnScroll(getVariantCallSet);
					$('#frangipani-new-search').empty().text("NewSearch")	
				});
				
			} else {
				//preliminary alert
				buttonClicked = false
				alert("YOU DID NOT PUT IN THE PROPER ELEMENTS");
			}
			
		}

	});
};


/* When attached to a function, this event handler watches
 * the screen to keep track of when the user has reached the
 * bottom of the current table. When this happens, that attached
 * function is triggered, populating the next page of the table
 * this allows for continuous scrolling.
*/
var loadPatientsOnScroll= function(addContentFunction) {
	$(window).on("scroll.table", function(event) {
		if (!scrolledToBottom && 
			progressSpinner.data("next-page") != "" &&
			$(window).scrollTop() + $(window).height() >= patientTable.height()) {
			scrolledToBottom= true;
			progressSpinner.show();
			var options= {
				"id": progressSpinner.data("id"),
				"pageToken": progressSpinner.data("next-page")
			};
			addContentFunction(options);
		}
	});
};

/* Add the app event listeners */
var addProjectEventListeners= function() {
	clickAction($(".frangipani-project-name"), getProjectPatients, {}, true);
	$('.frangipani-project-name').on('click',toggleProjectsSideBar);
	loadPatientsOnScroll(getProjectPatients);
};


/*
* Main app function.
*/

var buttonClicked = false;
var applicationDataPreviousState;
var originalText;
var applicationMain;
var app= function() {
applicationMain= $("#frangipani-app-main");
clickAction($("#frangipani-browse-button"), getProjects);
};
/* App components */
var patientTable;
var scrolledToBottom= true;
var progressSpinner;
var refresh= function() {
patientTable= $("#frangipani-project-details");
progressSpinner= $("#frangipani-progress-spinner");
};


/* 
 * Wait for the DOM to load before any processing.
 */
$(document).ready(app);








