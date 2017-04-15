var latte_lib = require("latte_lib");
var latte_verify = require("latte_verify");
var JSONParser = require("./JSONParser");
var DataParser = require("./DataParser");
var def = {
	maxFields: 1000,
	maxFieldsSize: 2 * 1024 * 1024,
	keepExtensions : true,
	uploadDir: require("os").tmpdir(),
	encoding: "utf-8",
	hash: false,
	multiples: false
};
var verifyConfig = {
	type: "object",
	properties: {
		maxFields:  {
			type: "interge",
			default: def.maxFields
		},
		maxFieldsSize: {
			type: "interge",
			default: def.maxFieldsSize
		},
		keepExtensions: {
			type: "boolean",
			default: def.keepExtensions
		},
		uploadDir: {
			type: "string",
			verify: function(data) {

			},
			default: def.uploadDir
		},
		encoding: {
			type: "string",
			default: def.encoding
		},
		hash: {
			type: "boolean",
			default: def.hash
		},
		multiples: {
			type: "boolean",
			default: def.multiples
		}
	},
	default: def
};
var Post = function(config) {
	this.config = latte_verify.verify(config, verifyConfig);
	//opts = opts || {};
	this.error = null;
	this.ended = false;
	
	this.headers = null;
	this.type = null;
	this.bytesReceived = null;
	this.bytesExpected = null;
	this._parser = null;
	this._flushing = 0;
	this._fieldsSize = 0;
	this.openedFiles = [];
};
latte_lib.extends(Post, latte_lib.events);
(function() {
	
	this.pause = function(req, cb) {
		var req = this.req;
		if(!req) {
			return false;
		}
		try {
			req.pause();
		}catch(err) {
			if(!this.ended) {
				this.onError(err);
			}
			return false;
		}
		return true;
	}
	this.resume = function() {
		var req = this.req;
		if(!req) {
			return false;
		}
		try {
			req.resume();
		}catch (err) {
			if(!this.ended) {
				this.onError(err);
			}
			return false;
		}
		return true;
	}
	this.parseAsync = function(req) {
		//
	}
	this.parse = function(req, cb) {
		if(cb) {
			var fields = {}, files = {};
			this.on("field", function(name, value) {
				fields[name] = value;
			}).on("file", function(name, file) {
				if(this.config.multiples) {
					if(files[name]) {
						if(!Array.isArray(files[name])) {
							files[name] = [files[name]];
						}
						files[name].push(file);
					}else{
						files[name] = file;
					}
				}else{
					files[name] = file;
				}
			}).on("text", function(text) {
				fields._text = text;
			}).on("error", function(err) {
				cb(err, fields, files);
			}).on("end", function() {
				cb(null, fields, files);
			});
		}
		this.req = req;
		this.writeHeaders(req.headers);
		var self = this;
		req.on("error", function(err) {
			self.onError(err);
		}).on("aborted", function() {
			self.emit("aborted");
			self.onError(new Error("Request aborted"));
		}).on("data", function(buffer) {
			self.write(buffer);
		}).on("end", function() {
			if(self.error) {
				return;
			}
			var err = self._parser.end();
			if(err) {
				self.onError(err);
			}
		});
		return this;
	}
	this.writeHeaders = function(headers) {
		this.headers = headers;
		this._parseContentLength();
		this._parseContentType();
	}
	this._parseContentLength = function() {
		this.bytesReceived = 0;
		if(this.headers["content-length"]) {
			this.bytesExpected = parseInt()
		}
	}
				var getType = function(headers) {
					//multipart/form-data; boundary=----WebKitFormBoundaryojEPYRpiKY8VU1QD
					if(headers["content-type"].match(/octet-stream/i)) {
						return "octet-stream";
					}
					if(headers["content-type"].match(/urlencoded/i)) {
						return "urlencoded";
					}
					if(headers["content-type"].match(/multipart/i)) {
						return "multipart";
					}
					if(headers["content-type"].match(/json/i)) {
						return "json";
					}
					if(headers["content-type"].match(/text/i)) {
						return "text";
					}
					return "text";
				}
				function dummyParser(self) {
					return {
						end: function () {
							self.ended = true;
							self._maybeEnd();
							return null;
						}
					};
				};
			this._parseContentType = function() {
				if(this.bytesExpected === 0) {
					this._parser = dummyParser(this);
					return;
				}
				var self = this;

				switch(getType(this.headers)) {
					case "octet-stream":
						self._initOctetStream();
					break;
					case "multipart":
						var m = this.headers['content-type'].match(/boundary=(?:"([^"]+)"|([^;]+))/i);
						if (m) {
      						this._initMultipart(m[1] || m[2]);
    					} else {
      						this.onError(new Error('bad content-type header, no multipart boundary'));
    					}
					break;
					case "urlencoded":
						self._initUrlencoded();
					break;
					case "json":
						self._initJSONencoded();
					break;
					case "text":
						self._initTextencoded();
					break;
					default:
						//dummyParser(this);
						this.onError(new Error("bad content-type headers, unknown content-type: "+ this.headers["content-type"] ));
					break;
				}
			}
			this._initOctetStream = function() {
				this.type = "octet-stream";
				var filename = this.headers["x-file-name"];
				var mime = this.headers["content-type"];
				var file = new File({
					path: this._uploadPath(filename),
					name: filename,
					type: mime
				});
				this.emit("fileBegin", filename, file);
				file.open();
				this._flushing++;
				var self = this;
				self._parser = new DataParser();
				var outstandingWrites = 0;
				self._parser.on("data", function(buffer) {
					self.pause();
					outstandingWrites++;
					file.write(buffer, function() {
						outstandingWrites--;
						self.resume();
						if(self.ended) {
							self._parser.emit("doneWritingFile");
						}
					});
				});
				self._parser.on("end", function() {
					self._flushing--;
					self.ended = true;
					var done = function() {
						file.end(function() {
							self.emit("file", filename || file.path, file);
							self._maybeEnd();
						});
					}
					if(outstandingWrites === 0) {
						done();
					} else {
						self._parser.once("doneWritingFile", done);
					}
				});
			}
			this._initTextencoded = function() {
				var self = this;
				self._parser = new DataParser();
				var data = "";
				self._parser.on("data", function(buffer) {
					data += buffer;
				});
				self._parser.on("end", function() {
					self.emit("text", data);
					self.ended = true;
					self._maybeEnd();
				});
			}
			this._uploadPath = function(filename) {
				var name = "";
				for(var i = 0; i < 32; i++) {
					name += Math.floor(Math.random() * 16).toString(16);
				}
				if(this.config.keepExtensions) {
					var ext = Path.extname(filename);
					ext = ext.replace(/(\.[a-z0-9]+).*/i, "$1");
					name += ext;
				}
				return Path.join(this.config.uploadDir, name);
			}
			this._maybeEnd = function() {
				
				if(!this.ended || this._flushing || this.error) {
					return;
				}
				this.emit("end");
			}
			this._initUrlencoded = function() {
				this.type = "urlencoded";
				var parser = new QuerystringParser(this.maxFields)
					, self = this;
				parser.onField = function(key, val) {
					self.emit("field", key, val);
				};
				parser.onEnd = function() {
					self.ended = true;
					self._maybeEnd();
				}
				this._parser =parser;
			}
			this._initJSONencoded = function() {
				this.type = "json";
				var parser = new JSONParser()
					, self = this;
				if(this.bytesExpected) {
					parser.initWithLength(this.bytesExpected);
				}
				parser.onField = function(key, val) {
					self.emit("field", key, val);
				};
				parser.onEnd = function() {
					self.ended = true;
					self._maybeEnd();
				};
				this._parser = parser;
			}
			this._initMultipart = function(boundary) {
				this.type = "multipart";
				var parser = new MultipartParser()
					, self = this
					, headerField
					, headerValue
					, part;
				parser.initWithBoundary(boundary);
				parser.onPartBegin = function() {
					part = new Stream();
					part.readable = true;
					part.headers = {};
					part.name = null;
					part.filename = null;
					part.mime = null;
					part.transferEncoding = "binary";
					part.transferBuffer = "";
					headerField = "";
					headerValue = "";
				};
				parser.onHeaderField = function(b, start, end) {
					headerField += b.toString(self.encoding, start, end);
				};
				parser.onHeaderValue = function(b, start, end) {
					headerValue += b.toString(self.encoding, start, end);
				}

				parser.onHeaderEnd = function() {
					headerField = headerField.toLowerCase();
					part.headers[headerField] = headerValue;
					var m = headerValue.match(/\bname=("([^"]*)"|([^\(\)<>@,;:\\"\/\[\]\?=\{\}\s\t/]+))/i);
					if(headerField == "content-disposition") {
						if(m) {
							part.name = m[2] || m[3] || '';
						}
						part.filename = self._fileName(headerValue);
					}else if(headerField == "content-type") {
						part.mime = headerValue;
					} else if(headerField == "content-transfer-encoding") {
						part.transferEncoding = headerValue.toLowerCase();
					}

					headerField = "";
					headerValue = "";
				};
				parser.onHeadersEnd = function() {
					switch(part.transferEncoding) {
						case "binary":
						case "7bit":
						case "8bit":
							parser.onPartData = function(b, start, end) {
								part.emit("data", b.slice(start, end));
							};
							parser.onPartEnd = function() {
								part.emit("end");
							};
						break;
						case "base64":
							parser.onPartData = function(b, start, end) {
								part.transferBuffer += b.slice(start, end).toString('ascii');

						        /*
						        four bytes (chars) in base64 converts to three bytes in binary
						        encoding. So we should always work with a number of bytes that
						        can be divided by 4, it will result in a number of buytes that
						        can be divided vy 3.
						        */
						        var offset = parseInt(part.transferBuffer.length / 4, 10) * 4;
						        part.emit('data', new Buffer(part.transferBuffer.substring(0, offset), 'base64'));
						        part.transferBuffer = part.transferBuffer.substring(offset);	
							};
							parser.onPartEnd = function() {
								part.emit("data", new Buffer(part.transferBuffer, "base64"));
								part.emit("end");
							};
						break;
						default:
							return self.onError(new Error("unknown transfer-encoding"));

					}
					self.onPart(part);
				};

				parser.onEnd = function() {
					
					self.ended = true;
					self._maybeEnd();
				};
				this._parser = parser;
			}

			this.write = function(buffer) {
				if(this.error) {
					return;
				}
				if(!this._parser) {
					this.onError(new Error("uninitialized parser"));
					return;
				}
				this.bytesReceived += buffer.length;
				this.emit("progress", this.bytesReceived, this.bytesExpected);
				var bytesParsed = this._parser.write(buffer);
				if(bytesParsed !== buffer.length) {
					this.onError(new Error("parser error, " + bytesParsed + " of " + buffer.length + " bytes parsed"));
				}
				return bytesParsed;
			}
			this.handlePart = this.onPart = function(part) {
				var self = this;
				if(part.filename === undefined) {
					var value = ""
						, decoder = new StringDecoder(this.encoding);
					part.on("data", function(buffer) {
						self._fieldsSize += buffer.length;
						if(self._fieldsSize > self.maxFieldsSize) {
							self.onError(new Error("maxFieldsSize exceeded, received" + self.fieldsSize + "bytes of field data"));
							return;
						}
						value += decoder.write(buffer);
					});
					part.on("end", function() {
						self.emit("field", part.name, value);
					});
					return;
				}
				this._flushing++;
				var file = new File({
					path: this._uploadPath(part.filename),
					name: part.filename,
					type: part.mime,
					hash: self.config.hash
				});
				this.emit("fileBegin", part.name, file);
				file.open();
				this.openedFiles.push(file);
				part.on("data", function(buffer) {
					if(buffer.length == 0) {
						return;
					}
					self.pause();
					file.write(buffer, function() {
						self.resume();
					});
				});
				part.on("end" , function() {
					file.end(function() {
						self._flushing--;
						self.emit("file", part.name, file);
						self._maybeEnd();
					});
				});
			}
			this.onError = function(err) {

				if(this.error) {
					return;
				}
				this.error = err;
				this.pause();
				this.emit("error", err);
			}
			this._fileName = function(headerValue) {
				var m = headerValue.match(/\bfilename="(.*?)"($|; )/i);
				if (!m) return;

				var filename = m[1].substr(m[1].lastIndexOf('\\') + 1);
				filename = filename.replace(/%22/g, '"');
				filename = filename.replace(/&#([\d]{4});/g, function(m, code) {
					return String.fromCharCode(code);
				});
				return filename;
			};
}).call(Post.prototype);

module.exports = Post;