var latte_lib = require("latte_lib")
	, Fs = require("latte_lib").fs
	, path = require("path")
	, WriteStream = Fs.WriteStream
	, events = latte_lib.events;
function File(opts) {
	events.call(this);
	this.size = 0;
	this.path = null;
	this.name = null;
	this.type = null;
	this.lastModifiedDate = null;
	this._writeStream = null;
	for(var key in opts) {
		this[key] = opts[key];
	}
};
latte_lib.inherits(File, events);
(function() {
	this._backwardsCompatibility = function() {
		var self = this;
		this.__defineGetter__("length", function() {
			return self.size;
		});
		this.__defineGetter__("filename", function() {
			return self.name;
		});
		this.__defineGetter__("mime", function() {
			return self.type;
		});
	}
	this.write = function(buffer, cb) {
		var self = this;
		this._writeStream.write(buffer, function() {
			self.lastModifiedDate = new Date();
			self.size += buffer.length;
			self.emit("progress", self.size);
			cb();
		});
	}
	this.end = function(cb) {
		var self = this;
		if (self.hash) {
			self.hash = self.hash.digest('hex');
		}
		this._writeStream.end(function() {

			self.emit("end");
			
			cb();
		});
	}
	this.open = function() {
		this._writeStream = new WriteStream(this.path);
	}
	this.rename = function(nowPath, callback) {
		var self = this;
		Fs.rename(this.path, nowPath , function(err) {
			if(err) { return callback(err); }
			self.path = nowPath;
			callback && callback(err);
		});
	}
	this.del = function(callback) {
		callback = callback || function() {};
		Fs.deleteFile(this.path, callback);
	}
}).call(File.prototype);
module.exports = File;