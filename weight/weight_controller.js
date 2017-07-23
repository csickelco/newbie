/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class handles business logic for feed-related operations.
 * 
 * @property {WeightAWSDao} 	weightDao 		- Interacts with the weight data store
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
var Response = require('../common/response');
var Weight = require('./weight');
var WeightPercentileDao = require('./weight_percentile_dao');
var Utils = require('../common/utils');
var IllegalStateError = require('../common/illegal_state_error');
var ActivityLimitError = require('../common/activity_limit_error');
var ValidationUtils = require('../common/validation_utils');
var Winston = require('winston');

//Configure the logger with basic logging template
var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Weight_Controller - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//Constants
/**
 * The maximum number of weight entries that can be added in any given day
 */
var ADD_LIMIT = 5;

//http://stackoverflow.com/questions/20425771/how-to-replace-1-with-first-2-with-second-3-with-third-etc
var special = ['zeroth','first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelvth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth'];
var deca = ['twent', 'thirt', 'fourt', 'fift', 'sixt', 'sevent', 'eight', 'ninet'];

/**
 * Helper method to return position text for the given number.
 * e.g. returns "first" if n === 0, "second" if n === 2, and so on.
 * @param n {number}	the number to stringify. Non-nullable.
 * @returns {string} position text for the given number.
 */
function stringifyNumber(n) {
  if (n < 20) {
	  return special[n];
  }
  if (n%10 === 0) {
	  return deca[Math.floor(n/10)-2] + 'ieth';
  }
  return deca[Math.floor(n/10)-2] + 'y-' + special[n%10];
}

/**
 * Represents business logic for weight-related operations.
 * @constructor
 */
function WeightController (weightDao, babyDao) {
	this.weightDao = weightDao;
	this.babyDao = babyDao;
	this.weightPercentileDao = new WeightPercentileDao();
}

/**
 * Asynchronous operation to setup any needed weight data in the data store.
 * 
 * @returns {Promise<Response|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
WeightController.prototype.initWeightData = function() {
	logger.debug("initWeightData: Starting initialization...");
	return this.weightDao.createTable();
};

/**
 * Asynchronous operation to add (or overwrite) a new weight to the data store
 * and return a response.
 * 
 * @param 	userId {string}		the userId whose baby's weight to add. Non-nullable.
 * @param	date {Date}			the date the weight measurement was taken. Non-nullable. Must be >= birthdate.
 * @param	pounds {number}		the number of pounds the baby is. Non-nullable.  Must be an integer >= 0.
 * @param	ounces {number}		number of ounces after pounds the baby is. Nullable (if null, assumed to be 0).
 * 								Must be an integer between 0 and 15.
 * @param 	{string} baby				the name of the baby to add the weight for. Nullable.
 * 										If not specified, the weight is assumed to be for the most
 * 										recently added baby.
 * 
 * @returns {Promise<Response|DaoError, IllegalArgumentError, TypeError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB,
 * 			or an illegalArgumentError if invalid input provider,
 * 			or TypeError if one of the specified arguments was of the wrong type,
 * 			or RangeError if pounds or ounces fall outside the range.
 */
