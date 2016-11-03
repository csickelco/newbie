/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class contains a number of frequently used helper methods
 * that validate arguments. These methods are all asynchronous
 * (return fulfilled and rejected promises vs values and throwing exceptions) 
 * as all the methods they are called from are asynchronous and this
 * style permits a consistent error handling approach.
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
var _ = require('underscore')._;

var ValidationUtils = exports;

/**
 * Checks that a particular argument is non-null and non-empty.
 * 
 * @param {string} 	argumentName the argument's name, used in the error message
 * 					if not populated. Non-nullable.
 * @param argument	the argument to check. 
 * @returns {Promise<empty>|IllegalArgumentError} If argument is populated, returns an
 * 			empty promise. Otherwise, returns a rejected promise with an
 * 			IllegalArgumentError.
 */
ValidationUtils.validateRequired = function(argumentName, argument) {
	if( _.isDate(argument) || _.isBoolean(argument) || _.isNumber(argument))
	{
		if( argument === null ) {
			return Promise.reject(new IllegalArgumentError(argumentName, "Please provide " + argumentName));
		} else {
			return Promise.resolve();
		}
	} else if(_.isEmpty(argument)) {
		return Promise.reject(new IllegalArgumentError(argumentName, "Please provide " + argumentName));
	} else {
		return Promise.resolve();
	}
};

/**
 * Checks that a particular argument is in the specified array of valid values.
 * @param {string} 	argumentName the argument's name, used in the error message
 * 					if not in set. Non-nullable.
 * @param argument	the argument to check. Nullable. 
 * @returns {Promise<empty>|IllegalArgumentError} If argument is in the array of validValues
 * 			(or is null), returns an
 * 			empty promise. Otherwise, returns a rejected promise with an
 * 			IllegalArgumentError.
 */
ValidationUtils.validateInSet = function(argumentName, argument, validValues) {
	if( argument && validValues.indexOf(argument) === -1 ) {
		return Promise.reject(new IllegalArgumentError(argumentName, argumentName + 
				" must be one these values: " + validValues.toString()));
	}
	return Promise.resolve();
};

/**
 * Checks that a particular date argument occurs before the specified date threshold.
 * @param {string} 				argumentName the argument's name, used in the error message
 * 								if invalid. Non-nullable.
 * @param argument				the argument to check. Nullable.
 * @param dateThreshold {Date} 	The date to check against. If greater than or equal
 * 								to this date, it is invalid.
 * @returns {Promise<empty>|IllegalArgumentError} If argument is before or equal to dateThreshold
 * 			(or is null), returns an
 * 			empty promise. Otherwise, returns a rejected promise with an
 * 			IllegalArgumentError. 
 */
ValidationUtils.validateDateBefore = function(argumentName, argument, dateThreshold) {
	if( argument && argument >= dateThreshold ) {
		return Promise.reject(new IllegalArgumentError(argumentName, argumentName + 
				" must occur before " + dateThreshold.toString()));
	}
	return Promise.resolve();
};

/**
 * Checks that a particular date argument occurs before or on the specified date threshold.
 * @param {string} 				argumentName the argument's name, used in the error message
 * 								if invalid. Non-nullable.
 * @param argument				the argument to check. Nullable.
 * @param dateThreshold {Date} 	The date to check against. If greater than 
 * 								to this date, it is invalid.
 * @returns {Promise<empty>|IllegalArgumentError} If argument is before dateThreshold
 * 			(or is null), returns an
 * 			empty promise. Otherwise, returns a rejected promise with an
 * 			IllegalArgumentError. 
 */
ValidationUtils.validateDateBeforeOrOn = function(argumentName, argument, dateThreshold) {
	if( argument && argument > dateThreshold ) {
		return Promise.reject(new IllegalArgumentError(argumentName, argumentName + 
				" must occur before or on " + dateThreshold.toString()));
	}
	return Promise.resolve();
};

/**
 * Checks that a particular date argument occurs after the specified date threshold.
 * @param {string} 				argumentName the argument's name, used in the error message
 * 								if invalid. Non-nullable.
 * @param argument				the argument to check. Nullable.
 * @param dateThreshold {Date} 	The date to check against. If less than this date, it is invalid.
 * @returns {Promise<empty>|IllegalArgumentError} If argument is after or on dateThreshold
 * 			(or is null), returns an
 * 			empty promise. Otherwise, returns a rejected promise with an
 * 			IllegalArgumentError. 
 */
