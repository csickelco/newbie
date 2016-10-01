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
var WeightDao = require('./weight_aws_dao');
var BabyDao = require('../baby/baby_aws_dao');
var Response = require('../common/response');
var Weight = require('./weight');
var WeightPercentileDao = require('./weight_percentile_dao');
var Utils = require('../common/utils');
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
function WeightController () {
	this.weightDao = new WeightDao();
	this.babyDao = new BabyDao();
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
WeightController.prototype.addWeight = function(userId, date, pounds, ounces) {
	logger.debug("pounds - " + pounds + ", ounces - " + ounces);
	logger.debug("addWeight: Adding weight for %s, date: %s, pounds: %d, ounces: %d", userId, date, pounds, ounces);
	var template = _.template('Added weight ${pounds} pound${poundsPlural}, ${ounces} ounce${ouncePlural} for ${babyName}. ${pronoun} is in the ${percentile} percentile');
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
			return ValidationUtils.validateRequired("date", date);
		})
		.then( function(result) {
			return ValidationUtils.validateRequired("pounds", pounds);
		})
		.then( function(result) {
			return ValidationUtils.validateNumber("pounds", pounds);
		})
		.then( function(result) {
			return ValidationUtils.validateNumberGreaterThanOrEqualTo("pounds", pounds, 0);
		})
		.then( function(result) {
			return ValidationUtils.validateNumber("ounces", ounces);
		})
		.then( function(result) {
			return ValidationUtils.validateNumberGreaterThanOrEqualTo("ounces", ounces, 0);
		})
		.then( function(result) {
			return ValidationUtils.validateNumberLessThan("ounces", ounces, 16);
		})
		.then( function(result) {
			return self.babyDao.readBaby(userId);
		})
		.then(function(readBabyResult) {
			loadedBaby = readBabyResult.Item;
			return ValidationUtils.validateDateAfter("date", date, new Date(loadedBaby.birthdate));
		}).then(function(result) {
			return self.weightDao.createWeight(weight);
		}).then(function(createWeightResult) {
			return self.weightPercentileDao.getWeightPercentile(
					pounds, ounces, loadedBaby.birthdate, new Date(), loadedBaby.sex);
		}).then(function(weightPercentileResult) {
			var dobValue = loadedBaby.birthdate.toString('yyyy-MM-dd');
			var responseMsg = template(
			{
				pounds: pounds,
				poundsPlural: Utils.pluralizeIfNeeded(pounds),
				ounces: ounces,
				ouncePlural: Utils.pluralizeIfNeeded(ounces),
				babyName: loadedBaby.name,
				percentile: stringifyNumber(weightPercentileResult),
				pronoun: Utils.heShe(loadedBaby.sex, true)
			});
			logger.debug("addWeight: Response %s", responseMsg);
			return new Response(responseMsg, "Weight", responseMsg);
		});
};

module.exports = WeightController;