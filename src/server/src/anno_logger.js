/* wrapper to load an annotation specific logger since requiring this logger
 * loads a cached version if not done in this manner */
var logger = require('./logger')('annotation');
module.exports = logger;