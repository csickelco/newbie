/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class represents a record of a baby's weight.
 * 
 * @property {userId} 	the unique ID of the amazon user running this application.
 * @property {date}		the date the weight measurement was taken
 * @property {weight} 	the baby's weight in ounces. An integer.
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
 * Represents a record of a baby's weight
 * @constructor
 */
function Weight (obj) {
	this.userId = undefined;
	this.date = undefined;
	this.weight = undefined;
	this.seq = undefined;
	this.timezone = undefined;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}

/**
 * @returns {string} a string representation of this object
 */
Weight.prototype.toString = function weightToString() {
	  var ret = "Weight, userId: " + this.userId + 
	  	", seq: " + this.seq + 
	  	", date: " + this.date + 
	  	", weight: " + this.weight +
	  	", timezone: " + this.timezone;
	  return ret;
};

module.exports = Weight;