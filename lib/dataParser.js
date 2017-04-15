var latte_lib = require("latte_lib")
	, events = latte_lib.events;
function DataParser(options) {

};
latte_lib.extends(DataParser, events);
(function() {
	this.write = function(buffer) {
		this.emit("data", buffer);
		return buffer.length;
	}
	this.end = function() {
		this.emit("end");
	}
}).call(DataParser.prototype);

module.exports = DataParser;