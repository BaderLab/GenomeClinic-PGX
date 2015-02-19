/* Jquery uploader moduke and event handlers for uploading a new
 * Patient to the server, annotating then inputting it into
 * the current database. This module contains all the javascript for form
 * Validation as well as file uploading. It can handle one, or many
 * files at any given time, to be sequentially uploaded (this was done
 * due to naming issues within the databse)


 * requires: 

 * jquery.ui.widget.js
 * jquery.iframe-transport.js
 * jquery.fileupload.js

 * from the jquery-file-upload.
 * https://github.com/blueimp/jQuery-File-Upload


 *written by Patrick Magee
*/


(function(){

  //======================================================================================================
  // HELPER FUNCTIONS
  //======================================================================================================
  /* adding the endsWith functionallity to strings for cross platform compatibility
  */
  if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str){
      return this.slice(0, str.length) == str;
    };
  }

  if (typeof String.prototype.endsWith != 'function') {
    String.prototype.endsWith = function (str){
      return this.slice(-str.length) == str;
    };
  }


  //======================================================================================================
  // STATIC HANDLERS
  //======================================================================================================
  /* Static handlers that loaded only once at the beginning of the page load. These are for
   * The submit-all button as well as the cancel-all and upload button event handlers.
   */
  var staticHandlers = function(){

    //trigger the hidden file dialog button
    $("#upload-button").on("click",function(event){
      event.preventDefault();
      $("#fileselect").trigger('click');
    });

    //trigger the hidden submit buttons that the uploader is boud too
    $("#submit-all-button").on('click',function(event){
      $(document).find(".submit-button").trigger('click');
    })

    //Cancel this data transfer AND take back to add file button
    $("#cancel-all-button").on("click",function(event){
      $('.canel-button').trigger('click');
      $('#patient_information').empty().closest('fieldset').hide();
      $('#patient_vcf').empty().closest('fieldset').hide();
    });


    //Go to the status page to check current status
    $('#go-to-status').on('click',function(event){
      $("#frangipani-status-page").trigger('click');
    });
  };

  //======================================================================================================
  // DYNAMIC EVENT HANDLERS
  //======================================================================================================

  /* Dynamic event handlers. This collection of handlers must be reloaded each time  
   * new patient and file content is added to the page to ensure that the handlers are
   * active on them. Handlers for field validation as well as generic event handlers are
   * included
   */ 
  var dynamicHandlers = function(){

    //Sex switch hanlder convers between male and female and NA Dynamically changing the
    //Hidden input value
    $('.sex-switch').find('a').on('click',function(event){
      event.preventDefault();
      $(this).closest('.sex-switch').find('a').addClass('secondary')
      $(this).removeClass('secondary')
      var newSex = $(this).text();
      if (newSex === "N/A")
        newSex = "";
      $(this).closest('div').find('input').val(newSex);
    });

    //listen for keyup events on age input fields. When an event happens ensure taht there is
    //A valid number in the field. if not, convert it to ""
    $('.age').on('keyup',function(){
      if (isNaN($(this).val())){
        $(this).val("");
      } 
    });

    //Sometimes the parsing of the names may not be correct, this will modify the input in accordance with that
    $('.remove-patient').on('click',function(event){
      event.preventDefault();
      $(this).closest('.new-patients').parent().remove();
    });

    /* The Patient_id tag must be unique both within the form and within the currently existing 
     * base. This handler listens for keyup events. it then checks two things, according to an internal
     * hierarchy. first it submits an ajax request to the server asking for the names of all patients
     * it then compares the current field to all the entires in the list, flagging an error if one is found
     * additionally it is actively aware of all the entries on a page. And will flag an error when you type
     * an id that is already present on the page
     */
    $('.patient_id').on("keyup",function(){
      var self = $(this);
      var promise;
      var keyValue = self.val().toString(); //current key value
      var patientIdFields = $('.patient_id').toArray(); //get ALL patientID fields
      var valueCounts = {};

      //ajax request to server
      promise = Promise.resolve($.ajax({
        url:'database/getPatients',
        type:'GET',
        contentType:'application/json',
        dataType:'json'
      }));

      promise.then(function(result){
        var error = false;
        //search for item existing in the current list
        for (var i=0; i<result.length; i++){
          if (result[i]['patient_id'] == keyValue && !error){
            self.addClass('error').addClass('db-error').siblings('small').text("PatientID already exists!").show();
            error=true;
          }
        }

        if (!error)
          self.removeClass('error').removeClass('db-error').siblings('small').hide();

        //Search for current entry within the form
        for (var i=0; i<patientIdFields.length; i++){
          var item = patientIdFields[i].value
          valueCounts[item] = ( valueCounts[item] || 0 ) + 1;
        }
        //IF a db-error already exists on an input, this will not override it, as the db-error takes precedence.
        for (var i=0; i<patientIdFields.length; i++){
          if (valueCounts[patientIdFields[i].value] > 1){
            if(!$(document).find(patientIdFields[i]).hasClass('db-error'))
              $(document).find(patientIdFields[i]).addClass('error').addClass('form-error').siblings('small').text('PatientID already exists on form').show();
          } else {
            if (patientIdFields[i] != self[0] && $(document).find(patientIdFields[i]).hasClass('form-error') && !$(document).find(patientIdFields[i]).hasClass('db-error')){
              $(document).find(patientIdFields[i]).removeClass('error').removeClass('form-error').siblings('small').hide();
            }
          }
        }

      }).catch(function(err){console.log(err)});
    });
  };


  //======================================================================================================
  // Validate form input
  //======================================================================================================
  //Validate the input on the form and parse the form data
  //into and output object to give to the upload file handler
  //returns a promise.
  var validateForm = function(data,Id){
    var returnList = {}; //object to return.
    var promise;

    promise = new Promise(function(resolve,reject){
      //Check to see if any of the input fields have an error, stoppiong the validation if they do
      if ($(document).find('input').hasClass('error')){
        reject(new Error("Invalid Patient Id"));
      }

      //Get a list of all the patients and iterate over the list
      var patients = $(document).find('.fileNum' + Id).find('.new-patients');
      if (patients.length < 1){
        reject(new Error("Nothing to submit"))
      }
      for ( var i=0; i<patients.length; i++ ){

        var tempObj = {};
        var dataArray = $(patients[i]).find('input').serializeArray(); // serialize the input for each patient
        //iterate over the input for each patient
        for ( var j=0; j<dataArray.length; j++ ){
          //If the patient_id field is empty reject the promise and add an error tag
          if (dataArray[j]['name']==="patient_id" && dataArray[j]['value']===""){
            $(patients[i]).find('.patient_id').addClass('error').addClass('form-error').siblings('small').text('required').show();
            reject(new Error("Patient Id is Required"));
          //only include non-null values
          } else if (dataArray[j]['value']!="") {
            if (dataArray[j]['name'] == 'age'){
              //parse age to an int
              dataArray[j]['value'] = parseInt(dataArray[j]['value']);
            }
            //because the way the server parses the objects passed to it, you cannot have a 
            //recrusive array with multiple depths. Therefore each property is prepended by
            //an index for later parsing so that a flat object is created
            returnList[i.toString() + '-' + dataArray[j]['name']] = dataArray[j]['value'];
          }
        };
      }
      resolve(returnList);
    });
    return promise;
  };


  //======================================================================================================
  // UPLOADER FUNCTION
  //======================================================================================================

  /* Main uploader function that uses the jquery-file-upload plugin. This is an event listener that watches 
   * for files being added to the input fileList. this list is hidden and is readonly. 
   * When it detects that a new file was added, it is then added to an internal queue that is managed by
   * the plugin itself. Additinoally sevaeral callbacks are bound to specific events for the file:
   *
   * Add: when a file is added this event is triggered
   * progress: after a file is submitted it triggers a 'progress' event at set intervals with information
   *           on how much of the file had been uploaded
   * Fail: upon the event of a failure to upload trigger this event
   * Done: when A single upload is done, trigger this event
   * Stop: when ALL uploads are complete, trigger this event
   * 
   * When the file has succesfully completed uploading a fileInfo object is returned and the 'DONE' event is triggerd
   *
   * Currently, The upload event is bound to a hidden button, unique for each file. this is to enable selective
   * Uplaoding based on which files have active page content. In order to trigger the submission, the user hits the
   * Submit button, which sends a trigger('click') to all of the hidden submit-buttons.
   *
   * the listeners then track individual file progress as they are uploaded asynchronously and simultaneosly
   */
  var uploader = function(){
    //track the number of files
    var numberFiles = 0;

    //initialize the plugin and set up event callbacks
    $("#fileselect").fileupload({
      //default pathway for vcf upload
      url:'/upload/vcf',
      sequentialUploads: true,
      add: function(e,data){
        //empty variable for later binding of the submission event
        var jqXHR;
        var name = data.files[0].name;

        //ensure the file is in the appropriate format
        if (!(name.endsWith('.vcf'))){
          alert("Invalid File, please choose a file that ends in .vcf extension");
        } else {
          //preview the first megabyte of the file, parse patient names and dynmaically
          //determine how many potential patiennts are included in a single file.
          numberFiles++
          var Id = numberFiles 
          var reader = new FileReader();
          reader.onloadend = function(e){
            var foundSeq = false;
            var count  = 0;
            var previewData = atob(reader.result.split(',')[1]);
            var tempString,tempArray,options,patientIds,fileUploadHtml;

            previewData = previewData.split(/[\n\r]+/);
            while (!foundSeq || count < previewData.length){
              tempString = previewData[count];
              if (tempString.startsWith('#CHROM')){
                foundSeq = true;
                tempArray = previewData[count].split(/[\s]+/);
                patientIds = tempArray.slice(tempArray.indexOf('FORMAT')+1);
                options = {'patient_ids':patientIds,
                            'Id': + Id,
                            'size':(data.files[0].size/1000),
                            'file-name':name}
              }
              count++;
            }
            //if there was no field with #CHROM found then assume improperly formatted vcf
            if (count == previewData.length & !foundSeq){
              throw new Error('Input File not in proper Format');
            } else {

              //Render the html async to add it to the page
              asyncRenderHbs('frangipani-add-multi-vcf.hbs',options)
              .then(function(result){
                patientTableHtml = result;
                return asyncRenderHbs('frangipani-add-uploader-progress-bar.hbs',options);
              }).then(function(result){
                fileUploadHtml = result
                $('#patient_information').append(patientTableHtml).closest('fieldset').show();
                $('#patient_vcf').append(fileUploadHtml).closest('fieldset').show();
                dynamicHandlers();
                $('.patient_id').trigger('keyup');

              }).then(function(){

              //set contect for latter referal
                data.context = $(document).find('#fileNum' + Id);

                //add event listeners to the internal cancel
                data.context.find('.cancel-button').on('click',function(event){
                  event.preventDefault();
                  if (jqXHR) {
                    jqXHR.abort();
                    data.context.find('.progress').hide().children('span').css({'width':'0%'});
                    data.context.find('p').removeClass('working').addClass('canceled').append("&nbsp&nbsp<span class='error'><i>Upload Canceled</i></span>");

                  }
                  $(document).find('.fileNum' + Id).parent().remove();
                  $(this).closest('#fileNum' + Id).parent().remove();
                  $(document).find('.patient_id').trigger('keyup');
                  

                });

                //add event listener to the hidden submit button
                data.context.find('.submit-button').on('click',function(event){
                  event.preventDefault();
                  //validate the form and return a promise
                  var status = validateForm(data,Id);

                  status.then(function(uploadData){
                    //submit the form with the validated data for the specific file.
                    data.formData = uploadData;
                    data.context.find('p').addClass('working');
                    $(document).find('#info-fields').hide();
                    $('#upload-button').hide(200);
                    $('submit-all-button').off('click');

                    jqXHR = data.submit();

                  }).catch(function(err){
                    console.log(err)})
                });
              });
            }
          }
          reader.readAsDataURL(data.files[0].slice(0,10*1024*10));
        }
      }, 
      //update a progress bar to track the upload process
      progress: function(e,data){
        var progress = parseInt(data.loaded,10)/parseInt(data.total,10)*100;
        data.context.find('.progress').children('span').animate({width:progress + '%'},0);
      },

      //when the upload fails add an error class to the upload bar
      fail: function(e,data){
        data.context.find('.progress').hide().children("span").css({'width':'0%'});
        data.context.find('p').removeClass('working').append("&nbsp&nbsp<span class='error'><i>File failed to upload properly</i></span>");

      },

      //upon completion add checkmark and a 
      done: function(e,data){
        data.context.find('.progress').addClass('success');
        data.context.find('p').removeClass('working').append("&nbsp&nbsp<i class='fi-check size-16'><i>");
      },

      //All files have been successfully uploaded
      stop: function(e){
        $('.button-group').hide(200)
        .parents().find("#go-to-status").show(200)
        .closest(document).find('#upload-button').show(200)
        .off('click').text('Add More Files').on('click',function(event){
          event.preventDefault();
          window.location.reload();
        })
      }
    });
  }


  //======================================================================================================
  // Add event Listeners
  //======================================================================================================
  var addAllEventListeners = function(){
    staticHandlers();
    dynamicHandlers();
    uploader(); 
  }

  $(document).ready(addAllEventListeners);
})();