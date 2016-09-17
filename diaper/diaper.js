/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;

function Diaper (obj) {
	this.userId = undefined;
	this.dateTime = undefined;
	this.isWet = undefined;
	this.isDirty = undefined;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}


Diaper.prototype.toString = function diaperToString() {
	  var ret = "Diaper, userId: " + this.userId + ", dateTime: " + this.dateTime + ", isWet: " + this.Wet + ", isDirty: " + this.isDirty;
	  return ret;
};

module.exports = Diaper;