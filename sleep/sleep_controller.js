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

/**
 * Represents business logic for feed-related operations.
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
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB,
 * 			an IllegalArgumentException if userId or dateTime are invalid
 */
SleepController.prototype.startSleep = function(userId, dateTime) {
	logger.debug("addSleep: Adding sleep for %s, dateTime: %s,", userId, dateTime);
	var template = _.template("Recording sleep for ${babyName}.");
	var loadedBaby;
	
	var sleep = new Sleep();
	sleep.userId = userId;
	sleep.sleepDateTime = dateTime;
	var self = this;
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			return ValidationUtils.validateRequired("dateTime", dateTime);
		})
		.then( function(result) {
			return ValidationUtils.validateDate("dateTime", dateTime);
		})
		.then( function(result) {
			return ValidationUtils.validateDateBeforeOrOn("dateTime", dateTime, new Date());
		})
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			return self.babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) {
			//Then, create the sleep in the datastore provided the baby exists
			if(readBabyResult && readBabyResult.Item && readBabyResult.Item.name) {
				loadedBaby = readBabyResult.Item;
			} else {
				return Promise.reject(new IllegalStateError("Before recording sleep, you must first add a baby"));
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
SleepController.prototype.endSleep = function(userId, dateTime) {
	logger.debug("endSleep: Ending sleep for %s, dateTime: %s,", userId, dateTime);
	var lastSleep;
	var self = this;
	var loadedBaby;
	
	return ValidationUtils.validateRequired("userId", userId)
	.then( function(result) {
		return ValidationUtils.validateRequired("dateTime", dateTime);
	})
	.then( function(result) {
		return ValidationUtils.validateDate("dateTime", dateTime);
	})
	.then( function(result) {
		return ValidationUtils.validateDateBeforeOrOn("dateTime", dateTime, new Date());
	})
	.then( function(result) {
		//Next, get this user's baby (to make sure it exists and to use the
		//name in the response)
		return self.babyDao.readBaby(userId);
	})
	.then( function(readBabyResult) {
		//Then, get the last sleep in the datastore provided the baby exists
		if(readBabyResult && readBabyResult.Item && readBabyResult.Item.name) {
			loadedBaby = readBabyResult.Item;
		} else {
			return Promise.reject(new IllegalStateError("Before recording sleep, you must first add a baby"));
		}
		return self.sleepDao.getLastSleep(userId);
	})
	.then( function(result) 
	{
		var foundSleepRecord = false;
		//Update that sleep if it exists
		result.Items.forEach(function(item) {
            logger.debug("endSleep: lastSleep %s", item.sleepDateTime);
            lastSleep = item;
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
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB
 * 			or an IllegalArgumentError if userId is not specified.
 */
SleepController.prototype.getAwakeTime = function(userId) {
	var lastSleepDate;
	var lastWakeDate;
	var response = new Response();
	var self = this;
	var loadedBaby;
	
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			return self.babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) {
			//Then, get this user's baby's last sleep
			if(readBabyResult && readBabyResult.Item && readBabyResult.Item.name) {
				loadedBaby = readBabyResult.Item;
			} else {
				return Promise.reject(new IllegalStateError("Before recording sleep, you must first add a baby"));
			}
			return self.sleepDao.getLastSleep(userId);
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

module.exports = SleepController;