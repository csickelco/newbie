/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;

function Weight (obj) {
	this.userId = undefined;
	this.date = undefined;
	this.weight = undefined;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}


Weight.prototype.toString = function weightToString() {
	  var ret = "Weight, userId: " + this.userId + ", date: " + this.date + ", weight: " + this.weight;
	  return ret;
};

module.exports = Weight;