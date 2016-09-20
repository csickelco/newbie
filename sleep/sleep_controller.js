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
var Response = require('../common/response');
var Winston = require('winston');

//Properties
var sleepDao = new SleepDao();
var babyDao = new BabyDao();

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
}

/**
 * Asynchronous operation to setup any needed sleep data in the data store.
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws {ResourceInUseException} The operation conflicts with the resource's availability. 
 */
SleepController.prototype.initSleepData = function() {
	logger.debug("initSleepData: Starting initialization...");
	return sleepDao.createTable();
};

/**
 * Asynchronous operation to record the beginning of baby's sleep
 * and return a response.
 * 
 * @param 	userId		the userId whose baby is sleeping. Non-nullable.
 * @param	dateTime	the date/time the sleep started. Non-nullable.
 * 
 * @return 	promise containing a Response, with both a verbal message and written card,
 *  		describing whether or not the sleep was successfully recorded.
 * 
 * @throws 	{InternalServerError} An error occurred on the server side.
 * @throws 	{LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws 	{ResourceInUseException} The operation conflicts with the resource's availability. 
 * @throws 	{ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
//TODO: lots of error checking - what if they start a sleep without ending a previous one? indeterminate nap?
SleepController.prototype.startSleep = function(userId, dateTime) {
	logger.debug("addSleep: Adding sleep for %s, dateTime: %s,", userId, dateTime);
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
			loadedBaby = readBabyResult.Item;	
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
 * @param 	userId		the userId whose baby is sleeping. Non-nullable.
 * @param	dateTime	the date/time the sleep ended. Non-nullable.
 * 
 * @return 	promise containing a Response, with both a verbal message and written card,
 *  		describing whether or not the sleep was successfully ended.
 * 
 * @throws 	{InternalServerError} An error occurred on the server side.
 * @throws 	{LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws 	{ResourceInUseException} The operation conflicts with the resource's availability. 
 * @throws 	{ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
SleepController.prototype.endSleep = function(userId, dateTime) {
	logger.debug("endSleep: Ending sleep for %s, dateTime: %s,", userId, dateTime);
	var lastSleep;
	return sleepDao.getLastSleep(userId)
		.then( function(getLastSleepResult) {
			getLastSleepResult.Items.forEach(function(item) {
	            logger.debug("endSleep: lastSleep %s", item.sleepDateTime);
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

			var loadedBaby = readBabyResult.Item;	
			var babyName = loadedBaby.name;
			var responseMsg = template(
			{
				babyName: loadedBaby.name,
				sleepAmt: Utils.calculateDuration(lastSleep.sleepDateTime, lastSleep.wokeUpDateTime),
				sleepDateTime: Utils.getTime(lastSleep.sleepDateTime),
				wokeUpDateTime: Utils.getTime(lastSleep.wokeUpDateTime)
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
 * @param 	userId		the userId whose baby to get awake time for. Non-nullable.
 * 
 * @return 	promise containing a Response, with both a verbal message and written card,
 *  		describing how long the baby has been awake or the fact that they are 
 *  		still sleeping.
 * 
 * @throws 	{InternalServerError} An error occurred on the server side.
 * @throws 	{LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws 	{ResourceInUseException} The operation conflicts with the resource's availability. 
 * @throws 	{ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
SleepController.prototype.getAwakeTime = function(userId) {
	var lastSleepDate;
	var lastWakeDate;
	var response = new Response();

	return sleepDao.getLastSleep(userId)
		.then( function(result) {
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
			return babyDao.readBaby(userId);
		}).then( function(readBabyResult) {
			var loadedBaby = readBabyResult.Item;	
			var babyName = loadedBaby.name;
			
			if(!lastSleepDate && !lastWakeDate) {
				response.message = "No sleep has been recorded for " + babyName;
			} else if(lastSleepDate && !lastWakeDate) {
				response.message = babyName + " is still sleeping";
			} else {
				var today = new Date();
				var diffMs = (today - lastWakeDate); 
				logger.debug("getLastSleep: diffMs %d", diffMs);
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