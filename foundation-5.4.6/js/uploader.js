

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
  $("#upload-button").on("click",function(){
    $("#fileselect").trigger('click');
  });
}




var main = function(){
  buttonHandlers();
  uploader()
};









$(document).ready(main)