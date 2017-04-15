function JSONParser() {
	this.data = new Buffer("");
	this.bytesWritten = 0;
};
(function() {
	this.initWithLength = function(length) {
		this.data = new Buffer(length);
	}
	this.write = function(buffer) {
		if(this.data.length >= this.bytesWritten + buffer.length) {
			buffer.copy(this.data, this.bytesWritten);
		} else {
			this.data = Buffer.concat([this.data, buffer]);
		}
		this.bytesWritten += buffer.length;
		return buffer.length;
	}
	this.end = function() {
		try {
			var fields = JSON.parse(this.data.toString("utf8"));
			for(var field in fields) {
				this.onField(field, fields[field]);
			}
		} catch(e) {

		}
		this.data = null;
		this.onEnd();
	}
}).call(JSONParser.prototype);
module.exports = JSONParser;