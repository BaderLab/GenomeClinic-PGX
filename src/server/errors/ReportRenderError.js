function ReportRenderError(message){
	Error.captureStackTrace(this,ReportRenderError);
	this.name = "ReportRenderError";
	this.message = message || "Report did not render properly";
}

ReportRenderError.prototype = Object.create(Error.prototype);

module.exports = ReportRenderError;