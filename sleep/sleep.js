/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class represents a period of sleep.
 * 
 * @property {userId} 	the unique ID of the amazon user running this application.
 * @property {sleepDateTime}	the date/time the sleep started.
 * @property {wokeUpDateTime} 	the date/time the baby woke up from sleep, or null
 * 								if the baby is still sleeping.
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
 * Represents a period of sleep
 * @constructor
 */
function Sleep (obj) {
	this.userId = undefined;
	this.sleepDateTime = undefined;
	this.wokeUpDateTime = undefined;
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
Sleep.prototype.toString = function sleepToString() {
	  var ret = "Sleep, userId: " + this.userId + 
	  	", seq: " + this.seq + 
	  	", sleepDateTime: " + this.sleepDateTime + 
	  	", wokeUpDateTime: " + this.wokeUpDateTime +
	  	", timezone: " + this.timezone;
	  return ret;
};

module.exports = Sleep;