/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;

function Response (obj) {
	this.message = undefined;
	this.card = undefined;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}


Response.prototype.toString = function responseToString() {
	  var ret = 'Response, message: ' + this.message + ", card: " + this.card;
	  return ret;
};

module.exports = Response;