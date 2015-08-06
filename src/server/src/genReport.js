var phantom = require('phantom');
var Promise = require('bluebird');
var constants = require("./conf/constants.json");
var cons = Promise.promisifyAll(require('consolidate')); // Promisify consolidate
var fs = Promise.promisifyAll(require('fs'));
var Path = require('path');
/* Generate Reports based on the template provided and send the name of the report to the client 
 * once the report has been rendered for easy downloading.
 * The function takes in four mandatory fields:
 * req
 * res
 * reportName: the name to be given to a report. the date and month will be added to the report to create a unique name
 * template: the tamplate name to use for rendering
 *
 * The function uses the handlebars engine which is being run within the consolidate package in order to generate
 * html files. From three the file is passed to an instance of phantomjs to be rendered as a PDF. The rendering
 * can sometimes take a few seconds leading to noticable lag on the client side. Once the file has been rendered and 
 * saved in the temp folder, a response is sent to the client, with the reportName to retrieve from the server.
 */
module.exports = function(req,res,reportName,template,options,logger){
	var name,path,top,bottom,left,right,format,orientation;

	//Page size and margin parameter defaults
	options = options === undefined ? {}: options;
	top = options.top !== undefined ? options.top : '1cm';
	bottom = options.bottom !== undefined ? options.bottom : '1cm';
	left = options.left !== undefined ? options.left : '1cm';
	right = options.right !== undefined ? options.right : '1cm';
	format = options.format !== undefined ? options.format : "A4";
	orientation = options.orientation !== undefined ? options.format : "portrait";
	//get template dir and pass this information into the handlebars template,
	//This can be used to ensure proper inclusion of CSS and other elements for non
	//Default templates
	req.body.DIR = template.replace(/\/([^\/])*$/,"");
	//console.log(req.body.DIR);

	//Turn the process into a promise.
	var promise = Promise.resolve()
	.then(function(){

		//Get the current date
		var date = new Date();

		//the date and time are appending to the report name in order to make a unique report name, in the case of multiple files sharing the same name
		name = reportName + "_report_"+ date.getDay().toString() + "_" + date.getMonth().toString() + "_" + date.getUTCFullYear().toString() + 
		"_" + date.getTime().toString();
		path = Path.resolve(constants.nodeConstants.TMP_UPLOAD_DIR + '/' + name)
		path = path.replace(/\\/gi,'/');
		//The options from the intial request will be ussed to populate the template. Additionally add user info and date info
		var opts = req.body;
		opts.user = req.user[constants.dbConstants.USERS.ID_FIELD];
		opts.date = date.getDay().toString() + '/' + date.getMonth().toString() + '/' + date.getUTCFullYear().toString();

		//Render the Templates Asynchronously
		return cons.handlebarsAsync(template,opts);
	}).then(function(html){
		return fs.writeFileAsync(path + '.html',html) // write the html to file
	}).then(function(){
		//Create a new promise which is resolved upon successful rendering of the pdf, or reject upon error
		var promise = new Promise(function(resolve,reject){
			//create a new phantom instance and set all parameters.
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
						},
						footer: { // add a footer with the pageNumber
            				height: "1cm",
            				contents: ph.callback(function(pageNum, numPages) {
                				return "<span style='float:right'><p style='font-size:10px'>page: " + pageNum + " / " + numPages + "</p></span>";
            				})
            			}
					});
					page.set('viewportSize',{width:100,height:200});
					page.open('file:///' +  path + '.html',function(status){
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
		//Send the name of the rendered pdf file
		res.send(JSON.stringify(o));

	}).catch(function(err){
		//console.log(err.stack);
		logger('error',err,{user:req.user[constants.dbConstants.USERS.ID_FIELD],'action':'genReport','target':name});
		throw new Error(err);
	});
	return promise;
};