/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class handles business logic for sleep-related operations.
 * 
 * @property {SleepAWSDao} 		sleepDao 		- Interacts with the sleep data store
 * @property {BabyAWSDao} 		babyDao			- Interacts with the baby data store
 * 
 * @author Christina Sickelco
 */

//Used to write more secure javascript. See http://www.w3schools.com/js/js_strict.asp.
'use strict';

//Alexa app server hotswap module will reload code changes to apps
//if this is set to 1. Handy for local development and testing
//See https://runkit.com/npm/alexa-app-server
module.change_code = 1;

//Dependencies
var _ = require('lodash');
var SleepDao = require('./sleep_aws_dao');
var BabyDao = require('../baby/baby_aws_dao');
var Sleep = require('./sleep');
var Utils = require('../common/utils');
var ValidationUtils = require('../common/validation_utils');
var IllegalStateError = require('../common/illegal_state_error');
var ActivityLimitError = require('../common/activity_limit_error');
var Response = require('../common/response');
var Winston = require('winston');

//Configure the logger with basic logging template
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

//Constants
/**
 * The maximum number of sleep entries that can be added in any given day
 */
var ADD_LIMIT = 40;

/**
 * Represents business logic for sleep-related operations.
 * @constructor
 */
function SleepController () {
	this.sleepDao = new SleepDao();
	this.babyDao = new BabyDao();
}

/**
 * Asynchronous operation to setup any needed sleep data in the data store.
 * @returns {Promise<Empty|DaoError} Returns an epty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
SleepController.prototype.initSleepData = function() {
	logger.debug("initSleepData: Starting initialization...");
	return this.sleepDao.createTable();
};

/**
 * Asynchronous operation to record the beginning of baby's sleep
 * and return a response. 
 * 
 * @param 	userId {string}		the userId whose baby is sleeping. Non-nullable.
 * @param	dateTime {Date}		the date/time the sleep started. Non-nullable.
 * 								Must be now or a date in the past.
 * @param 	{string} baby				the name of the baby to add the sleep for. Nullable.
 * 										If not specified, the sleep is assumed to be for the most
 * 										recently added baby.
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB,
 * 			an IllegalArgumentException if userId or dateTime are invalid
 */
SleepController.prototype.startSleep = function(userId, dateTime, baby) {
	logger.debug("addSleep: Adding sleep for %s, dateTime: %s,", userId, dateTime);
	var template = _.template("Recording sleep for ${babyName}.");
	var loadedBaby;
	
	var sleep = new Sleep();
	sleep.userId = userId;
	sleep.sleepDateTime = dateTime;
	var self = this;
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			return ValidationUtils.validateRequired("sleep date and time", dateTime);
		})
		.then( function(result) {
			return ValidationUtils.validateDate("sleep date and time", dateTime);
		})
		.then( function(result) {
			return ValidationUtils.validateDateBeforeOrOn("sleep date and time", dateTime, new Date());
		})
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			if( baby ) {
				logger.debug("startSleep: Retrieving baby %s...", baby);
				return self.babyDao.readBabyByName(userId, baby);
			} else {
				return self.babyDao.readBaby(userId);
			}
		})
		.then( function(readBabyResult) {
			//Then, create the sleep in the datastore provided the baby exists
			if(readBabyResult) {
				loadedBaby = readBabyResult;
				sleep.seq = loadedBaby.seq;
				sleep.timezone = loadedBaby.timezone;
			} else {
				if(baby) {
					return Promise.reject(new IllegalStateError(
							"Before recording sleep for " + baby + ", you must first add " + baby + 
							" by saying 'tell Newbie to add baby'"));
				} else {
					return Promise.reject(new IllegalStateError("Before recording sleep, you must first add a baby"));
				}
			}
			
			//Next, check to make sure activity limits haven't been exceeded
			return self.sleepDao.getSleepCountForDay(userId, loadedBaby.seq, sleep.sleepDateTime, loadedBaby.timezone);
		})
		.then( function(sleepCountResult) {
			if( sleepCountResult + 1 > ADD_LIMIT ) {
				return Promise.reject(new ActivityLimitError("You cannot add more than " + ADD_LIMIT + 
					" sleep entries in any given day"));
			}
			return self.sleepDao.createSleep(sleep)
		})
		.then( function(result) 
		{
			//Finally, confirm the action in a response
			var babyName = loadedBaby.name;
			var responseMsg = template(
			{
				babyName: loadedBaby.name
			});
			logger.debug("startSleep: Response %s", responseMsg);
			return new Response(responseMsg, "Started sleep", responseMsg);
		});
};

