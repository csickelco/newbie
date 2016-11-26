/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class handles encryption and decryption.
 * It expected the shared secret to be passed in as an 
 * environment variable named cryptKey
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
var crypto = require('crypto');
var Winston = require('winston');

//Constants
var ALGORITHM = 'aes-256-ctr';

//Configure the logger with basic logging template
var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' SecurityUtils - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

/**
 * Constructs a new instance of security utils.
 * @constructor
 */
function SecurityUtils() {
	//DynamoDB access objects
	this.key = process.env.cryptKey;
}

/**
 * Returns the text, encrypted.
 * @param {string} text the text to encrypt. Non-nullable.
 * @return {string} encrypted text
 */
SecurityUtils.prototype.encrypt = function(text){
  var cipher = crypto.createCipher(ALGORITHM, this.key);
  var crypted = cipher.update(text,'utf8','hex');
  crypted += cipher.final('hex');
  return crypted;
};

/**
 * Returns the decrypted text
 * @param {string} text encrypted text. Non-nullable.
 * @returns decrypted text
 */
SecurityUtils.prototype.decrypt = function(text){
  var decipher = crypto.createDecipher(ALGORITHM, this.key);
  var dec = decipher.update(text,'hex','utf8');
  dec += decipher.final('utf8');
  return dec;
};

module.exports = SecurityUtils;
