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
var BabyDao = require('./baby_aws_dao');
var Baby = require('./baby');
var Response = require('../common/response');
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
	this.babyDao = new BabyDao();
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
 * Asynchronous operation to add (or overwrite) a new baby to the data store
 * and return a response. Note that at the moment, if the user already has
 * a record for the baby, it will be completely overwritten with the information
 * specified here; a future enhancement will add support for multple babies per user.
 * 
 * @param 	{string} userId		the userId whose baby it is. Non-nullable.
 * @param	{string} sex		the baby's sex (girl/boy). Non-nullable.
 * @param 	{string} name		the baby's name (it's ok to be just a first name). Non-nullable.
 * @param	{Date} birthdate	the baby's birthdate (as a Date object). Non-nullable.
 * 
 * @return 	{Promise<Response>|IllegalArgumentError, DaoError} 				
 * 										promise containing a response with both a verbal message and written card,
 *  									providing confirmation of the added baby.
 *  									Rejected promise with IllegalArgumentError if userId, sex, name, or
 *  									birthdate are not specified, or sex is NOT boy/girl, or birthdate is
 *  									in the future.
 *  									Rejected promise with DaoError if an error occurred interacting with the 
 *  									data store while attempting to add the baby. 
 */
BabyController.prototype.addBaby = function(userId, sex, name, birthdate) {
	logger.debug("addBaby: Adding baby for %s, sex: %s, name: %s, birthdate: %s", userId, sex, name, birthdate);
	var template = _.template('Added baby ${sex} ${name}. ${pronoun} is ${age} old');
	
	var baby = new Baby(); 
	baby.userId = userId;
	baby.sex = sex;
	baby.name = name;
	baby.birthdate = birthdate;
	
	var self = this;
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
				return ValidationUtils.validateRequired("sex", sex);
		})
		.then( function(result) {
				return ValidationUtils.validateInSet("sex", sex, ["boy", "girl"]);
		})
		.then( function(result) {
				return ValidationUtils.validateRequired("name", name);
		})
		.then( function(result) {
				return ValidationUtils.validateRequired("birthdate", birthdate);
		})
		.then( function(result) {
				return ValidationUtils.validateDateBefore("birthdate", birthdate, new Date());
		})
		.then( function(result) {
				return self.babyDao.createBaby(baby);
		})
		.then( function(result) 
		{
			logger.debug("addBaby: Successfully added baby %s", JSON.stringify(result));
			var responseMsg = template(
			{
				sex: sex,
				name: name,
				age: Utils.calculateAgeFromBirthdate(birthdate),
				pronoun: Utils.heShe(sex, true)
			});
			logger.debug("addBaby: Response %s", responseMsg);
			return new Response(responseMsg, "Added Baby", responseMsg);
		});
};

module.exports = BabyController;