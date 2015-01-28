/* event handlers for updating and controlling the Frangipani
 * Status page. The page will display the current status of all
 * patients (for the moment). In the future it will only show
 * the files uploaded by the specific user
 */
(function(){

	/* event handler to update the status table, listening for any changes
	 * made to the connected database. It is triggered whenever the mouse
	 * enters into the table.
	 */
	var refresh = function(){
		$('#frangipani_patient_status').closest('div').on('mouseenter',function(){
				var promise = new Promise(function(resolve,reject){
				var patientArray;
				var promise = Promise.resolve($.ajax({
					url:'database/find',
					type:'GET',
					contentType:'application/json',
					dataType:'json',
					data:JSON.stringify({
					'collection':'patients',
					'query':{}
					})
				}));


				promise.then(function(result){
					result.reverse();
					patientArray = result;
					var currentRows = $('#frangipani_patient_status').children();
					//New files have been added or removed
					if (currentRows.length != result.length){
						for (var i=0;i<patientArray.length;i++){
							if (patientArray[i]['ready']){
								patientArray[i]['icon'] = 'fi-check size-24'
								patientArray[i]['style'] = "color:#66CD00;"
							} else {
								patientArray[i]['icon'] = "fi-x size-24"	
								patientArray[i]['style'] = "color:#FF0000"
							}	
						}
						//If new file added
						if (currentRows.length < patientArray.length){

							var diff = patientArray.slice(0,result.length-currentRows.length);
							return asyncRenderHbs('frangipani-add-status-row.hbs',{patients:diff}).then(function(html){
								$('#frangipani_patient_status').prepend(html);
							});
						} else { // new file removed
							return asyncRenderHbs('frangipani-add-status-row.hbs',{patients:patientArray}).then(function(html){
								$('#frangipani_patient_status').empty().html(html);
							})
						}
					}
				}).then(function(){
					//listen for any changes made to the status of each item
					var currentRows = $("#frangipani_patient_status").children();
					for (var i=0;i<patientArray.length;i++){
						if (patientArray[i]['ready']){
							$(currentRows[i]).find('.check').html('<i class="fi-check size-24" style="color:#66CD00;"></i>');
						} else {
							$(currentRows[i]).find('.check').html('<i class="fi-x size-24" style="color:#FF0000;"></i>');
						}
					}
				}).then(function(){
					resolve('done');
				});
			});
			return promise;
		});
	}

	/* Add the html to the page, populating the table and adding event
	 * handlers
	 */
	var checkStatusHtml = function(){
		var promise = new Promise(function(resolve,reject){
			var patientArray;
			var pageTemplate;
			var rowTemplates;
			var promise = Promise.resolve($.ajax({
				url:'database/find',
				type:'GET',
				contentType:'application/json',
				dataType:'json',
				data:JSON.stringify({
					'collection':'patients',
					'query':{}
				})
			}));

			promise.then(function(result){
				for (var i=0;i<result.length;i++){
					if (result[i]['ready']){
						result[i]['ready'] = 'fi-check size-24'
						result[i]['style'] = "color:#66CD00;"
					} else {
						result[i]['ready'] = "fi-x size-24"	
						result[i]['style'] = "color:#FF0000"
					}	
				}
				patientArray = {patients:result.reverse()};
				return asyncRenderHbs('frangipani-patient-status.hbs',{});
			}).then(function(result){
				pageTemplate = result;
				return asyncRenderHbs('frangipani-add-status-row.hbs',patientArray);
			}).then(function(result){
				rowTemplates = result;
				settings.applicationMain.html(pageTemplate);
				$("#frangipani_patient_status").append(rowTemplates);
			}).then(function(){
				$(document).foundation();
				refresh();
				resolve("done");
			})
		})
		return promise;
	}

	/* Add to the button the action of rendering this page
	 */
	var main = function(){
		clickAction($('#frangipani-status-page'), checkStatusHtml)
	}

	$(document).ready(main);
})()