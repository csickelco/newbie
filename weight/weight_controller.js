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
var Utils = require('../common/utils');
var Winston = require('winston');
var rp = require('request-promise');

//Properties
var weightDao = new WeightDao();
var babyDao = new BabyDao();

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
}

/**
 * Asynchronous operation to setup any needed weight data in the data store.
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws {ResourceInUseException} The operation conflicts with the resource's availability. 
 */
WeightController.prototype.initWeightData = function() {
	logger.debug("initWeightData: Starting initialization...");
	return weightDao.createTable();
};

/**
 * Asynchronous operation to add (or overwrite) a new weight to the data store
 * and return a response.
 * 
 * @param 	userId {string}		the userId whose baby's weight to add. Non-nullable.
 * @param	date {Date}			the date the weight measurement was taken. Non-nullable.
 * @param	pounds {number}		the number of pounds the baby is. Non-nullable.
 * @param	ounces {number}		number of ounces after pounds the baby is. Non-nullable.
 * 
 * @return 	promise containing a Response, with both a verbal message and written card,
 *  		describing the baby's weight.
 * 
 * @throws 	{InternalServerError} An error occurred on the server side.
 * @throws 	{LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws 	{ResourceInUseException} The operation conflicts with the resource's availability. 
 * @throws 	{ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
WeightController.prototype.addWeight = function(userId, date, pounds, ounces) {
	logger.debug("pounds - " + pounds + ", ounces - " + ounces);
	logger.debug("addWeight: Adding weight for %s, date: %s, pounds: %d, ounces: %d", userId, date, pounds, ounces);
	var template = _.template('Added weight ${pounds} pounds, ${ounces} ounces for ${babyName}. ${pronoun} is in the ${percentile} percentile');
	var totalOunces = (pounds*16) + parseInt(ounces);
	var loadedBaby;
	
	var weightInKg = 0.02834952*totalOunces;
	var weight = new Weight();
	weight.userId = userId;
	weight.weight = totalOunces;
	weight.date = date;

	var createWeightPromise = weightDao.createWeight(weight);
	var readBabyPromise = createWeightPromise.then( function(createWeightResult) 
	{
		return babyDao.readBaby(userId);
	});
	var calculatePercentilePromise = readBabyPromise.then( function(readBabyResult) 
	{
		loadedBaby = readBabyResult.Item;			
		var dobValue = loadedBaby.birthdate.toString('yyyy-MM-dd');
		var dateValue = date.toString('yyyy-MM-dd');
		logger.debug("addWeight: Percentile calculation for dob %s, date %s, weight in kg %d, weight in ounces %d", dobValue, dateValue, weightInKg, totalOunces);
		var options = {
		    method: 'POST',
		    uri: 'http://peditools.org/growthinfant/index.php',
		    form: {
		        sex: '2', // Will be urlencoded //TODO: Handle boys
		        dob: dobValue,
		        date: dateValue,
		        weight: weightInKg
		    },
		    headers: {
		    }
		};

		return rp(options);
	});
	return calculatePercentilePromise.then( function(body) {
			// logger.debug("POST: %s", body);
	    	//TODO: This is pretty hacky
	        var percentile = body.match(/oz<TD>(.*)%<TD>/)[1];
	        logger.debug("addWeight: Percentile-- %s, readBabyPromise %s", percentile, JSON.stringify(readBabyPromise));
	        //TODO: Is there any way to have the daos return the Item.data part?
			var responseMsg = template(
			{
				pounds: pounds,
				ounces: ounces,
				babyName: loadedBaby.name,
				percentile: stringifyNumber(percentile),
				pronoun: Utils.heShe(loadedBaby.sex, true)
			});
			logger.debug("addWeight: Response %s", responseMsg);
			return new Response(responseMsg, "Weight", responseMsg);
	});
};

module.exports = WeightController;