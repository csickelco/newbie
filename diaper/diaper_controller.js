/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class handles business logic for diaper-related operations.
 * 
 * @property {DiaperAWSDao} 	diaperDao	 	- Interacts with the diaper data store
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
var Diaper = require('./diaper');
var Utils = require('../common/utils');
var ValidationUtils = require('../common/validation_utils');
var IllegalStateError = require('../common/illegal_state_error');
var ActivityLimitError = require('../common/activity_limit_error');
var Response = require('../common/response');
var Winston = require('winston');
var rp = require('request-promise');

//Configure the logger with basic logging template
var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Diaper_Controller - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//Constants
/**
 * The maximum number of diapers that can be added in any given day
 */
var ADD_LIMIT = 40;

/**
 * Represents business logic for diaper-related operations.
 * @constructor
 */
function DiaperController (diaperDao, babyDao) {
	this.diaperDao = diaperDao;
	this.babyDao = babyDao;
}

/**
 * Asynchronous operation to setup any needed diaper data in the data store.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
DiaperController.prototype.initDiaperData = function() {
	logger.debug("initDiaperData: Starting initialization...");
	return this.diaperDao.createTable();
};

/**
 * Asynchronous operation to add (or overwrite) a diaper change to the data store
 * and return a response.
 * 
 * @param 	userId {string}		the userId whose diaper change this is. Non-nullable.
 * @param	dateTime {Date}		the date/time the diaper change occurred. Non-nullable. 
 * @param	isWet {boolean}		true/false if the diaper was wet. Non-nullable.
 * @param	isDirty	{boolean}	true/false if the diaper was dirty/soiled. Non-nullable.
 * @param 	{string} baby				the name of the baby to add the diaper for. Nullable.
 * 										If not specified, the diaper is assumed to be for the most
 * 										recently added baby.
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
DiaperController.prototype.addDiaper = function(userId, dateTime, isWet, isDirty, baby) {
	logger.debug("addDiaper: Adding diaper for %s, date: %s, isWet: %s, isDirty: %s, baby: %s", 
			userId, dateTime, isWet, isDirty, baby);
	var loadedBaby;
	var totalWetDiapers = 0;
	var totalDirtyDiapers = 0;
	var diaper = new Diaper();
	diaper.userId = userId;
	diaper.dateTime = dateTime;
	diaper.isWet = isWet;
	diaper.isDirty = isDirty;
	
	var self = this;

	//First, validate all input arguments
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			return ValidationUtils.validateRequired("diaper date and time", dateTime);
		})
		.then( function(result) {
			return ValidationUtils.validateRequired("whether the diaper is wet", isWet);
		})
		.then( function(result) {
			return ValidationUtils.validateRequired("whether the diaper is dirty", isDirty);
		})
		.then( function(result) {
			return ValidationUtils.validateBoolean("whether the diaper is wet", isWet);
		})
		.then( function(result) {
			return ValidationUtils.validateBoolean("whether the diaper is dirty", isDirty);
		})
		.then( function(result) {
			return ValidationUtils.validateDate("diaper date and time", dateTime);
		})
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			if( baby ) {
				logger.debug("addDiaper: Retrieving baby %s...", baby);
				return self.babyDao.readBabyByName(userId, baby);
			} else {
				return self.babyDao.readBaby(userId);
			}
		})
		.then( function(readBabyResult) {
			//Provided the baby exists, get all diapers for the day to provide cumultive day count in response
			//and to make sure the user hasn't exceeded any limits
			if(readBabyResult) {
				loadedBaby = readBabyResult;
				diaper.seq = loadedBaby.seq;
				diaper.timezone = loadedBaby.timezone;
			} else {
				if(baby) {
					return Promise.reject(new IllegalStateError(
							"Before recording diapers for " + baby + ", you must first add " + baby + 
							" by saying 'tell Newbie to add baby'"));
				} else {
					return Promise.reject(new IllegalStateError("Before recording diapers, you must first add a baby"));
				}
			}
			return self.diaperDao.getDiapers(userId, loadedBaby.seq, dateTime, loadedBaby.timezone);
		})
		.then( function(diapersForDayResult) {
			var totalDiaperCount = 0;
			//Count up all the previous diapers for the day
			diapersForDayResult.Items.forEach(function(item) {
	            logger.debug(" -", item.dateTime + ": " + item.isWet + ", " + item.isDirty);
	            totalDiaperCount++;
	            if(item.isWet) {
	            	totalWetDiapers++;
	            }
	            if(item.isDirty) {
	            	totalDirtyDiapers++;
	            }
	        });
			
			//Add the current diaper
			totalDiaperCount++;
			if( diaper.isWet ) {
				totalWetDiapers++;
			}
			if( diaper.isDirty ) {
				totalDirtyDiapers++;
			}
			
			//Make sure the user is within their limits
			if( totalDiaperCount > ADD_LIMIT ) {
				return Promise.reject(new ActivityLimitError("You cannot add more than " + ADD_LIMIT + 
						" diapers in any given day"));
			}
			
			//Assuming within limits, add the diaper to the datastore
			return self.diaperDao.createDiaper(diaper);
		})
		.then( function(createDiaperResult) 
		{
			//Finally, put it all together in a response
			var babyName = loadedBaby.name;
			var responseMsg = "Added ";
			if(isWet) {
				responseMsg += "wet ";
			}
			if(isWet && isDirty) {
				responseMsg += "and ";
			}
			if(isDirty) {
				responseMsg += "dirty ";
			}
			responseMsg += "diaper for " + babyName + ". Today, " + Utils.heShe(loadedBaby.sex) + "'s had " + 
				totalWetDiapers + " wet and " + totalDirtyDiapers + " dirty diaper" + Utils.pluralizeIfNeeded(totalDirtyDiapers); 
			logger.debug("addDiaper: Response %s", responseMsg);
			return new Response(responseMsg, "Diaper", responseMsg);
		});
};

/**
 * Asynchronous operation to remove the most recent diaper entry from the data store
 * and return a response.
 * 
 * @param 	userId {string}		the userId whose last diaper entry to remove. Non-nullable.
 * @param 	{string} baby				the name of the baby to remove the diaper for. Nullable.
 * 										If not specified, the diaper is assumed to be for the most
 * 										recently added baby.
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
DiaperController.prototype.removeLastDiaper = function(userId, baby) {
	logger.debug("removeLastDiaper: Removing diaper for %s", userId);
	var loadedBaby;	
	var self = this;
	var isWet;
	var isDirty;
	var lastDiaperDateTime;

	//First, validate all input arguments
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			if( baby ) {
				logger.debug("removeLastDiaper: Removing diaper for %s", baby);
				return self.babyDao.readBabyByName(userId, baby);
			} else {
				return self.babyDao.readBaby(userId);
			}
		})
		.then( function(readBabyResult) {
			//Then, get the most recent diaper entry from the datastore provided the baby exists
			if(readBabyResult) {
				loadedBaby = readBabyResult;
			} else {
				if(baby) {
					return Promise.reject(new IllegalStateError(
							"Before removing diapers for " + baby + ", you must first add " + baby + 
							" by saying 'tell Newbie to add baby'"));
				} else {
					return Promise.reject(new IllegalStateError("Before removing diapers, you must first add a baby"));
				}
			}
			return self.diaperDao.getLastDiaper(userId, loadedBaby.seq);
		})
		.then( function(getLastDiaperResult) {
			//TODO: Handle the case where there are no diaper entries
			getLastDiaperResult.Items.forEach(function(item) {
	            logger.debug("getLastDiaper: lastDiaper %s %s %s", item.dateTime, item.isWet, item.isDirty);
	            lastDiaperDateTime = new Date(item.dateTime); //TODO: Can't the DAO do this?
	            isWet = item.isWet;
	            isDirty = item.isDirty;
	        });
			
			//Then delete that diaper
			if( lastDiaperDateTime ) {
				logger.debug("Deleting diaper");
				return self.diaperDao.deleteDiaper(userId, loadedBaby.seq, new Date(lastDiaperDateTime), loadedBaby.timezone);
			} else {
				return Promise.resolve();
			}
		})
		.then( function(deleteDiaperResult) 
		{
			logger.debug("Delete diaper result: %s", JSON.stringify(deleteDiaperResult));
			//Finally, put it all together in a response
			var babyName = loadedBaby.name;
			var responseMsg;
			if( lastDiaperDateTime ) {
				responseMsg = "Removed ";
				if(isWet) {
					responseMsg += "wet ";
				}
				if(isWet && isDirty) {
					responseMsg += "and ";
				}
				if(isDirty) {
					responseMsg += "dirty ";
				}
				responseMsg += "diaper for " + babyName + "."; 
			} else {
				responseMsg =  "No previous diaper entries recorded for " + babyName;
			}
			logger.debug("removeDiaper: Response %s", responseMsg);
			return new Response(responseMsg, "Diaper", responseMsg);
		});
};

module.exports = DiaperController;