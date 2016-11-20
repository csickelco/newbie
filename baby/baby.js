/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class represents a baby that the Newbie app tracks.
 * 
 * @property {userId} 	the unique ID of the amazon user running this application.
 * @property {sex}		the baby's sex (boy/girl)
 * @property {name} 	the baby's name
 * @property {birthdate} the baby's birthdate (as a date object)
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
 * Represents a baby record
 * @constructor
 */
function Baby (obj) {
	this.userId = undefined;
	this.sex = undefined;
	this.name = undefined;
	this.birthdate = undefined;
	this.timezone = undefined;
	this.addedDateTime = undefined;
	this.seq = undefined;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}

/**
 * @returns {string} a string representation of this object
 */
Baby.prototype.toString = function babyToString() {
	  var ret = 'Baby, userId: ' + this.userId + 
	  	', sex: ' + this.sex + 
	  	", name: " + this.name + 
	  	", birthdate: " + this.birthdate + 
	  	", timezone: " + this.timezone + 
	  	", addedDateTime: " + this.addedDateTime + 
	  	", seq: " + this.seq
	  return ret;
};

module.exports = Baby;