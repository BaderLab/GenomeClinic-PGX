(function () {

$(document).ready(function() {
	//alert("Hello world!");

	var timeoutSeconds= 5000;
	setTimeout( function() {
		var caption= $("<p><b>Button has been removed after " + timeoutSeconds + 
			" milliseconds and this text is here now!</b></p>");
		$("#press-me").before(caption);
		$("#press-me").remove();
	}, timeoutSeconds);

	$("p").on("click", function() {
		var text= "<p>Paragraph was clicked</p>";
		$("#main-div").after(text);
	});

	$("button").on("click", function() {
		var text= "<p>Button was clicked</p>";
		$("#main-div").after(text);
	});
})




})();