(function () {

var obj = [1,3,[[
	{"projectId":1,"refId":3,"type":"BinaryCondition","method":"equalTo","args":["chrom","chr5"]},
	{"projectId":1,"refId":3,"type":"BinaryCondition","method":"equalTo","args":["zygosity","Hetero"]},
	{"projectId":1,"refId":3,"type":"UnaryCondition","method":"isNotNull","args":["position"]}]]
	,0,10];

var runQuery= function() {
	$.ajax("http://ms1.cs.utoronto.ca:38188/medsavant-json-client/VariantManager/getVariants", {
		type: 'POST',
		data: {"json": JSON.stringify(obj)},
		dataType: "json",
		success: function(response) {
			console.log(JSON.stringify(response));
		},
		contentType: "application/json"
	});
};

var testing= {
	run: function() {
		var timeoutSeconds= 5000;
		setTimeout( function() {
			var caption= $("<p><b>Button has been removed after " + timeoutSeconds + 
				" milliseconds and this text is here now!</b></p>");
			$("#press-me").before(caption);
			$("#press-me").remove();
		}, timeoutSeconds);

		$("p").on("mouseover", function() {
			var text= "<p>Paragraph was moused-over</p>";
			$(text).appendTo($("#data-pane"));
		});

		$("button").on("click", function() {
			var text= "<p>Button was clicked</p>";
			$(this).after(text);
		});
	}
}

$(document).ready(function() {
	testing.run();
	runQuery();
})

})();