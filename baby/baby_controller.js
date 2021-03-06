/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class handles business logic for baby-related operations.
 * 
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
var Baby = require('./baby');
var Response = require('../common/response');
var Utils = require('../common/utils');
var IllegalStateError = require('../common/illegal_state_error');
var ValidationUtils = require('../common/validation_utils');
var ActivityLimitError = require('../common/activity_limit_error');
var Winston = require('winston');

//Configure the logger with basic logging template
var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Baby_Controller - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//Constants
var ADD_LIMIT = 20;

/**
 * Represents business logic for baby-related operations.
 * @constructor
 */
function BabyController (babyDao, feedDao, weightDao, diaperDao, activityDao, sleepDao, wordDao) {
	this.babyDao = babyDao;
	this.feedDao = feedDao;
	this.weightDao = weightDao;
	this.diaperDao = diaperDao;
	this.activityDao = activityDao;
	this.sleepDao = sleepDao;
	this.wordDao = wordDao;
}

/**
 * Asynchronous operation to setup any needed baby data in the data store.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
BabyController.prototype.initBabyData = function() {
	logger.debug("initBabyData: Starting initialization...");
	return this.babyDao.createTable();
};

/**
 * Helper method to return the proper timezone identifier given
 * a timezone name and whether the location observes daylight savings times.
 * 
 * @param   {string} timezone	Non-nullable. One of the following values:
 * 								hawaii
 * 								alaska
 * 								pacific
 * 								mountain
 * 								central
 * 								eastern
 * 								atlantic
 * 								samoa
 * 								chamorro
 * @param 	{boolean} 	daylightSavingsObserved For Mountain and Eastern zones, true if daylight savings
 * 						is observed, false otherwise. Nullable.
 * 
 * @return timezone identifier (See TZ column in https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
 */
function processTimezone(timezone, daylightSavingsObserved) {
	var retval = "";
	if( timezone === "hawaii") {
		retval = "Pacific/Honolulu";
	} else if( timezone === "alaska" ) {
		retval = "America/Juneau";
	} else if( timezone === "pacific" ) {
		retval = "America/Los_Angeles";
	} else if( timezone === "mountain" ) {
		if( daylightSavingsObserved ) {
			retval = "America/Denver";
		} else {
			retval = "America/Phoenix";
		}
	} else if( timezone === "central" ) {
		retval = "America/Chicago";
	} else if( timezone === "eastern" ) {
		retval = "America/New_York";
	} else if( timezone === "atlantic" ) {
		retval = "America/Puerto_Rico";
	} else if( timezone === "samoa" ) {
		retval = "Pacific/Samoa";
	} else if( timezone === "chamorro" ) {
		retval = "Pacific/Guam";
	} 
	logger.debug("processTimezone: timezone %s, daylightSavingsObserved %s, retval %s", 
			timezone, daylightSavingsObserved, retval);
	return retval;
}

/**
 * Asynchronous operation to add (or overwrite) a new baby to the data store
 * and return a response. Note that at the moment, if the user already has
 * a record for the baby, it will be completely overwritten with the information
 * specified here; a future enhancement will add support for multple babies per user.
 * 
 * @param 	{string} userId		the userId whose baby it is. Non-nullable.
 * @param	{string} sex		the baby's sex (girl/boy). Non-nullable.
 * @param 	{string} name		the baby's name (it's ok to be just a first name). Non-nullable.
 * @param	{Date} birthdate	the baby's birthdate (as a Date object). Nullable.
 * @param   {string} timezone	Non-nullable. One of the following values:
 * 								hawaii
 * 								alaska
 * 								pacific
 * 								mountain
 * 								central
 * 								eastern
 * 								atlantic
 * 								samoa
 * 								chamorro
 * @param 	{boolean} 	daylightSavingsObserved For Mountain and Eastern zones, true if daylight savings
 * 						is observed, false otherwise. Nullable.
 * @param 	{Date} addedDateTime date/time this baby was added. Nullable. If null, current date/time is used.
 * @return 	{Promise<Response>|IllegalArgumentError, DaoError} 				
 * 										promise containing a response with both a verbal message and written card,
 *  									providing confirmation of the added baby.
 *  									Rejected promise with IllegalArgumentError if userId, sex, name, is not provided
 *  									or sex is NOT boy/girl, or birthdate is
 *  									in the future.
 *  									Rejected promise with DaoError if an error occurred interacting with the 
 *  									data store while attempting to add the baby. 
 */