/**
 * Asynchronous operation to record the end of baby's sleep
 * and return a response.
 * 
 * @param 	userId {string}		the userId whose baby is sleeping. Non-nullable.
 * @param	dateTime {Date}		the date/time the sleep ended. Non-nullable. Must
 * 								be the current date or a date in the past.
 * @param 	{string} baby				the name of the baby to end the sleep for. Nullable.
 * 										If not specified, the sleep is assumed to be for the most
 * 										recently added baby.
 * 
 * @returns {Promise<Response|DaoError/IllegalArgumentError/IllegalStateError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB,
 * 			IllegalStateError if no baby is registered or no current sleep has been recorded.
 * 			IllegalArgumentError if one of the arguments is invalid.
 */
SleepController.prototype.endSleep = function(userId, dateTime, baby) {
	logger.debug("endSleep: Ending sleep for %s, dateTime: %s,", userId, dateTime);
	var lastSleep;
	var self = this;
	var loadedBaby;
	
	return ValidationUtils.validateRequired("userId", userId)
	.then( function(result) {
		return ValidationUtils.validateRequired("wake date and time", dateTime);
	})
	.then( function(result) {
		return ValidationUtils.validateDate("wake date and time", dateTime);
	})
	.then( function(result) {
		return ValidationUtils.validateDateBeforeOrOn("wake date and time", dateTime, new Date());
	})
	.then( function(result) {
		//Next, get this user's baby (to make sure it exists and to use the
		//name in the response)
		if( baby ) {
			logger.debug("endSleep: Retrieving baby %s...", baby);
			return self.babyDao.readBabyByName(userId, baby);
		} else {
			return self.babyDao.readBaby(userId);
		}
	})
	.then( function(readBabyResult) {
		//Then, get the last sleep in the datastore provided the baby exists
		if(readBabyResult) {
			loadedBaby = readBabyResult;
		} else {
			if(baby) {
				return Promise.reject(new IllegalStateError(
						"Before recording wake for " + baby + ", you must first add " + baby + 
						" by saying 'tell Newbie to add baby'"));
			} else {
				return Promise.reject(new IllegalStateError("Before recording wake, you must first add a baby"));
			}
		}
		return self.sleepDao.getLastSleep(userId, loadedBaby.seq);
	})
	.then( function(result) 
	{
		var foundSleepRecord = false;
		//Update that sleep if it exists
		result.Items.forEach(function(item) {
            logger.debug("endSleep: lastSleep %s", item.sleepDateTime);
            lastSleep = item;
            lastSleep.userId = item.sleepKey.substring(0, item.sleepKey.indexOf("-"));
            lastSleep.seq = loadedBaby.seq;
            lastSleep.timezone = loadedBaby.timezone;
            lastSleep.sleepDateTime = new Date(lastSleep.sleepDateTime); //TODO: this is a bit kludgy. Should DAO do this?
            foundSleepRecord = true;
        });
		if(foundSleepRecord) {
			lastSleep.wokeUpDateTime = dateTime;
			return self.sleepDao.updateSleep(lastSleep);
		} else {
			return Promise.reject(new IllegalStateError("No current sleep record found for " + loadedBaby.name));
		}
	})
	.then( function(result) 
	{
		//Finally, confirm the action in a response
		var template = _.template("Recorded ${sleepAmt} of sleep from ${sleepDateTime} to ${wokeUpDateTime} for ${babyName}."); 
		var babyName = loadedBaby.name;
		var responseMsg = template(
		{
			babyName: loadedBaby.name,
			sleepAmt: Utils.calculateDuration(lastSleep.sleepDateTime, lastSleep.wokeUpDateTime),
			sleepDateTime: Utils.getTime(lastSleep.sleepDateTime, loadedBaby.timezone),
			wokeUpDateTime: Utils.getTime(lastSleep.wokeUpDateTime, loadedBaby.timezone)
		});
		logger.debug("endSleep: Response %s", responseMsg);
		return new Response(responseMsg, "End Sleep", responseMsg);
	});
};

/**
 * Asynchronous operation to determine how long baby has been awake.
 * Returns a response describing how long the baby has been awake
 * or the fact that the baby is sleeping if they are still asleep.
 * 
 * @param 	userId {string}		the userId whose baby to get awake time for. Non-nullable.
 * @param 	{string} baby				the name of the baby to get the sleep for. Nullable.
 * 										If not specified, the sleep is assumed to be for the most
 * 										recently added baby.
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB
 * 			or an IllegalArgumentError if userId is not specified.
 */
