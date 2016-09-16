/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;
var _ = require('lodash');
//var SleepDao = require('./sleep_dao');
var SleepDao = require('./sleep_aws_dao');
var BabyDao = require('../baby/baby_aws_dao');
var Sleep = require('./sleep');
var Utils = require('../common/utils');
var Response = require('../common/response');
var Winston = require('winston');

var sleepDao = new SleepDao();
var babyDao = new BabyDao();
var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Sleep_Controller - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

function SleepController () {
}

SleepController.prototype.initSleepData = function() {
	logger.info("initSleepData: Starting initialization...");
	return sleepDao.createTable();
};

//TODO: lots of error checking - what if they start a sleep without ending a previous one? indeterminate nap?
SleepController.prototype.startSleep = function(userId, dateTime) {
	//TODO: When productionizing, eliminate log stmt due to privacy concerns
	//TODO: Provide option to use different units
	logger.info("addSleep: Adding sleep for %s, dateTime: %s,", userId, dateTime);
	var template = _.template("Recording sleep for ${babyName}.");
	var loadedBaby;
	
	var sleep = new Sleep();
	sleep.userId = userId;
	sleep.sleepDateTime = dateTime;
	
	return sleepDao.createSleep(sleep)
		.then( function(result) {
			return babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) 
		{
			loadedBaby = readBabyResult === undefined ? {} : JSON.parse(readBabyResult.Item.data);	
			var babyName = loadedBaby.name;
			var responseMsg = template(
			{
				babyName: loadedBaby.name
			});
			logger.info("startSleep: Response %s", responseMsg);
			return responseMsg;
		});
};

SleepController.prototype.endSleep = function(userId, dateTime) {
	//TODO: When productionizing, eliminate log stmt due to privacy concerns
	//TODO: Provide option to use different units
	logger.info("endSleep: Ending sleep for %s, dateTime: %s,", userId, dateTime);

	var lastSleep;
	return sleepDao.getLastSleep(userId)
		.then( function(getLastSleepResult) {
			getLastSleepResult.Items.forEach(function(item) {
	            logger.info("endSleep: lastSleep %s", item.sleepDateTime);
	            lastSleep = item;
	            lastSleep.sleepDateTime = new Date(lastSleep.sleepDateTime); //TODO: this is a bit kludgy. Should DAO do this?
	        });
			lastSleep.wokeUpDateTime = dateTime;
			return sleepDao.updateSleep(lastSleep);
		})
		.then( function(updateSleepResult) {
			return babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) 
		{
			var template = _.template("Recorded ${sleepAmt} of sleep from ${sleepDateTime} to ${wokeUpDateTime} for ${babyName}."); 

			var loadedBaby = readBabyResult === undefined ? {} : JSON.parse(readBabyResult.Item.data);	
			var babyName = loadedBaby.name;
			var responseMsg = template(
			{
				babyName: loadedBaby.name,
				sleepAmt: Utils.calculateDuration(lastSleep.sleepDateTime, lastSleep.wokeUpDateTime),
				sleepDateTime: Utils.getTime(lastSleep.sleepDateTime),
				wokeUpDateTime: Utils.getTime(lastSleep.wokeUpDateTime)
			});
			logger.info("startSleep: Response %s", responseMsg);
			return responseMsg;
		});
};

SleepController.prototype.getAwakeTime = function(userId) {
	var lastSleepDate;
	var lastWakeDate;
	var response = new Response();

	return sleepDao.getLastSleep(userId)
		.then( function(result) {
			//TODO: make a sleep object
			result.Items.forEach(function(item) {
	            logger.info("getAwakeTime: lastSleep %s %s", item.sleepDateTime, item.wokeUpDateTime);
	            if(item.sleepDateTime) {
	            	lastSleepDate = new Date(item.sleepDateTime);
	            }
	            if(item.wokeUpDateTime) {
	            	lastWakeDate = new Date(item.wokeUpDateTime);
	            }
	        });
			return babyDao.readBaby(userId);
		}).then( function(readBabyResult) {
			var loadedBaby = readBabyResult === undefined ? {} : JSON.parse(readBabyResult.Item.data);	
			var babyName = loadedBaby.name;
			
			if(!lastSleepDate && !lastWakeDate) {
				response.message = "No sleep has been recorded for " + babyName;
			} else if(lastSleepDate && !lastWakeDate) {
				response.message = babyName + " is still sleeping";
			} else {
				var today = new Date();
				var diffMs = (today - lastWakeDate); 
				logger.info("getLastSleep: diffMs %d", diffMs);
				//TODO: Move this to a utility method
				var diffDays = Math.round(diffMs / 86400000); // days
				var diffHrs = Math.round((diffMs % 86400000) / 3600000); // hours
				var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes
				response.message = babyName + " has been awake for ";
				if( diffDays > 0 ) {
					response.message += diffDays + " days ";
				}
				if( diffHrs > 0 ) {
					response.message += diffHrs + " hours and ";
				}
				if( diffMins > 0 ) {
					response.message += diffMins + " minutes ";
				}
			}
			return response;
		});
};

module.exports = SleepController;