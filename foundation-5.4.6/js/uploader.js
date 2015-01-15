

var buttonHandlers = function(){
  $('.gene').on("mouseup",function(){
    if ($(this).hasClass("alert")){
      $(this).removeClass("alert")
      .children("input").prop('checked',false);
    } else {
      $(this).addClass("alert")
      .children("input").prop("checked",true)
    }
  });

  $('#sex-switch').prop('checked', false);
  $('#sex-switch-value').text("Male");

  $(document).on('change','#sex-switch',function(){
    if ($(this).prop("checked")){
      $("#sex-switch-value").text("Female");
    } else {
      $("#sex-switch-value").text("Male");
    }
  })

  
  $("#select-all").on("mouseup",function(){
     $('.gene').addClass("alert")
     .children("input").prop("checked",true);
  });
  
  $("#deselect-all").on("mouseup",function(){
    $('.gene').removeClass("alert")
    .children("input").prop("checked",false);
  });
}



var uploader = function(){
  var jqXHR;

  $("#upload-button").on("click",function(){
    $("#fileselect").trigger('click');
  });


  $("#cancel-button").on("click",function(){
    if($("#file-to-upload").hasClass("working"))
      jqXHR.abort()

    $(this).closest('.button-group').toggle().parents().find('#upload-button').toggle()
    .parents().find("#upload-box").empty();

   });

  $("#fileselect").fileupload({
    url:'upload/vcf',
    add: function(e,data){
      global = data  
      
      var fileInfo = $("<p id='file-to-upload'></p>");

      fileInfo.text(data.files[0].name)
      .append('&nbsp<i>' + data.files[0].size/1000 + 'kb</i>');
      data.context = $("#upload-box").html(fileInfo);

      $('#upload-box').show();
      $('#upload-button').toggle().parents().find(".button-group").toggle();

      $("#submit-button").on('click',function(){
        $('#file-to-upload').addClass("working")
        $("#  submit-button").off('click')
        jqXHR = data.submit()

      });
    },
    progress: function(e,data){
      var progress = parseInt(data.loaded/data.total * 100,10);

        console.log(progress);

    },

    fail: function(e,data){
      console.log(e);
      data.context.addClass('error')
    }
  })
}




var main = function(){
  buttonHandlers();
  uploader()
};









$(document).ready(main)