SleepController.prototype.getAwakeTime = function(userId, baby) {
	var lastSleepDate;
	var lastWakeDate;
	var response = new Response();
	var self = this;
	var loadedBaby;
	
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			if( baby ) {
				logger.debug("getAwakeTime: Retrieving baby %s...", baby);
				return self.babyDao.readBabyByName(userId, baby);
			} else {
				return self.babyDao.readBaby(userId);
			}
		})
		.then( function(readBabyResult) {
			//Then, get this user's baby's last sleep
			if(readBabyResult) {
				loadedBaby = readBabyResult;
			} else {
				if(baby) {
					return Promise.reject(new IllegalStateError(
							"Before getting awake time for " + baby + ", you must first add " + baby + 
							" by saying 'tell Newbie to add baby'"));
				} else {
					return Promise.reject(new IllegalStateError("Before getting awake time, you must first add a baby"));
				}
			}
			return self.sleepDao.getLastSleep(userId, loadedBaby.seq);
		})
	.then( function(result) 
	{
		//TODO: make a sleep object
		result.Items.forEach(function(item) {
	        logger.debug("getAwakeTime: lastSleep %s %s", item.sleepDateTime, item.wokeUpDateTime);
	        if(item.sleepDateTime) {
	        	lastSleepDate = new Date(item.sleepDateTime);
	        }
	        if(item.wokeUpDateTime) {
	        	lastWakeDate = new Date(item.wokeUpDateTime);
	        }
		});
        
        var babyName = loadedBaby.name;
		
		if(!lastSleepDate && !lastWakeDate) {
			response.message = "No sleep has been recorded for " + babyName;
		} else if(lastSleepDate && !lastWakeDate) {
			response.message = babyName + " is still sleeping";
		} else {
			var today = new Date();
			response.message = babyName + " has been awake for ";
			response.message += Utils.calculateDuration(lastWakeDate, today);
		}
		return response;
	});
};

/**
 * Asynchronous operation to remove the most recent sleep entry from the data store
 * and return a response.
 * 
 * @param 	userId {string}		the userId whose last sleep entry to remove. Non-nullable.
 * @param 	{string} baby				the name of the baby to remove the sleep for. Nullable.
 * 										If not specified, the sleep is assumed to be for the most
 * 										recently added baby.
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
SleepController.prototype.removeLastSleep = function(userId, baby) {
	logger.debug("removeLastSleep: Removing sleep for %s", userId);
	var loadedBaby;	
	var self = this;
	var lastSleepDateTime;

	//First, validate all input arguments
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			if( baby ) {
				logger.debug("removeLastSleep: Removing sleep for %s", baby);
				return self.babyDao.readBabyByName(userId, baby);
			} else {
				return self.babyDao.readBaby(userId);
			}
		})
		.then( function(readBabyResult) {
			//Then, get the most recent sleep entry from the datastore provided the baby exists
			if(readBabyResult) {
				loadedBaby = readBabyResult;
			} else {
				if(baby) {
					return Promise.reject(new IllegalStateError(
							"Before removing sleep for " + baby + ", you must first add " + baby + 
							" by saying 'tell Newbie to add baby'"));
				} else {
					return Promise.reject(new IllegalStateError("Before removing sleep, you must first add a baby"));
				}
			}
			return self.sleepDao.getLastSleep(userId, loadedBaby.seq);
		})
		.then( function(getLastSleepResult) {
			//TODO: Handle the case where there are no sleep entries
			getLastSleepResult.Items.forEach(function(item) {
	            logger.debug("getLastSleep: lastSleep %s", item.sleepDateTime);
	            lastSleepDateTime = new Date(item.sleepDateTime); //TODO: Can't the DAO do this?
	        });
			
			//Then delete that sleep
			if( lastSleepDateTime ) {
				logger.debug("Deleting sleep");
				return self.sleepDao.deleteSleep(userId, loadedBaby.seq, new Date(lastSleepDateTime), loadedBaby.timezone);
			} else {
				return Promise.resolve();
			}
		})
		.then( function(deleteSleepResult) 
		{
			logger.debug("Delete sleep result: %s", JSON.stringify(deleteSleepResult));
			//Finally, put it all together in a response
			var babyName = loadedBaby.name;
			var responseMsg;
			if( lastSleepDateTime ) {
				responseMsg = "Removed last sleep entry for " + babyName + "."; 
			} else {
				responseMsg =  "No previous sleep entries recorded for " + babyName;
			}
			logger.debug("removeSleep: Response %s", responseMsg);
			return new Response(responseMsg, "Sleep", responseMsg);
		});
};

module.exports = SleepController;