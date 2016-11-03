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
var Utils = require('../common/utils');
var DaoError = require('../common/dao_error');
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
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Weight_Percentile_Dao - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

/**
 * Represents business logic for weight-related operations.
 * @constructor
 */
function WeightPercentileDao () {
}

/**
 * Asynchronous operation to determine what weight percentile a baby falls into.
 * 
 * @param {number} 	pounds - The pounds portion of the baby's weight. Non-nullable. Must be an integer greater than 0.
 * @param {number} 	ounces - The ounces portion of the baby's weight. Nullable (if null, assumed to be 0).
 * 					Must be an integer between 0 and 15.
 * @param {Date} 	birthdate - the baby's birthdate. Non-nullable. Must be a date in the past or now.
 * @param {Date} 	dateOfMeasurement - when the baby was weighed. Non-nullable. Must be a date in the past or now.
 * @param {string}	sex - whether the baby is a boy or girl. Non-nullable Valid values: boy, girl
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred accessing the percentile on the website 
 */
WeightPercentileDao.prototype.getWeightPercentile = function(pounds, ounces, birthdate, dateOfMeasurement, sex) {
	logger.debug("getWeightPercentile: Getting weight percentile for " +
			"pounds %d, ounces %d, birthdate %s, dateOfMeasurement %s, sex %s", 
			pounds, ounces, birthdate.toString(), dateOfMeasurement.toString(), sex);

	var totalOunces = (pounds*16) + parseInt(ounces);
	var weightInKg = 0.02834952*totalOunces;
	var dobValue = birthdate.toString('yyyy-MM-dd');
	var dateValue = dateOfMeasurement.toString('yyyy-MM-dd');
	var sexValue = sex === "boy" ? "1" : "2";
	logger.debug("getWeightPercentile: Percentile calculation for dob %s, date %s, weight in kg %d, weight in ounces %d, sex %s", 
			dobValue, dateValue, weightInKg, totalOunces, sexValue);
	var options = {
	    method: 'POST',
	    uri: 'http://peditools.org/growthinfant/index.php',
	    form: {
	        sex: sexValue,
	        dob: dobValue,
	        date: dateValue,
	        weight: weightInKg
	    },
	    headers: {
	    }
	};

	return rp(options)
		.then(function(body) {
			// logger.debug("POST: %s", body);
	    	//TODO: This is pretty hacky
	        var percentile = body.match(/oz<TD>(.*)%<TD>/)[1];
	        return Promise.resolve(parseInt(percentile));
		})
		.catch(function (err) {
			return Promise.reject( new DaoError("determine weight percentile", err) );
	    });
};

module.exports = WeightPercentileDao;