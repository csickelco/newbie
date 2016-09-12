/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;

function Summary (obj) {
	this.name = undefined;
	this.age = undefined;
	this.numWetDiapers = 0;
	this.numDirtyDiapers = 0;
	this.totalFeedAmount = 0;
	this.numFeedings = 0;
	this.sleep = "";
	this.weightInOunces = 0;
	this.activities = undefined;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}

function Summary () {
	this.name = undefined;
	this.age = undefined;
	this.numWetDiapers = 0;
	this.numDirtyDiapers = 0;
	this.totalFeedAmount = 0;
	this.numFeedings = 0;
	this.sleep = undefined;
	this.weightInOunces = 0;
	this.activities = undefined;
}


Summary.prototype.toString = function summaryToString() {
	  var ret = "Summary, " +
		  "name: " + this.name + 
		  ", ageInDays: " + this.ageInDays +
		  ", numWetDiapers: " + this.numWetDiapers + 
		  ", numDirtyDiapers: " + this.numDirtyDiapers +
		  ", totalFeedAmount: " + this.totalFeedAmount + 
		  ", numFeedings: " + this.numFeedings +
		  ", sleep: " + this.sleep +
		  ", weightInOunces: " + this.weightInOunces +
		  ", activities: " + this.activities;
	  return ret;
};

module.exports = Summary;