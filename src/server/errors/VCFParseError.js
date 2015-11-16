function VCFParseError(message){
	Error.captureStackTrace(this,VCFParseError);
	this.name = "VCFParseError";
	this.message = message || "VCF file was not properly parsed";
}

VCFParseError.prototype = Object.create(Error.prototype);

module.exports = VCFParseError;