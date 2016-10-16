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

//Constants
var DAYS_PER_WEEK = 7; 
var MS_IN_DAY = 24*60*60*1000;

/**
 * Formats a text string describing weight in terms of pounds and ounces
 * @param	{number} a weight in ounces. Non-nullable. Must be an integer > 0.
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
 * @param birthdate {Date} the baby's birthdate. Non-nullable. Must be < current date/time.
 * @returns a string describing a baby's age. e.g. "2 weeks and 5 days"
 */
Utils.calculateAgeFromBirthdate = function(birthdate) {
	var now = new Date();
	
	var ageInYears = Utils.calculateAge(birthdate);
	var diffWeeks = Math.floor(((now.getTime() - birthdate.getTime())/MS_IN_DAY)/DAYS_PER_WEEK);
	var numDays = Math.floor((now.getTime() - birthdate.getTime())/MS_IN_DAY % DAYS_PER_WEEK);
	var retval = "";
	
	if( ageInYears > 0 ) {
		retval += parseInt(ageInYears) + " year" + Utils.pluralizeIfNeeded(ageInYears);
	}
	else if( diffWeeks > 20 ) {
		var roundedMonths = Utils.getMonthsBetween(birthdate, now, true);
		var daysAfter = Utils.getNumDaysAfterMonthsBetween(birthdate, now);
		if( daysAfter !== 0 ) {
			retval += "about ";
		}
		retval += roundedMonths + " months";
	} else {
		if( diffWeeks > 0 ) {
			retval += diffWeeks + " week" + Utils.pluralizeIfNeeded(diffWeeks);
			if( numDays > 0 ) {
				retval += " and ";
			}
		} else if( numDays === 0 ) {
			//Just born
			retval += "0 days";
		}
			
		if( numDays > 1 ) {
			retval += numDays + " days";
		} else if( numDays === 1 ) {
			retval += numDays + " day";
		}
	}
	return retval;
};

/**
 * Returns the difference, in full months, between 2 dates
 * See http://stackoverflow.com/questions/2536379/difference-in-months-between-two-dates-in-javascript/15158873#15158873
 * @param date1 {Date} the first date to compare. Non-nullable. Must be < date2.
 * @param date2 {Date} the second date to compare. Non-nullable. Must be > date1.
 * @param roundUpFractionalMonths {boolean} true/false
 * @returns {number} difference, in months, between d1 and d2
 */
Utils.getMonthsBetween = function(date1,date2,roundUpFractionalMonths)
{
    //Months will be calculated between start and end dates.
    //Make sure start date is less than end date.
    //But remember if the difference should be negative.
    var startDate=date1;
    var endDate=date2;
    var inverse=false;
    if(date1>date2)
    {
        startDate=date2;
        endDate=date1;
        inverse=true;
    }

    //Calculate the differences between the start and end dates
    var yearsDifference=endDate.getFullYear()-startDate.getFullYear();
    var monthsDifference=endDate.getMonth()-startDate.getMonth();
    var daysDifference=endDate.getDate()-startDate.getDate();

    var monthCorrection=0;
    //If roundUpFractionalMonths is true, check if an extra month needs to be added from rounding up.
    //The difference is done by ceiling (round up), e.g. 3 months and 16 day will be 4 months.
    if(roundUpFractionalMonths===true && daysDifference>15)
    {
        monthCorrection=1;
    }
    //If the day difference between the 2 months is negative, the last month is not a whole month.
    else if(roundUpFractionalMonths!==true && daysDifference<0)
    {
        monthCorrection=-1;
    }

    return (inverse?-1:1)*(yearsDifference*12+monthsDifference+monthCorrection);
};

