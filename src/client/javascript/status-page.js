
/* event handlers for updating and controlling the Frangipani
 * Status page. The page will display the current status of all
 * patients (for the moment). In the future it will only show
 * the files uploaded by the specific user
 *
 * Written by:
 * Patrick Magee
 */
var $ = require("jquery"),
	templates = require('./templates.js'),
	utility = require('./utility');


module.exports = function(){

	var arraysEqual = function(arr1, arr2) {
	    if(arr1.length !== arr2.length)
	        return false;
	    for(var i = arr1.length; i--;) {
	        if(arr1[i] !== arr2[i])
	            return false;
	    }
	    return true;
	};
	//=======================================================================
	// Refresh The Status Table and search for changes
	//=======================================================================
	/* event handler to update the status table, listening for any changes
	 * made to the connected database. The table refreshes every 5 seconds.
	 */
	var refresh = function(){
		var location = window.location.pathname;
		var timer = window.setInterval(function(){
			var promise = new Promise(function(resolve,reject){
				var patientArray;
				Promise.resolve($.ajax({
					url:'database/find',
					type:'GET',
					contentType:'application/json',
					dataType:'json',
					data:JSON.stringify({
						'collection':'patients',
						'query':{}
					})
				})).then(function(result){
					patientArray = result;
					patientNameArray = patientArray.map(function(item){return item.patient_id;});
					var currentRows =  $('#frangipani-status-row').children();
					var currentRowNames = currentRows.map(function(){
						return $(this).data('id').toString();
					}).toArray();
					var patientRowsOnPage = patientArray.map(function(item){
						return currentRowNames.indexOf(item.patient_id);
					});
					var currentRowsInPatients = currentRowNames.map(function(item){
						return patientNameArray.indexOf(item);
					}); 

					if (!arraysEqual(patientRowsOnPage,currentRowsInPatients)){
						var toAdd = [];
						if (patientRowsOnPage.indexOf(-1) != -1 ){
							
							for (var i=0; i<patientRowsOnPage.length; i++ ){
								if (patientRowsOnPage[i] == -1){
									toAdd.push(patientArray[i]);
								}
							}
						}
						if (currentRowsInPatients.indexOf(-1) != -1){
							for (var i=0; i<currentRowsInPatients.length; i++ ){
								if (currentRowsInPatients[i] == -1){
									$(currentRows[i]).remove();
								}
							}
						}	
						if (toAdd.length > 0){
							return templates.statuspage.row({patients:toAdd}).then(function(renderedHtml){
								$('#frangipani-status-row').prepend(renderedHtml);
							});
						}
					}
				}).then(function(){
					//listen for any changes made to the status of each item
					var currentRows = $("#frangipani-status-row").children();
					for (var i=0;i<patientArray.length;i++){
						if (patientArray[i].ready){
							if(!$(currentRows[i]).find('i').hasClass('fi-check'))
								$(currentRows[i]).find('.completed').text(patientArray[i].completed);
								$(currentRows[i]).find('.check').html('<i class="fi-check size-24" style="color:#66CD00;"></i>');
						} else {
							if(!$(currentRows[i]).find('i').hasClass('fa-spinner'))
								$(currentRows[i]).find('.check').html('<i class="fa fa-spinner fa-spin" style="color:#3399FF;font-size:1.5em;"></i>');
						}
					}
				}).then(function(){
					resolve('done');
				});
			});
			return promise;
		},5000);
		
		var newTimer  = window.setInterval(function(){
			var newPath =window.location.pathname.replace('#','');
			if (newPath != location){
				clearInterval(timer);
				clearInterval(this);
			}
		},1000);
		
	};

	//=======================================================================
	// Initially Populate the Table with Users and Add Handlers
	//=======================================================================
	var checkStatusHtml = function(){
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
				patientArray = {patients:result};
				return templates.statuspage.index(patientArray);
			}).then(function(renderedHtml){			
				$("#frangipani_patient_status").append(renderedHtml);
			}).then(function(){
				refresh();
			}).then(function(){
				utility.refresh();
			}).then(function(){
				resolve("done");
			});
		});
		return promise;
	};

	/* Add to the button the action of rendering this page
	 */
	//var main = function(){
	//	checkStatusHtml();
	//}
	checkStatusHtml();
	
};