BabyController.prototype.addBaby = function(userId, sex, name, birthdate, timezone, daylightSavingsObserved, addedDateTime) {
	logger.debug("addBaby: Adding baby for %s, sex: %s, name: %s, birthdate: %s", userId, sex, name, birthdate);
	var template = _.template('Added baby ${sex} ${name}. You can now begin adding ${pronoun} feeds, diapers, activities, sleep, weight, and words.');
	var templateNoName = _.template('Added baby ${sex}. You can now begin adding ${pronoun} feeds, diapers, activities, sleep, weight, and words.');
	
	var self = this;
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
				return ValidationUtils.validateRequired("baby's sex", sex);
		})
		.then( function(result) {
				return ValidationUtils.validateInSet("baby's sex", sex, ["boy", "girl"]);
		})
		.then( function(result) {
				return ValidationUtils.validateRequired("baby's name", name);
		})
		.then( function(result) {
				return ValidationUtils.validateRequired("your timezone", timezone);
		})
		.then( function(result) {
				return ValidationUtils.validateDateBefore("baby's birthdate", birthdate, new Date(), "baby's birthdate cannot be in the future");
		})
		.then( function(result) {
				return self.babyDao.getBabyCount(userId);
		})
		.then( function(result) {
			var baby;
			var count = result.count;
			if( count + 1 > ADD_LIMIT ) {
				return Promise.reject(new ActivityLimitError("You cannot add more than " + ADD_LIMIT + " babies"));
			} else {
				baby = new Baby(); 
				baby.userId = userId;
				baby.sex = sex;
				baby.name = name;
				baby.birthdate = birthdate;
				baby.timezone = processTimezone(timezone, daylightSavingsObserved);
				baby.seq = result.maxSeq+1;
				if( addedDateTime ) {
					baby.addedDateTime = addedDateTime;
				} else {
					baby.addedDateTime = new Date();
				}
			}
			return self.babyDao.createBaby(baby);
		})
		.then( function(result) 
		{
			var responseMsg;
			logger.debug("addBaby: Successfully added baby %s", JSON.stringify(result));
			if(name !== "Baby") {
				responseMsg = template(
				{
					sex: sex,
					name: name,
					pronoun: Utils.hisHer(sex, false)
				});
			} else {
				responseMsg = templateNoName(
					{
						sex: sex,
						pronoun: Utils.hisHer(sex, false)
					});
			}
			logger.debug("addBaby: Response %s", responseMsg);
			return new Response(responseMsg, "Added Baby", responseMsg);
		});
};

/**
 * Asynchronous operation to remove the given baby.
 * 
 * @param 	{string} userId		the userId whose baby it is. Non-nullable.
 * @param 	{string} name		the baby's name. Non-nullable.

 * @return 	{Promise<Response>|IllegalArgumentError, DaoError} 				
 * 										promise containing a response with both a verbal message and written card,
 *  									providing confirmation of the added baby.
 *  									Rejected promise with IllegalArgumentError if userId or name is 
 *  									not provided.
 *  									Rejected promise with DaoError if an error occurred interacting with the 
 *  									data store while attempting to add the baby. 
 */
BabyController.prototype.removeBaby = function(userId, name ) {
	logger.debug("removeBaby: Removing baby for %s, name: %s", userId, name);
	var template = _.template('Removed all data for baby ${name}');
	
	var self = this;
	var baby;
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
				return ValidationUtils.validateRequired("baby's name", name);
		})
		.then( function(result) {
			return self.babyDao.readBabyByName(userId, name);
		})
		.then( function(readBabyResult) {
			//Provided baby exists, delete all its data
			if(readBabyResult) {
				baby = readBabyResult;
				var promises = [];
				promises.push(self.activityDao.deleteActivitiesForBaby(userId, baby.seq));
				promises.push(self.diaperDao.deleteDiapersForBaby(userId, baby.seq));
				promises.push(self.feedDao.deleteFeedsForBaby(userId, baby.seq));
				promises.push(self.sleepDao.deleteSleepForBaby(userId, baby.seq));
				promises.push(self.weightDao.deleteWeightsForBaby(userId, baby.seq));
				promises.push(self.wordDao.deleteWordsForBaby(userId, baby.seq));
				return Promise.all(promises);
			} else {
				return Promise.reject(new IllegalStateError(
						"Cannot remove baby " + name + ". No data exists for this baby" ));
			}
		})
		.then( function(deleteAssociatedRecordsResult) {
			logger.info("removeBaby: Removed associated records for baby userId %s, seq %s", userId, baby.seq);

			//Finally, once all baby's data has been deleted, delete the baby record itself
			return self.babyDao.deleteBaby(userId, baby.seq);
		})
		.then( function(result) 
		{
			logger.info("removeBaby: Successfully removed baby userId %s, seq %s", userId, baby.seq);
			var responseMsg = template(
			{
				name: name
			});
			logger.debug("removeBaby: Response %s", responseMsg);
			return new Response(responseMsg, "Removed baby", responseMsg);
		});
};

module.exports = BabyController;