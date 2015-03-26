var phantom = require('phantom');
var Promise = require('bluebird');
var constants = require("./conf/constants.json");
var cons = Promise.promisifyAll(require('consolidate'));
var fs = Promise.promisifyAll(require('fs'));

/* Generate a pdf version of the PGX report that the user can download
 * This report utilizes PhantomJS */
module.exports = function(req,res){
	var name;
	var path;
	var promise = Promise.resolve()
	.then(function(){
		var date = new Date();
		name = req.body.patientID + "_report_"+ date.getDay().toString() + "_" + date.getMonth().toString() + "_" + date.getUTCFullYear().toString() + 
		"_" + date.getTime().toString();
		path = constants.nodeConstants.SERVER_DIR + '/' + constants.nodeConstants.TMP_UPLOAD_DIR + '/' + name;
		var opts = req.body;
		opts.user = req.user[constants.dbConstants.USERS.ID_FIELD];
		opts.date = date.toDateString();
		return cons.handlebarsAsync(constants.nodeConstants.SERVER_DIR + '/views/pgx-report.hbs',opts);
	}).then(function(html){
		return fs.writeFileAsync(path + '.html',html)
	}).then(function(){
		var promise = new Promise(function(resolve,reject){
			phantom.create(function(ph){
				ph.createPage(function(page){
					page.set('paperSize',{
						format: "A4",
						orientation:'portrait',
						margin:{
							top:'2cm',
							bottom:'2cm',
							left:'1cm',
							right:'1cm'
						}
					});
					page.set('viewportSize',{width:290,height:350});
					page.open(path + '.html',function(status){
						if (status !== "success") {
							throw new Error("file did not open properly");
						} else {
							page.render(path + '.pdf',{format:'pdf',quality:'100'},function(err){
								if (err){
									throw new Error("Did not render properly");
								} else {
									resolve(ph.exit());
								}
							});
						}
					});
				});
			});
		});
		return promise;
	}).then(function(){
		o = {
			name:name + '.pdf'
		}
		res.send(JSON.stringify(o));
	}).catch(function(err){
		throw new Error(err);
	});
	return promise;
};