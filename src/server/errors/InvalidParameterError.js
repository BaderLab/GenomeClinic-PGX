/**
 * Generic error for handling invalid Parameters
 */
function InvalidParameterError(message){
	Error.captureStackTrace(this,InvalidParameterError);
	this.name = "InvalidParameterError";
	this.message = message || "Invalid parameter";
}

InvalidParameterError.prototype = Object.create(Error.prototype);

module.exports = InvalidParameterError;