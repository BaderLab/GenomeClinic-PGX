var phantom = require('phantom');
var Promise = require('bluebird');
var constants = require("./conf/constants.json");
var cons = Promise.promisifyAll(require('consolidate'));
var fs = Promise.promisifyAll(require('fs'));

module.exports = function(req,res,reportName,template,options){
	var name,path,top,bottom,left,right,format,orientation;
	options = options === undefined ? {}: options;
	top = options.top !== undefined ? options.top : '1cm';
	bottom = options.bottom !== undefined ? options.bottom : '1cm';
	left = options.left !== undefined ? options.left : '1cm';
	right = options.right !== undefined ? options.right : '1cm';
	format = options.format !== undefined ? options.format : "A4";
	orientation = options.orientation !== undefined ? options.format : "portrait";

	
	var promise = Promise.resolve()
	.then(function(){
		var date = new Date();
		name = reportName + "_report_"+ date.getDay().toString() + "_" + date.getMonth().toString() + "_" + date.getUTCFullYear().toString() + 
		"_" + date.getTime().toString();
		path = constants.nodeConstants.SERVER_DIR + '/' + constants.nodeConstants.TMP_UPLOAD_DIR + '/' + name;
		var opts = req.body;
		opts.user = req.user[constants.dbConstants.USERS.ID_FIELD];
		opts.date = date.getDay().toString() + '/' + date.getMonth().toString() + '/' + date.getUTCFullYear().toString();
		return cons.handlebarsAsync(template,opts);
	}).then(function(html){
		return fs.writeFileAsync(path + '.html',html)
	}).then(function(){
		var promise = new Promise(function(resolve,reject){
			phantom.create(function(ph){
				ph.createPage(function(page){
					page.set('paperSize',{
						format: format,
						orientation:orientation,
						margin:{
							top:top,
							bottom:bottom,
							left:left,
							right:right
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