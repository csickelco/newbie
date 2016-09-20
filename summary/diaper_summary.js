/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class represents a summary of diaper changes
 * over some period of time.
 * 
 * @property {numWetDiapers} 	the number of wet diapers changed in some time period.
 * @property {numDirtyDiapers}	the number of dirty/soiled diapers changed in some time period.
 * 
 * @author Christina Sickelco
 */

//Used to write more secure javascript. See http://www.w3schools.com/js/js_strict.asp.
'use strict';

//Alexa app server hotswap module will reload code changes to apps
//if this is set to 1. Handy for local development and testing
//See https://runkit.com/npm/alexa-app-server
module.change_code = 1;

//TODO: Make FeedSummary part of Summary object?
/**
 * Represents a summary of diaper changes made over some period of time
 * @constructor
 */
function DiaperSummary (obj) {
	this.numWetDiapers = 0;
	this.numDirtyDiapers = 0;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}

/**
 * Represents a summary of diaper changes made over some period of time
 * @constructor
 */
function DiaperSummary () {
	this.numWetDiapers = 0;
	this.numDirtyDiapers = 0;
}

/**
 * @returns {string} a string representation of this object
 */
DiaperSummary.prototype.toString = function diaperSummaryToString() {
	  var ret = "DiaperSummary-- " +
	  	  "numWetDiapers: " + this.numWetDiapers +
		  ", numDirtyDiapers: " + this.numDirtyDiapers;
	  return ret;
};

module.exports = DiaperSummary;