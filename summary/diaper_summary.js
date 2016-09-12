/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;

//TODO: Make FeedSummary part of Summary object?
function DiaperSummary (obj) {
	this.numWetDiapers = 0;
	this.numDirtyDiapers = 0;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}

function DiaperSummary () {
	this.numWetDiapers = 0;
	this.numDirtyDiapers = 0;
}


DiaperSummary.prototype.toString = function diaperSummaryToString() {
	  var ret = "DiaperSummary-- " +
	  	  "numWetDiapers: " + this.numWetDiapers +
		  ", numDirtyDiapers: " + this.numDirtyDiapers;
	  return ret;
};

module.exports = DiaperSummary;