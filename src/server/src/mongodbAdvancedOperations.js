//var dbConstants = require("../conf/constants.json").dbConstants;
//var nodeConstants = require('../conf/constants.json').nodeConstants;
var basicOperations = require("./mongodbBasicOperations");


function mongodbAdvancedOperations (db,logger){
	basicOperations.call(this,db,logger);
}
//inherit methods of basic operation
mongodbAdvancedOperations.prototype = Object.create(basicOperations.prototype);

/* Add all the specific methods to the mongodbAdvanced operations */
require('./mongodbSetup')(mongodbAdvancedOperations);
require('./mongodbGeneralOperations')(mongodbAdvancedOperations);
require('./mongodbAuthOperations')(mongodbAdvancedOperations);
require('./mongodbProjectOperations')(mongodbAdvancedOperations);
require('./mongodbPatientOperations')(mongodbAdvancedOperations);
require('./mongodbPGXOperations')(mongodbAdvancedOperations);
require('./mongodbRecOperations')(mongodbAdvancedOperations);


module.exports = mongodbAdvancedOperations;
