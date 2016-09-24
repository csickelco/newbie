/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class represents errors thrown by data access object modules.
 * 
 * @author Christina Sickelco
 */

//Used to write more secure javascript. See http://www.w3schools.com/js/js_strict.asp. 
'use strict';

//Alexa app server hotswap module will reload code changes to apps
//if this is set to 1. Handy for local development and testing
//See https://runkit.com/npm/alexa-app-server
module.change_code = 1;

/**
 * Represents an error thrown by a data access object
 * @param {operation} 	the type of activity the DAO was trying to accomplish before erroring-out. Non-nullable.
 * 						e.g. "create an activity"
 * @param {sourceError} the underlying exception/error. Nullable.
 * @param {message} details on the nature of the error. Nullable.
 * @constructor
 */
module.exports = function DaoError(operation, sourceError, message) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.operation = operation;
  this.sourceError = sourceError;
  this.message = "An error occurred while trying to " + operation;
  if( message ) {
	  this.message += ": " + message;
  }
  if( sourceError && sourceError.code) {
	  this.message += " (" + sourceError.code + ")";
  }
  if( sourceError.message ) {
	  this.message += " - " + sourceError.message;
  }
};

require('util').inherits(module.exports, Error);