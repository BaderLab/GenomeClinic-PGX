var page = require('webpage').create();
var fs = require('fs');

page.paperSize = {
	format: "A4",
	orientation:'portrait',
	margin:'1cm'
};

page.viewportSize ={width:290, height:350};

page.open('./test.html',function(status){
	if (status!=='success'){
		console.log(status);
	} else {
		page.render('test.pdf',{format:'pdf',quality:'100'});
		phantom.exit();
	}
});

/*
page.viewportSize = { width: 1920, height: 1080 };
page.open("http://www.google.com", function start(status) {
  page.render('google_home.pdf', {format: 'pdf', quality: '100'});
  phantom.exit();
});
*/