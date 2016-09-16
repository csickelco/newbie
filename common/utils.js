'use strict';

module.change_code = 1;
var Utils = exports;

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

Utils.calculateDuration = function(startDateTime, endDateTime) {
	console.log("calculateDuration: " + startDateTime + ", " + endDateTime); 
	var startTime = startDateTime.getTime();
	var endTime = endDateTime.getTime();
	var duration = endTime - startTime;
    return Utils.formatDuration(duration);
};

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

Utils.pluralizeIfNeeded = function(num) {
	if( num === 1 ) {
		return "";
	} else {
		return "s";
	}
}

//TODO: Not sure if this is right
module.exports = Utils;