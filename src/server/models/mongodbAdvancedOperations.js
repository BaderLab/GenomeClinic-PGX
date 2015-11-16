/**
 * Advanced operations that fully extend the basic mongoDB operations to 
 * its full extent. This Script attaches all of the defined custom models
 * to the new mongoDBAvandOperations by requiring each additional scrip
 * that is needed. This allows for greater modularity in the source code
 * @version 1.3
 * @author Patrick Mageee 
 */
var basicOperations = require("./mongodbBasicOperations");


/**
 * Object that contains the extened basicoperations object creating
 * the final db object
 * @class
 * @Constructor
 */
function mongodbAdvancedOperations (db,logger){
	basicOperations.call(this,db,logger);
}
//inherit methods of basic operation
mongodbAdvancedOperations.prototype = Object.create(basicOperations.prototype);

/* Add all the specific methods to the mongodbAdvanced operations 
 * Each script takes the mongoDBAdvancedOperations object as a parameter
 * and attaches the defined methods to the prototype of the advanced operations
 */
require('./mongodbSetup')(mongodbAdvancedOperations);
require('./mongodbGeneralOperations')(mongodbAdvancedOperations);
require('./mongodbAuthOperations')(mongodbAdvancedOperations);
require('./mongodbProjectOperations')(mongodbAdvancedOperations);
require('./mongodbPatientOperations')(mongodbAdvancedOperations);
require('./mongodbPGXOperations')(mongodbAdvancedOperations);
require('./mongodbRecOperations')(mongodbAdvancedOperations);


module.exports = mongodbAdvancedOperations;