Utils.getNumDaysAfterMonthsBetween = function(date1,date2)
{
    //Months will be calculated between start and end dates.
    //Make sure start date is less than end date.
    //But remember if the difference should be negative.
    var startDate=date1;
    var endDate=date2;
    var inverse=false;
    if(date1>date2)
    {
        startDate=date2;
        endDate=date1;
        inverse=true;
    }

    //Calculate the differences between the start and end dates
    var yearsDifference=endDate.getFullYear()-startDate.getFullYear();
    var monthsDifference=endDate.getMonth()-startDate.getMonth();
    var daysDifference=endDate.getDate()-startDate.getDate();

    return daysDifference;
};

/**
 * Formats a string representing the duration, in hours and minutes, between 2 dates
 * @param startDateTime {Date} the beginning of the date range whose duration to calculate. Non-nullable.
 * @param endDateTime {Date} the end of the date range whose duration to calculate. Non-nullable.
 * 
 * @returns a string describing the duration. e.g. "5 hours and 3 minutes"
 */
Utils.calculateDuration = function(startDateTime, endDateTime) {
	var startTime = startDateTime.getTime();
	var endTime = endDateTime.getTime();
	var duration = endTime - startTime;
    return Utils.formatDuration(duration);
};

/**
 * Calulates age in years
 * @param birthday {Date} the birthdate. Non-nullable.
 * @returns {number} age in years
 * See http://stackoverflow.com/questions/4060004/calculate-age-in-javascript
 */
Utils.calculateAge = function(birthday) { // birthday is a date
    var ageDifMs = Date.now() - birthday.getTime();
    var ageDate = new Date(ageDifMs); // miliseconds from epoch
    return Math.abs(ageDate.getUTCFullYear() - 1970);
};

/**
 * Formats a string representing the specified duration.
 * @param duration {number} duration in milliseconds to format. Non-nullable.
 * 
 * @returns a string describing the duration. e.g. "5 hours and 3 minutes"
 */
Utils.formatDuration = function(duration) {
	var days = parseInt(duration / 86400000);
    var minutes = parseInt((duration/(1000*60))%60);
    var hours = parseInt((duration/(1000*60*60))%24);
    var retval = "";

    if( days > 0 ) {
    	retval += days + " day" + Utils.pluralizeIfNeeded(days);
    	if( hours > 0 && minutes > 0 ) {
    		retval += ", ";
    	} else if( hours > 0 || minutes > 0 ) {
    		retval += " and ";
    	}
    }
    if( hours > 0 ) {
    	retval += hours + " hour" + Utils.pluralizeIfNeeded(hours);
    	if( days > 0 && minutes > 0) {
    		//"Who gives a fuck about an oxford comma"
    		retval += ",";
    	}
    	if( minutes > 0 ) {
    		retval += " and ";
    	}
    }
    
    if( minutes > 0 ) {
    	retval += minutes + " minute" + Utils.pluralizeIfNeeded(minutes);
    }
    
    if( days === 0 && hours === 0 && minutes === 0 ) {
    	retval += "0 minutes";
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
	var hours = dateTime.getHours() - 4; //EST offset TODO: Make timezone configurable
	if( hours >= 12 ) {
		am = false;
	}
	if( hours > 0 && hours > 12 ) {
		hours = hours - 12;
	} else if( hours === 0 ) {
		hours = 12;
	}
	
	var minutes = dateTime.getMinutes();
	var retval = hours;
	if( minutes === 0 ) {
		retval += " oh clock";
	}
	else if( minutes < 10 ) {
		retval += " oh " + minutes;
	} else {
		retval += " " + minutes;
	}
	
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

/**
 * Determines which prononun to use (he/she) given the baby's sex.
 * @param {String} sex The baby's sex (girl/boy). Non-nullable.
 * @param {Boolean} capitalize True if he/she should be capitalized (He/She), 
 * 					false otherwise. Nullable.
 * @returns {String} "he" if baby's sex is boy, else "girl"
 */
Utils.heShe = function(sex, capitalize) {
	if( sex === "boy" ) {
		if( capitalize ) {
			return "He";
		} else {
			return "he";
		}
	} else {
		if( capitalize ) {
			return "She";
		} else {
			return "she";
		}
	}
};

module.exports = Utils;