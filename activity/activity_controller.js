/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class handles business logic for activity-related operations.
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
var ActivityDao = require('./activity_aws_dao');
var BabyDao = require('../baby/baby_aws_dao');
var Activity = require('./activity');
var Response = require('../common/response');
var Winston = require('winston');

//Properties
var activityDao = new ActivityDao();
var babyDao = new BabyDao();

//Configure the logger with basic logging template
var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Activity_Controller - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

/**
 * Represents business logic for activity-related operations.
 * @constructor
 */
function ActivityController () {
}

/**
 * Asynchronous operation to setup any needed activity data in the data store.
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws {ResourceInUseException} The operation conflicts with the resource's availability. 
 */
ActivityController.prototype.initActivityData = function() {
	logger.debug("initActivityData: Starting initialization...");
	return activityDao.createTable();
};

/**
 * Asynchronous operation to add (or overwrite) a new activity to the data store
 * and return a response.
 * 
 * @param 	userId		the userId who owns the activities. Non-nullable.
 * @param	dateTime	the date/time the activity occurred. Non-nullable.
 * @param	activity	text describing the activity (e.g. "visiting grandma"). Non-nullable
 * 
 * @return 	promise containing a Response, with both a verbal message and written card,
 *  		describing whether or not the activity was successfully added.
 * 
 * @throws 	{InternalServerError} An error occurred on the server side.
 * @throws 	{LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws 	{ResourceInUseException} The operation conflicts with the resource's availability. 
 * @throws 	{ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
ActivityController.prototype.addActivity = function(userId, dateTime, activity) {
	logger.debug("addActivity: Adding activity for %s, date: %s, activity: %s", userId, dateTime, activity);
	var template = _.template("Added activity ${activity} for ${babyName}");
	var loadedBaby;
	var activityObj = new Activity();
	activityObj.userId = userId;
	activityObj.dateTime = dateTime;
	activityObj.activity = activity;
	return activityDao.createActivity(activityObj)
		.then( function(result) 
		{	
			return babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) 
		{
			loadedBaby = readBabyResult.Item;	
			var babyName = loadedBaby.name;
			var responseMsg = template(
			{
				activity: activity,
				babyName: loadedBaby.name
			});
			logger.debug("addActivity: Response %s", responseMsg);
			return new Response(responseMsg, "Activity", responseMsg);
		});
};

module.exports = ActivityController;