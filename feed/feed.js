/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;

function Feed (obj) {
	this.userId = undefined;
	this.dateTime = undefined;
	this.feedAmount = undefined;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}


Feed.prototype.toString = function feedToString() {
	  var ret = "Feed, userId: " + this.userId + ", dateTime: " + this.dateTime + ", feedAmount: " + this.feedAmount;
	  return ret;
};

module.exports = Feed;