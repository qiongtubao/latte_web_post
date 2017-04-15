var Querystring = require("querystring");
function QuerystringParser() {
	this.buffer = "";
};
(function() {
	this.write = function(buffer) {
		this.buffer += buffer.toString("ascii");
		return buffer.length;
	}
	this.end = function() {
		var fields = Querystring.parse(this.buffer);
		for(var field in fields) {
			this.onField(field, fields[field]);
		}
		this.buffer = "";
		this.onEnd();
	}
}).call(QuerystringParser.prototype);
module.exports = QuerystringParser;