ValidationUtils.validateDateAfter = function(argumentName, argument, dateThreshold) {
	if( argument && argument < dateThreshold ) {
		return Promise.reject(new IllegalArgumentError(argumentName, argumentName + 
				" must occur after " + dateThreshold.toString()));
	}
	return Promise.resolve();
};

/**
 * Checks that a particular argument is of type boolean.
 * @param {string} 				argumentName the argument's name, used in the error message
 * 								if invalid. Non-nullable.
 * @param argument				the argument to check. Nullable.
 * @returns {Promise<empty>|TypeError} If argument is boolean, return an empty fulfilled promise,
 * 			else return a TypeError.
 */
ValidationUtils.validateBoolean = function(argumentName, argument) {
	if( _.isBoolean(argument) )
	{
		return Promise.resolve();
	} else {
		return Promise.reject(new TypeError(argumentName + " must be true or false"));
	}
};

/**
 * Checks that a particular argument is of type Number.
 * @param {string} 				argumentName the argument's name, used in the error message
 * 								if invalid. Non-nullable.
 * @param argument				the argument to check. Nullable.
 * @returns {Promise<empty>|TypeError} If argument is a number, return an empty fulfilled promise,
 * 			else return a TypeError.
 */
ValidationUtils.validateNumber = function(argumentName, argument) {
	if( _.isNumber(argument) )
	{
		return Promise.resolve();
	} else {
		return Promise.reject(new TypeError(argumentName + " must be a number"));
	}
};

/**
 * Checks that a particular argument is of type date.
 * @param {string} 				argumentName the argument's name, used in the error message
 * 								if invalid. Non-nullable.
 * @param argument				the argument to check. Nullable.
 * @returns {Promise<empty>|TypeError} If argument is date, return an empty fulfilled promise,
 * 			else return a TypeError.
 */
ValidationUtils.validateDate = function(argumentName, argument) {
	if( _.isDate(argument) )
	{
		return Promise.resolve();
	} else {
		return Promise.reject(new TypeError(argumentName + " must be a date"));
	}
};

/**
 * Checks that a particular argument is greater than some threshold.
 * @param {string} 				argumentName the argument's name, used in the error message
 * 								if invalid. Non-nullable.
 * @param argument				the argument to check. Nullable (passes validation if not specified).
 * @param {number} greaterThanThreshold the number to compare against
 * @returns {Promise<empty>|RangeError} If argument is <= greaterThanThreshold, return an empty fulfilled promise,
 * 			else return a TypeError.
 */
ValidationUtils.validateNumberGreaterThan = function(argumentName, argument, greaterThanThreshold) {
	if( _.isUndefined(argument) || _.isNull(argument) || argument >  greaterThanThreshold)
	{
		return Promise.resolve();
	} else {
		return Promise.reject(new RangeError(argumentName + " must be greater than " + greaterThanThreshold));
	}
};

/**
 * Checks that a particular argument is greater than or equal to some threshold.
 * @param {string} 				argumentName the argument's name, used in the error message
 * 								if invalid. Non-nullable.
 * @param argument				the argument to check. Nullable (passes validation if not specified).
 * @param {number} threshold the number to compare against
 * @returns {Promise<empty>|RangeError} If argument is < greaterThanThreshold, return an empty fulfilled promise,
 * 			else return a TypeError.
 */
ValidationUtils.validateNumberGreaterThanOrEqualTo = function(argumentName, argument, threshold) {
	if( _.isUndefined(argument) || _.isNull(argument) || argument >=  threshold)
	{
		return Promise.resolve();
	} else {
		return Promise.reject(new RangeError(argumentName + " must be greater than or equal to " + threshold));
	}
};

/**
 * Checks that a particular argument is less than some threshold.
 * @param {string} 				argumentName the argument's name, used in the error message
 * 								if invalid. Non-nullable.
 * @param argument				the argument to check. Nullable (passes validation if not specified).
 * @param {number} lessThanThreshold the number to compare against
 * @returns {Promise<empty>|RangeError} If argument is < lessThanThreshold, return an empty fulfilled promise,
 * 			else return a TypeError.
 */
ValidationUtils.validateNumberLessThan = function(argumentName, argument, lessThanThreshold) {
	if( _.isUndefined(argument) || _.isNull(argument) || argument <  lessThanThreshold)
	{
		return Promise.resolve();
	} else {
		return Promise.reject(new RangeError(argumentName + " must be less than " + lessThanThreshold));
	}
};

module.exports = ValidationUtils;