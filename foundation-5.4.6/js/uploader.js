/* Jquery uploader moduke and event handlers for uploading a new
 * Patient to the server, annotating then inputting it into
 * the current database


 * requires: 

 * jquery.ui.widget.js
 * jquery.iframe-transport.js
 * jquery.fileupload.js

 * from the jquery-file-upload.
 * https://github.com/blueimp/jQuery-File-Upload


 *written by Patrick Magee
*/

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















//general form handlers
var formHandlers = function(){
  $('#sex-switch').prop('checked', false);
  $('#sex-switch-value').text("Male");

  //Sex switch hanlder convers between male and femal
  $(document).on('change','#sex-switch',function(){
    if ($(this).prop("checked")){
      $("#sex-switch-value").text("Female");
    } else {
      $("#sex-switch-value").text("Male");
    }
  });
}
  

//Check to see if the user input is currently already in
//the patient databse. If it is, add the rror class
//to the input container.
var patientIdHandler = function(){

  //Initialization check
  $('.patient_id').each(function(){
    var promise;
    var keyValue = $(this).val().toString();
    var self = $(this);

    promise = Promise.resolve($.ajax({
      url:'database/getPatients',
      type:'GET',
      contentType:'application/json',
      dataType:'json'
    }));

    promise.then(function(result){
      for (var i=0; i<result.length; i++){
        if (result[i]['patient_id'] == keyValue){
          self.addClass('error').siblings('small').text("PatientID already exists!").show();
        }
      }
    }).catch(function(err){console.log(err)});

    self.on("keyup",function(){
      var promise;
      var keyValue = self.val().toString();

      promise = Promise.resolve($.ajax({
        url:'database/getPatients',
        type:'GET',
        contentType:'application/json',
        dataType:'json'
      }));

      promise.then(function(result){
        for (var i=0; i<result.length; i++){
          if (result[i]['patient_id'] == keyValue){
            self.addClass('error').siblings('small').text("PatientID already exists!").show();
            return null;
          }
        
          self.removeClass('error').siblings('small').hide();
        }

      }).catch(function(err){console.log(err)});
    });
  });

};



//Validate the input on the form and parse the form data
//into and output object to give to the upload file handler
//returns a promise.
var validateForm = function(uploadData){
  var returnData = {};
  var returnList = [];
  var promise;

  promise = new Promise(function(resolve,reject){
    $(document).find('section.active').find('.new-patients').each(function(){
      var data=$(this).serializeArray();
     

      for (var i=0;i<data.length;i++){
        if (data[i]['name']==="patient_id" && data[i]['value']===""){
          $(this).find('.patient_id').addClass('error').siblings('small').text("Required").show();
          reject(new Error('Patient Id required'));
        } else if ($(this).find('.patient_id').hasClass('error')){
          reject(new Error("Invalid Patient Id in Use"));
        } else {
        returnData[data[i]['name']] = data[i]['value'];
        }
      }
      if (!returnData.hasOwnProperty('sex'))
        returnData['sex'] = $(this).find('.sex').text();
      if (!returnData.hasOwnProperty('age'))
        returnData['age'] = parseInt($(this).find('.age').text());

      returnList.push(returnData);
    });
    resolve(returnList);
  });

  return promise;
};



     
var multiPatientVcf = function(e,data){
  var reader = new FileReader();
  reader.onload = function(e){
    var foundSeq = false;
    var count  = 0
    var patientIds=[];
    var previewData = atob(reader.result.split(',')[1]);
    var tempString;
    var tempArray;

    previewData = previewData.split(/[\n\r]+/);
      
    while (!foundSeq || count == previewData.length){
        tempString = previewData[count];

        if (tempString.startsWith('#CHROM')){

          foundSeq = true;
          tempArray = previewData[count].split(/[\s]+/);
          tempArray = tempArray.slice(tempArray.indexOf('FORMAT')+1);

          for ( var i=0 ; i < tempArray.length; i++ ){
            patientIds.push({'patient_id':tempArray[i]});
          }

          var html = renderHbs('frangipani-add-multi-vcf.hbs',{'patient_ids':patientIds});
          $('#panel2').append(html);
          patientIdHandler();

        }

        count++;
      }

      console.log($(document).find('section.active'));
      $('#panel2').find('.new-patients').each(function(){
        $(this).find('input').serializeArray();
      }) 

      if (count == previewData.length & !foundSeq){
        throw new Error('vcf not formed correctly');
      }
      
  }

  reader.readAsDataURL(data.files[0].slice(0,10*1024*10));
}




