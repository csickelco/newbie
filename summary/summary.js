/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class represents a summary of information
 * tracked about a baby over some period of time.
 * 
 * @property {name} 			the baby's name
 * @property {age}				text describing the baby's age in months, weeks
 * @property {numWetDiapers} 	the number of wet diapers changed over the time period summarized
 * @property {numDirtyDiapers}	the number of dirty diapers changed over the time period summarized
 * @property {totalFeedAmount}	the total (sum) number of ounces fed over the time period summarized
 * @property {numFeedings}		the total (sum) number of bottle feedings over the time period summarized
 * @property {sleep}			text describing how much the baby slept over the time period summarized
 * @property {weightInOunces} 	the baby's weight, in ounces
 * @property {activities}     	a set (unique) of activities performed with the baby over the time period summarized
 * 
 * @author Christina Sickelco
 */

//Used to write more secure javascript. See http://www.w3schools.com/js/js_strict.asp.
'use strict';

//Alexa app server hotswap module will reload code changes to apps
//if this is set to 1. Handy for local development and testing
//See https://runkit.com/npm/alexa-app-server
module.change_code = 1;

/**
 * Represents a summary of a baby day-to-day over some period of time
 * @constructor
 */
function Summary (obj) {
	this.name = undefined;
	this.age = undefined;
	this.sex = undefined;
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

/**
 * Represents a summary of a baby day-to-day over some period of time
 * @constructor
 */
function Summary () {
	this.name = undefined;
	this.age = undefined;
	this.sex = undefined;
	this.numWetDiapers = 0;
	this.numDirtyDiapers = 0;
	this.totalFeedAmount = 0;
	this.numFeedings = 0;
	this.sleep = undefined;
	this.weightInOunces = 0;
	this.activities = undefined;
}

/**
 * @returns {string} a string representation of this object
 */
Summary.prototype.toString = function summaryToString() {
	  var ret = "Summary, " +
		  "name: " + this.name +
		  ", sex: " + this.sex + 
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