/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;

function Response (obj) {
	this.message = undefined;
	this.cardBody = undefined;
	this.cardTitle = undefined;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}

function Response(message, cardTitlePrefix, cardBody) {
	this.message = message;
	this.setCard(cardTitlePrefix, cardBody);
}

Response.prototype.setCard = function(cardTitlePrefix, cardBody) {
	this.cardTitle = cardTitlePrefix + " - " + new Date().toLocaleDateString("en-US");
	this.cardBody = cardBody;
};

Response.prototype.toString = function responseToString() {
	  var ret = 'Response, message: ' + this.message + ",cardTitle: " + this.cardTitle + ", cardBody: " + this.cardBody;
	  return ret;
};

module.exports = Response;