WeightController.prototype.addWeight = function(userId, date, pounds, ounces, baby) {
	logger.debug("pounds - " + pounds + ", ounces - " + ounces);
	logger.debug("addWeight: Adding weight for %s, date: %s, pounds: %d, ounces: %d, baby: %s", userId, date, pounds, ounces, baby);
	var template = _.template('Added weight ${pounds} pound${poundsPlural}, ${ounces} ounce${ouncePlural} for ${babyName}.');
	if( !ounces ) {
		ounces = 0;
	}
	var totalOunces = (pounds*16) + parseInt(ounces);
	var loadedBaby;
	
	var weight = new Weight();
	weight.userId = userId;
	weight.weight = totalOunces;
	weight.date = date;
	
	var self = this;
	
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			return ValidationUtils.validateRequired("weight date", date);
		})
		.then( function(result) {
			return ValidationUtils.validateRequired("weight pounds", pounds);
		})
		.then( function(result) {
			return ValidationUtils.validateNumber("weight pounds", pounds);
		})
		.then( function(result) {
			return ValidationUtils.validateNumberGreaterThanOrEqualTo("weight pounds", pounds, 0);
		})
		.then( function(result) {
			return ValidationUtils.validateNumber("weight ounces", ounces);
		})
		.then( function(result) {
			return ValidationUtils.validateNumberGreaterThanOrEqualTo("weight ounces", ounces, 0);
		})
		.then( function(result) {
			return ValidationUtils.validateNumberLessThan("weight ounces", ounces, 16);
		})
		.then( function(result) {
			if( baby ) {
				logger.debug("addWeight: Adding weight for %s", baby);
				return self.babyDao.readBabyByName(userId, baby);
			} else {
				return self.babyDao.readBaby(userId);
			}
		})
		.then(function(readBabyResult) {
			if(readBabyResult) {
				loadedBaby = readBabyResult;
				weight.seq = loadedBaby.seq;
				weight.timezone = loadedBaby.timezone;
			} else {
				if(baby) {
					return Promise.reject(new IllegalStateError(
							"Before adding weight for " + baby + ", you must first add " + baby + 
							" by saying 'tell Newbie to add baby'"));
				} else {
					return Promise.reject(new IllegalStateError("Before adding weight, you must first add a baby"));
				}
			}
			var dateAfter;
			if(loadedBaby.birthdate) {
				dateAfter = new Date(loadedBaby.birthdate);
			} else {
				dateAfter = new Date(1900, 1, 1);
			}
			return ValidationUtils.validateDateAfter("weight date", date, dateAfter);
		}).then(function(result) {
			return self.weightDao.getWeightCountForDay(weight.userId, loadedBaby.seq, date, loadedBaby.timezone);
		})
		.then(function(weightCountResult) {
			if( weightCountResult + 1 > ADD_LIMIT ) {
				return Promise.reject(new ActivityLimitError("You cannot add more than " + ADD_LIMIT + 
					" weight entries in any given day"));
			}
			return self.weightDao.createWeight(weight);
		}).then(function(createWeightResult) {
			var responseMsg = template(
			{
				pounds: pounds,
				poundsPlural: Utils.pluralizeIfNeeded(pounds),
				ounces: ounces,
				ouncePlural: Utils.pluralizeIfNeeded(ounces),
				babyName: loadedBaby.name
			});
			logger.debug("addWeight: Response %s", responseMsg);
			return new Response(responseMsg, "Weight", responseMsg);
		});
};

/**
 * Asynchronous operation to remove the most recent weight entry from the data store
 * and return a response.
 * 
 * @param 	userId {string}		the userId whose last weight entry to remove. Non-nullable.
 * @param 	{string} baby				the name of the baby to get the weight for. Nullable.
 * 										If not specified, the weight is assumed to be for the most
 * 										recently added baby.
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
WeightController.prototype.removeLastWeight = function(userId, baby) {
	logger.debug("removeLastWeight: Removing weight for %s", userId);
	var loadedBaby;	
	var self = this;
	var lastWeight;
	var lastWeightDate;

	//First, validate all input arguments
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			if( baby ) {
				logger.debug("removeLastWeight: Removing weight for %s", baby);
				return self.babyDao.readBabyByName(userId, baby);
			} else {
				return self.babyDao.readBaby(userId);
			}
		})
		.then( function(readBabyResult) {
			//Then, get the most recent weight entry from the datastore provided the baby exists
			if(readBabyResult) {
				loadedBaby = readBabyResult;
			} else {
				if(baby) {
					return Promise.reject(new IllegalStateError(
							"Before removing weight for " + baby + ", you must first add " + baby + 
							" by saying 'tell Newbie to add baby'"));
				} else {
					return Promise.reject(new IllegalStateError("Before removing weight, you must first add a baby"));
				}
			}
			return self.weightDao.getLastWeight(userId, loadedBaby.seq);
		})
		.then( function(getLastWeightResult) {
			//TODO: Handle the case where there are no weight entries
			getLastWeightResult.Items.forEach(function(item) {
	            logger.debug("getLastWeight: lastWeight %s %d", item.date, item.weight);
	            lastWeightDate = new Date(item.date); //TODO: Can't the DAO do this?
	            lastWeight = item.weight;
	        });
			
			//Then delete that weight
			if( lastWeightDate ) {
				logger.debug("Deleting weight");
				return self.weightDao.deleteWeight(userId, loadedBaby.seq, new Date(lastWeightDate), loadedBaby.timezone);
			} else {
				return Promise.resolve();
			}
		})
		.then( function(deleteWeightResult) 
		{
			logger.debug("Delete weight result: %s", JSON.stringify(deleteWeightResult));
			//Finally, put it all together in a response
			var babyName = loadedBaby.name;
			var responseMsg;
			if( lastWeightDate ) {
				responseMsg = "Removed weight " + Utils.getPoundsAndOuncesString(lastWeight) + " for " + babyName + "."; 
			} else {
				responseMsg =  "No previous weight entries recorded for " + babyName;
			}
			logger.debug("removeWeight: Response %s", responseMsg);
			return new Response(responseMsg, "Weight", responseMsg);
		});
};

module.exports = WeightController;