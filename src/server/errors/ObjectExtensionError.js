function ObjectExtensionError(message){
	Error.captureStackTrace(this,ObjectExtensionError);
	this.name = "ObjectExtensionError";
	this.message = message || "Cannot Extend object";
}

ObjectExtensionError.prototype = Object.create(Error.prototype);

module.exports = ObjectExtensionError;