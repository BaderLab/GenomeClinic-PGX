/**
 * User Authentication Errors
 */
function MissingParameterError(message){
	Error.captureStackTrace(this, MissingParameterError);
	this.name = "MissingParameterError";
	this.message = message || "EMissing required parameter for function";	
}

MissingParameterError.prototype = Object.create(Error.prototype);
module.exports = MissingParameterError;	