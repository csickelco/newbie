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
var BabyDao = require('./baby_aws_dao');
var Baby = require('./baby');
var Response = require('../common/response');
var Utils = require('../common/utils');
var Winston = require('winston');

//Properties
var babyDao = new BabyDao();

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

/**
 * Represents business logic for baby-related operations.
 * @constructor
 */
function BabyController () {
}

/**
 * Asynchronous operation to setup any needed baby data in the data store.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
BabyController.prototype.initBabyData = function() {
	logger.debug("initBabyData: Starting initialization...");
	return babyDao.createTable();
};

/**
 * Asynchronous operation to add (or overwrite) a new baby to the data store
 * and return a response.
 * 
 * @param 	{string} userId		the userId whose baby it is. Non-nullable.
 * @param	{string} sex		the baby's sex (girl/boy). Non-nullable.
 * @param 	{string} name		the baby's name (it's ok to be just a first name). Non-nullable.
 * @param	{Date} birthdate	the baby's birthdate (as a Date object). Non-nullable.
 * 
 * @returns {Promise<Response|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
BabyController.prototype.addBaby = function(userId, sex, name, birthdate) {
	logger.debug("addBaby: Adding baby for %s, sex: %s, name: %s, birthdate: %s", userId, sex, name, birthdate);
	var template = _.template('Added baby ${sex} ${name}. ${pronoun} is ${age} old');
	
	var baby = new Baby(); 
	baby.userId = userId;
	baby.sex = sex;
	baby.name = name;
	baby.birthdate = birthdate;
	
	//We will first create the baby in the data store, then read it back 
	//(mainly for verification), then format a message
	return babyDao.createBaby(baby)
		.then( function(result) 
		{
			logger.debug("addBaby: Successfully created baby %s", JSON.stringify(baby));
			return babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) 
		{
			logger.debug("addBaby: Successfully read baby %s", JSON.stringify(readBabyResult));
			var loadedBaby = readBabyResult.Item;
			logger.debug("addBaby: loadedBaby %s", JSON.stringify(loadedBaby));
			var responseMsg = template(
			{
				sex: loadedBaby.sex,
				name: loadedBaby.name,
				age: Utils.calculateAgeFromBirthdate(birthdate),
				pronoun: Utils.heShe(loadedBaby.sex, true)
			});
			logger.debug("addBaby: Response %s", responseMsg);
			return new Response(responseMsg, "Added Baby", responseMsg);
		});
};

module.exports = BabyController;