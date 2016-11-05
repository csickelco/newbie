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
var DiaperDao = require('./diaper_aws_dao');
var BabyDao = require('../baby/baby_aws_dao');
var Diaper = require('./diaper');
var Utils = require('../common/utils');
var ValidationUtils = require('../common/validation_utils');
var IllegalStateError = require('../common/illegal_state_error');
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

/**
 * Represents business logic for diaper-related operations.
 * @constructor
 */
function DiaperController () {
	this.diaperDao = new DiaperDao();
	this.babyDao = new BabyDao();
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
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
DiaperController.prototype.addDiaper = function(userId, dateTime, isWet, isDirty) {
	logger.debug("addDiaper: Adding diaper for %s, date: %s, isWet: %s, isDirty: %s", userId, dateTime, isWet, isDirty);
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
			return self.babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) {
			//Then, create the diaper in the datastore provided the baby exists
			if(readBabyResult && readBabyResult.Item && readBabyResult.Item.name) {
				loadedBaby = readBabyResult.Item;
			} else {
				return Promise.reject(new IllegalStateError("Before recording diapers, you must first add a baby"));
			}
			return self.diaperDao.createDiaper(diaper)
		})
		.then( function(result) {
			//Then, get all diapers for the day to provide cumultive day count in response
			return self.diaperDao.getDiapers(userId, dateTime);
		})
		.then( function(diapersForDayResult) 
		{
			//Finally, put it all together in a response
			diapersForDayResult.Items.forEach(function(item) {
	            logger.debug(" -", item.dateTime + ": " + item.isWet + ", " + item.isDirty);
	            if(item.isWet) {
	            	totalWetDiapers++;
	            }
	            if(item.isDirty) {
	            	totalDirtyDiapers++;
	            }
	        });

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
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
DiaperController.prototype.removeLastDiaper = function(userId) {
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
			return self.babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) {
			//Then, get the most recent diaper entry from the datastore provided the baby exists
			if(readBabyResult && readBabyResult.Item && readBabyResult.Item.name) {
				loadedBaby = readBabyResult.Item;
			} else {
				return Promise.reject(new IllegalStateError("Before removing diapers, you must first add a baby"));
			}
			return self.diaperDao.getLastDiaper(userId);
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
				return self.diaperDao.deleteDiaper(userId, new Date(lastDiaperDateTime));
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