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
 * @property {ActivityAWSDao} 	activityDao 	- Interacts with the activity data store
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
var ActivityDao = require('./activity_aws_dao');
var BabyDao = require('../baby/baby_aws_dao');
var Activity = require('./activity');
var IllegalArgumentError = require('../common/illegal_argument_error');
var IllegalStateError = require('../common/illegal_state_error');
var ActivityLimitError = require('../common/activity_limit_error');
var ValidationUtils = require('../common/validation_utils');
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
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Activity_Controller - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//Constants
/**
 * The maximum number of activities that can be added in any given day
 */
var ADD_LIMIT = 40;

/**
 * Represents business logic for activity-related operations.
 * @constructor
 */
function ActivityController () {
	this.activityDao = new ActivityDao();
	this.babyDao = new BabyDao();
}

/**
 * Asynchronous operation to setup any needed activity data in the data store.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the table
 * 			creation succeeded, else returns a rejected promise with a 
 * 			DaoError if an error occurred creating the table in the data store.
 */
ActivityController.prototype.initActivityData = function() {
	logger.debug("initActivityData: Starting initialization...");
	return this.activityDao.createTable();
};

/**
 * Asynchronous operation to add (or overwrite) a new activity to the data store
 * and return a response.
 * 
 * @param 	{string} userId				the userId who owns the activities. Non-nullable.
 * @param	{Activity} activity			text describing the activity (e.g. "visiting grandma"). Non-nullable.					
 * @param	{Date} dateTime				the date/time the activity occurred. Nullable.
 * 										If not specified, the current date/time is used.
 * 
 * @return 	{Promise<Response>|IllegalArgumentError, IllegalStateError, DaoError} 				
 * 										promise containing a response with both a verbal message and written card,
 *  									providing confirmation of the added activity.
 *  									Rejected promise with IllegalArgumentError if no activity or userId was specified.
 *  									Rejected promise with IllegalStateError if the user has not yet added a baby.  
 *  									Rejected promise with DaoError if an error occurred interacting with the data store while attempting
 * 										to add the activity. 
 */
ActivityController.prototype.addActivity = function(userId, activity, dateTime) {
	logger.debug("addActivity: Adding activity for %s, date: %s, activity: %s", userId, dateTime, activity);
	
	var template = _.template("Added activity ${activity} for ${babyName}");
	var loadedBaby;
	var activityObj = new Activity();
	var self = this;
	var babyName;
	
	//First, validate our required arguments
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result){
			return ValidationUtils.validateRequired("the activity name ", activity);
		})
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			return self.babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) 
		{
			//Provided baby exists, get a count of activities for the day 
			//to make sure the user has not exceeded their limits
			if(readBabyResult && readBabyResult.Item && readBabyResult.Item.name) {
				loadedBaby = readBabyResult.Item;
				babyName = loadedBaby.name;
				
				if( !dateTime ) {
					dateTime = new Date();
				}
				activityObj.userId = userId;
				activityObj.dateTime = dateTime;
				activityObj.activity = activity;

				return self.activityDao.getActivityCountForDay(activityObj.userId, activityObj.dateTime);
			} else {
				return Promise.reject(new IllegalStateError("Before recording activities, you must first add a baby"));
			}
		})
		.then( function(activityCountResult) 
		{
			logger.debug("addActivity: Activity count: %d", activityCountResult);
			var totalActivityCount = activityCountResult + 1; //All activities for the day plus the one we're trying to add
			
			if( totalActivityCount > ADD_LIMIT ) {
				return Promise.reject(new ActivityLimitError("You cannot add more than " + ADD_LIMIT + 
					" activities in any given day"));
			} else {
				//Assuming they haven't exceeded the activity limit, go ahead and create this one
				return self.activityDao.createActivity(activityObj);
			}
		})
		.then( function(createActivityResult)
		{
			//Finally, build the response confirming the add
			var responseMsg = template(
			{
				activity: activity,
				babyName: loadedBaby.name
			});
			logger.debug("addActivity: Response %s", responseMsg);
			return new Response(responseMsg, "Activity", responseMsg);
		});
};

/**
 * Asynchronous operation to remove the most recent activity entry from the data store
 * and return a response.
 * 
 * @param 	userId {string}		the userId whose last activity entry to remove. Non-nullable.
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
ActivityController.prototype.removeLastActivity = function(userId) {
	logger.debug("removeLastActivity: Removing activity for %s", userId);
	var loadedBaby;	
	var self = this;
	var lastActivity;
	var lastActivityDateTime;

	//First, validate all input arguments
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			return self.babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) {
			//Then, get the most recent activity entry from the datastore provided the baby exists
			if(readBabyResult && readBabyResult.Item && readBabyResult.Item.name) {
				loadedBaby = readBabyResult.Item;
			} else {
				return Promise.reject(new IllegalStateError("Before removing activities, you must first add a baby"));
			}
			return self.activityDao.getLastActivity(userId);
		})
		.then( function(getLastActivityResult) {
			//TODO: Handle the case where there are no activity entries
			getLastActivityResult.Items.forEach(function(item) {
	            logger.debug("getLastActivity: lastActivity %s %d", item.dateTime, item.activityAmount);
	            lastActivityDateTime = new Date(item.dateTime); //TODO: Can't the DAO do this?
	            lastActivity = item.activity;
	        });
			
			//Then delete that activity
			if( lastActivityDateTime ) {
				logger.debug("Deleting activity");
				return self.activityDao.deleteActivity(userId, new Date(lastActivityDateTime));
			} else {
				return Promise.resolve();
			}
		})
		.then( function(deleteActivityResult) 
		{
			logger.debug("Delete activity result: %s", JSON.stringify(deleteActivityResult));
			//Finally, put it all together in a response
			var babyName = loadedBaby.name;
			var responseMsg;
			if( lastActivityDateTime ) {
				responseMsg = "Removed activity " + lastActivity + " for " + babyName + "."; 
			} else {
				responseMsg =  "No previous activity entries recorded for " + babyName;
			}
			logger.debug("removeActivity: Response %s", responseMsg);
			return new Response(responseMsg, "Activity", responseMsg);
		});
};

module.exports = ActivityController;