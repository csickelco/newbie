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
var Response = require('../common/response');
var Winston = require('winston');
var rp = require('request-promise');

//Properties
var diaperDao = new DiaperDao();
var babyDao = new BabyDao();

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
}

/**
 * Asynchronous operation to setup any needed diaper data in the data store.
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws {ResourceInUseException} The operation conflicts with the resource's availability. 
 */
DiaperController.prototype.initDiaperData = function() {
	logger.debug("initDiaperData: Starting initialization...");
	return diaperDao.createTable();
};

/**
 * Asynchronous operation to add (or overwrite) a diaper change to the data store
 * and return a response.
 * 
 * @param 	userId		the userId whose diaper change this is. Non-nullable.
 * @param	dateTime	the date/time the diaper change occurred. Non-nullable.
 * @param	isWet		true/false if the diaper was wet. Non-nullable.
 * @param	isDirty		true/false if the diaper was dirty/soiled. Non-nullable.
 * 
 * @return 	promise containing a Response, with both a verbal message and written card,
 *  		describing whether or not the diaper was successfully added.
 * 
 * @throws 	{InternalServerError} An error occurred on the server side.
 * @throws 	{LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws 	{ResourceInUseException} The operation conflicts with the resource's availability. 
 * @throws 	{ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
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
	
	return diaperDao.createDiaper(diaper)
		.then( function(result) {
			return diaperDao.getDiapers(userId, dateTime);
		})
		.then( function(diapersForDayResult) 
		{
			diapersForDayResult.Items.forEach(function(item) {
	            logger.debug(" -", item.dateTime + ": " + item.isWet + ", " + item.isDirty);
	            if(item.isWet) {
	            	totalWetDiapers++;
	            }
	            if(item.isDirty) {
	            	totalDirtyDiapers++;
	            }
	        });
			return babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) 
		{
			loadedBaby = readBabyResult.Item;	
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
			responseMsg += "diaper for " + babyName + ". Today, she's had " + 
				totalWetDiapers + " wet and " + totalDirtyDiapers + " dirty diaper" + Utils.pluralizeIfNeeded(totalDirtyDiapers); //TODO: replace she with proper prononun
			logger.debug("addDiaper: Response %s", responseMsg);
			return new Response(responseMsg, "Diaper", responseMsg);
		});
};

module.exports = DiaperController;