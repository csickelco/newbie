/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class contains a number of frequently used helper methods.
 * 
 * @author Christina Sickelco
 */

//Used to write more secure javascript. See http://www.w3schools.com/js/js_strict.asp.
'use strict';

//Alexa app server hotswap module will reload code changes to apps
//if this is set to 1. Handy for local development and testing
//See https://runkit.com/npm/alexa-app-server
module.change_code = 1;
var Utils = exports;

/**
 * Formats a text string describing weight in terms of pounds and ounces
 * @param	{number} a weight in ounces. Non-nullable.
 * @returns a text string describing the given weight in terms of pounds and
 * 			ounces. E.g. if 195 is given, returns "12 pounds, 3 ounces"
 */
Utils.getPoundsAndOuncesString = function (totalOunces) {
	var retval = "";
	var numPounds = Math.floor(totalOunces / 16);
	var numOunces = totalOunces % 16;
	retval = numPounds + " pounds";
	if( numOunces > 0 ) {
		retval += ", " + numOunces + " ounces";
	}
	return retval;
};

/**
 * Formats a date string in the yyyy-mm-dd pattern
 * @param	{Date} the date to format. Non-nullable.
 * @returns a string representing the date in the format
 * 			yyyy-mm-dd pattern
 */
Utils.formatDateString = function(date){
	var dd = date.getDate();
	var mm = date.getMonth() + 1;
	var yyyy = date.getFullYear();
	var retval;
	if(dd<10) {
		dd='0'+dd;
	}
	if(mm<10) {
		mm='0'+mm;
	}
	retval = yyyy + "-" + mm + "-" + dd;
	return retval;
};

/**
 * Formats a string describing a baby's age given their birthdate
 * @param birthdate {Date} the baby's birthdate. Non-nullable.
 * @returns a string describing a baby's age. e.g. "2 weeks and 5 days"
 */
Utils.calculateAgeFromBirthdate = function(birthdate) {
	var now = new Date();
	var oneDay = 24*60*60*1000;
	var daysPerWeek = 7; //TODO: Make constant
	//TODO: report in months, days, or years if more appropriate
	var diffWeeks = Math.floor(((now.getTime() - birthdate.getTime())/oneDay)/daysPerWeek);
	var numDays = Math.floor((now.getTime() - birthdate.getTime())/oneDay % daysPerWeek);
	var retval = "" + diffWeeks + " weeks";
	if( numDays > 1 ) {
		retval += " and " + numDays + " days";
	} else if( numDays === 1 ) {
		retval += " and " + numDays + " day";
	}
	return retval;
};

/**
 * Formats a string representing the duration, in hours and minutes, between 2 dates
 * @param startDateTime {Date} the beginning of the date range whose duration to calculate. Non-nullable.
 * @param endDateTime {Date} the end of the date range whose duration to calculate. Non-nullable.
 * 
 * @returns a string describing the duration. e.g. "5 hours and 3 minutes"
 */
Utils.calculateDuration = function(startDateTime, endDateTime) {
	console.log("calculateDuration: " + startDateTime + ", " + endDateTime); 
	var startTime = startDateTime.getTime();
	var endTime = endDateTime.getTime();
	var duration = endTime - startTime;
    return Utils.formatDuration(duration);
};

/**
 * Formats a string representing the specified duration.
 * @param duration {number} duration in milliseconds to format. Non-nullable.
 * 
 * @returns a string describing the duration. e.g. "5 hours and 3 minutes"
 */
Utils.formatDuration = function(duration) {
    var minutes = parseInt((duration/(1000*60))%60);
    var hours = parseInt((duration/(1000*60*60))%24);
    var retval = "";

    if( hours > 0 ) {
    	retval += hours + " hour";
    	if( hours > 1 ) {
    		retval += "s";
    	}
    	if( minutes > 0 ) {
    		retval += " and ";
    	}
    }
    if( minutes > 0 ) {
    	retval += minutes + " minute";
    	if( minutes > 1 ) {
    		retval += "s";
    	}
    }
    
    return retval;
};

/**
 * Formats a string representing a verbalized time
 * @param dateTime {date} the time to verbalize
 * 
 * @returns a string containing the time text to speak (e.g. "12 oh 5 PM")
 */
Utils.getTime = function(dateTime) {
	var am = true;
	var hours = dateTime.getHours() - 4; //EST ofsset TODO: Make timezone configurable
	if( hours > 12 ) {
		am = false;
		hours = hours - 12;
	}
	var minutes = dateTime.getMinutes();
	var retval = hours + " ";
	if( minutes < 10 ) {
		retval += " oh ";
	}
	retval += minutes;
	if( am ) {
		retval += " AM";
	} else {
		retval += " PM";
	}
	return retval;
};

/**
 * Determines whether to add an s onto a word describing some number of things.
 * E.g. if determining whether to say "diaper" or "diapers", pass in the number
 * of diapers.
 * 
 * @param num {number} the number of things. Non-nullable.
 * @returns "s" if num !== 1, else an empty string.
 */
Utils.pluralizeIfNeeded = function(num) {
	if( num === 1 ) {
		return "";
	} else {
		return "s";
	}
};

module.exports = Utils;