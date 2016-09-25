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
 * @return 	{Promise<Response>|IllegalArgumentError, IllegalStateError} 				
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
			return ValidationUtils.validateRequired("activity", activity);
		})
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			return self.babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) 
		{
			//Then, create the activity in the datastore provided the baby exists
			if(readBabyResult && readBabyResult.Item && readBabyResult.Item.name) {
				loadedBaby = readBabyResult.Item;
				babyName = loadedBaby.name;
				
				if( !dateTime ) {
					dateTime = new Date();
				}
				activityObj.userId = userId;
				activityObj.dateTime = dateTime;
				activityObj.activity = activity;

				return self.activityDao.createActivity(activityObj);
			} else {
				return Promise.reject(new IllegalStateError("Before recording activities, you must first add a baby"));
			}
		})
		.then( function(readBabyResult) 
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

module.exports = ActivityController;