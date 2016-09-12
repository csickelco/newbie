/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;

//TODO: Make FeedSummary part of Summary object?
function FeedSummary (obj) {
	this.totalFeedAmount = 0;
	this.numFeedings = 0;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}

function FeedSummary () {
	this.totalFeedAmount = 0;
	this.numFeedings = 0;
}


FeedSummary.prototype.toString = function feedSummaryToString() {
	  var ret = "FeedSummary-- " +
	  	  "numFeedings: " + this.numFeedings +
		  ", totalFeedAmount: " + this.totalFeedAmount;
	  return ret;
};

module.exports = FeedSummary;