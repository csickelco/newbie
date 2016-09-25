/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class contains a number of frequently used helper methods
 * that validate arguments.
 * 
 * @author Christina Sickelco
 */

//Used to write more secure javascript. See http://www.w3schools.com/js/js_strict.asp.
'use strict';

//Alexa app server hotswap module will reload code changes to apps
//if this is set to 1. Handy for local development and testing
//See https://runkit.com/npm/alexa-app-server
module.change_code = 1;

var IllegalArgumentError = require('./illegal_argument_error');

var ValidationUtils = exports;

/**
 * Method to check that a particular argument is non-null and non-empty.
 * 
 * @param {string} 	argumentName the argument's name, used in the error message
 * 					if not populated. Non-nullable.
 * @param argument	the argument to check. 
 * @returns {Promise<empty>|IllegalArgumentError} If argument is populated, returns an
 * 			empty promise. Otherwise, returns a rejected promise with an
 * 			IllegalArgumentError.
 */
ValidationUtils.validateRequired = function(argumentName, argument) {
	if(!argument) {
		return Promise.reject(new IllegalArgumentError(argumentName, argumentName + " must be provided"));
	}
	return Promise.resolve();
};

module.exports = ValidationUtils;