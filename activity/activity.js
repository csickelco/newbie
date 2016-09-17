/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;

function Activity (obj) {
	this.userId = undefined;
	this.dateTime = undefined;
	this.activity = undefined;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}


Activity.prototype.toString = function activityToString() {
	  var ret = "Activity, userId: " + this.userId + ", dateTime: " + this.dateTime + ", activity: " + this.activity;
	  return ret;
};

module.exports = Activity;