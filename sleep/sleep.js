/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;

function Sleep (obj) {
	this.userId = undefined;
	this.sleepDateTime = undefined;
	this.wokeUpDateTime = undefined;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}


Sleep.prototype.toString = function sleepToString() {
	  var ret = "Sleep, userId: " + this.userId + ", sleepDateTime: " + this.sleepDateTime + ", wokeUpDateTime: " + this.wokeUpDateTime;
	  return ret;
};

module.exports = Sleep;