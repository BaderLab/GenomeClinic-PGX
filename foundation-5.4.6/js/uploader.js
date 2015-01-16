

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};




var formHandlers = function(){
  $('#sex-switch').prop('checked', false);
  $('#sex-switch-value').text("Male");

  $(document).on('change','#sex-switch',function(){
    if ($(this).prop("checked")){
      $("#sex-switch-value").text("Female");
    } else {
      $("#sex-switch-value").text("Male");
    }
  });

  $('#patientID').on("keyup",function(){
    var promise;
    var keyValue = $(this).val().toString();
    var self = $(this)
    promise = Promise.resolve($.ajax({
      url:'database/getPatients',
      type:'GET',
      contentType:'application/json',
      dataType:'json'
    }));
    promise.then(function(result){
      for (var i=0; i<result.length; i++){
        if (result[i]['patient_id'] == keyValue){
          self.addClass('error').parents().find("small").text("PatientID already exists!").show();
          return null;
        }
      
        self.removeClass('error').parents().find('small').hide();
      }

    }).catch(function(err){console.log(err)});
  });
};




var validateAndSendForm = function(){
  var promise;
  var data = {};
  var dataTmp = $('#jquery-new-patient-form').serializeArray();
  for (var i = 0; i< dataTmp.length;i++){
    data[dataTmp[i]['name']] = dataTmp[i]['value'];
  }
  data['sex'] = $('#sex-switch-value').text().toLowerCase();
  if (data['patientID']==""){
    $('#patientID').addClass('error').parents().find("small").text("Required").show()
    return undefined;
  }

  promise = Promise.resolve($.ajax({
    url:'database/addPatients',
    type:'POST',
    contentType:'application/json',
    dataType:'json',
    data:data
  }))

  return promise.then(function(result){
    return result

  }).catch(function(err){
    console.log(err);
  })
}



var uploader = function(){
  var jqXHR;
  var patientTableName;

  $("#upload-button").on("click",function(){
    $("#fileselect").trigger('click');
  });


  $("#cancel-button").on("click",function(){
    if($("#file-to-upload").hasClass("working"))
      jqXHR.abort()

    $(this).closest('.button-group').toggle().parents().find('#upload-button').toggle()
    .parents().find("#upload-box").toggle().parents().find('.progress').show();

  });

  $("#fileselect").fileupload({
    url:'/upload/vcf',
    add: function(e,data){

      var name = data.files[0].name;  

      if (!(name.endsWith('.vcf'))){
        alert("Invalid File, please choose a file that ends in .vcf extension");
      } else {
        if (name.length > 20){
            name = "..." + name.substr(-20)
         } 

        $('#file-to-upload').text(name)
        .append('&nbsp<i>' + data.files[0].size/1000 + 'kb</i>');
        data.context = $("#upload-box")

        $('#upload-box').show();
        $('#upload-button').toggle().parents().find(".button-group").toggle();

        $("#submit-button").on('click',function(){
          var status = validateAndSendForm()
          if (status){
            $('#file-to-upload').addClass("working")
            $("#submit-button").off('click')
            jqXHR = data.submit()
          }
      
        });
      }
    }, 

    progress: function(e,data){
      var progress = parseInt(data.loaded,10)/parseInt(data.total,10)*100
      $('#upload-progress').animate({width:progress + '%'},0);
    },

    fail: function(e,data){
      $('.progress').hide().children("#upload-progress").css({'width':'0%'});
      $('#file-to-upload').removeClass('working').append("&nbsp&nbsp<span class='error'><i>File failed to upload properly</i></span>");

    },

    done: function(e,data){
      $('.progress').addClass('success');
      $('#file-to-upload').removeClass('working').append("&nbsp&nbsp<i class='fi-check size-16'><i>");
    }
  });
}




var main = function(){
  formHandlers();
  uploader()
};









$(document).ready(main)