//Main uploader function. Handles the ajax request to upload a file
//In an async manner.
var uploader = function(){
  var jqXHR;


  //Uploadt button event handler for triggering the hidden file selection
  $("#upload-button").on("click",function(){
    $("#fileselect").trigger('click');
  });


  //Cancel this data transfer AND take back to add file button
  $("#cancel-button").on("click",function(){
    if($("#file-to-upload").hasClass("working"))
      jqXHR.abort();

    if($("#panel2").hasClass('active')){
      $("#panel2").empty();
    }

    $(this).closest('.button-group').toggle().parents().find('#upload-button').toggle()
    .parents().find("#upload-box").toggle().parents().find('.progress').show();

  });


  //Upload file with handlers for addition, failure,progress and completeiong of the upload
  $("#fileselect").fileupload({
    url:'/upload/vcf',
    add: function(e,data){
      global1 = data;
      global2 = e;
      var name = data.files[0].name;  

      if (!(name.endsWith('.vcf'))){
        alert("Invalid File, please choose a file that ends in .vcf extension");
      } else {
        if (name.length > 20){
            name = "..." + name.substr(-20);
        }

        $('#file-to-upload').text(name)
        .append('&nbsp<i>' + data.files[0].size/1000 + 'kb</i>');
        data.context = $("#upload-box");

        $('.progress').removeClass('success').children("#upload-progress").css({'width':'0%'});
        $('#upload-box').show().children('.progress').find('#upload');
        $('#upload-button').toggle().parents().find(".button-group").toggle();

        
        if ($('#panel2').hasClass('active')){
          multiPatientVcf(e,data);
        }

        //if ($('#panel3').hasClass('active'){
          //addMultiPatients(e,data);
        //}
        

        //Submit the file for uploading
        $("#submit-button").on('click',function(){
          var status = validateForm(data);
          status.then(function(uploadData){
            data.formData = uploadData;
            $('#file-to-upload').addClass("working");
            $("#submit-button").off('click');
            jqXHR = data.submit();

            return jqXHR;
          }).catch(function(err){
            console.log(err);
          });
        });
      }
    }, 
    //update a progress bar to track the upload process
    progress: function(e,data){
      var progress = parseInt(data.loaded,10)/parseInt(data.total,10)*100;
      $('#upload-progress').animate({width:progress + '%'},0);
    },

    //when the upload fails add an error class to the upload bar
    fail: function(e,data){
      $('.progress').hide().children("#upload-progress").css({'width':'0%'});
      $('#file-to-upload').removeClass('working').append("&nbsp&nbsp<span class='error'><i>File failed to upload properly</i></span>");

    },

    //upon completion add checkmark and a 
    done: function(e,data){
      $('.progress').addClass('success');
      $('#file-to-upload').removeClass('working').append("&nbsp&nbsp<i class='fi-check size-16'><i>");
    }
  });
}


//Render the page htmnl and display it adding handlers at the same time
var addPatientHtml = function(){
  var promise = new Promise(function(resolve,reject){
    var html= renderHbs('frangipani-add-new-patient.hbs');
    settings.applicationMain.html(html);
    $(document).foundation(); //have to call this to enable the slider
    formHandlers();
    patientIdHandler();
    uploader();
    resolve();
  });
  return promise;
}

var addAllEventListeners = function(){
  clickAction($('#frangipani-add-new-patient'), addPatientHtml); 
}

$(document).ready(addAllEventListeners);