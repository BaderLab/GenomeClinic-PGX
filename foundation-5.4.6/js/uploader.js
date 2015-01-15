

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
          $('#file-to-upload').addClass("working")
          $("#submit-button").off('click')
          jqXHR = data.submit()
      
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
  })
}




var main = function(){
  buttonHandlers();
  uploader()
};









$(document).ready(main)