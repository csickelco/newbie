/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class represents a response returned from Newbie to the Alexa app.
 * It contains both a verbal message that Alexa should speak as well as
 * a written message for cards delivered to the Alexa app on smartphones
 * and the web.
 * 
 * @property {message} 	the verbal message that Alexa should speak in response
 * 						to some operation
 * @property {cardBody}	the text Alexa should include in a card delivered to
 * 						the alexa app in response to some operation
 * @property {cardTitle}	the title Alexa should include on the card delivered to
 * 							the alexa app in response to some operation
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
 * Represents a Response given to the Alexa app
 * @constructor
 */
function Response (obj) {
	this.message = undefined;
	this.cardBody = undefined;
	this.cardTitle = undefined;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}

/**
 * Represents a response given to the Alexa app
 * @param message {string} the verbal message Alexa should speak
 * @param cardTitlePrefix {string} the title on the card Alexa should send to the app
 * @param cardBody {string} the body text of the card Alexa should send to the app
 * 
 * @constructor
 */
function Response(message, cardTitlePrefix, cardBody) {
	this.message = message;
	this.setCard(cardTitlePrefix, cardBody);
}

/**
 * Sets the card that should be sent to the Alexa app
 * @param cardTitlePrefix {string} the title on the card Alexa should send to the app
 * @param cardBody {string} the body text of the card Alexa should send to the app
 */
Response.prototype.setCard = function(cardTitlePrefix, cardBody) {
	this.cardTitle = cardTitlePrefix + " - " + new Date().toLocaleDateString("en-US");
	this.cardBody = cardBody;
};

/**
 * @returns {string} a string representation of this object
 */
Response.prototype.toString = function responseToString() {
	  var ret = 'Response, message: ' + this.message + ",cardTitle: " + this.cardTitle + ", cardBody: " + this.cardBody;
	  return ret;
};

module.exports = Response;