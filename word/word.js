/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class represents a word spoken by a baby/child.
 * 
 * @property {userId} 	the unique ID of the amazon user running this application.
 * @property {dateTime}	the date/time the word was spoken
 * @property {word}		the word spoken
 * @property {partOfSpeech}	a classification of the word's part of speech
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
 * Represents a record of a word spoken
 * @constructor
 */
function Word (obj) {
	this.userId = undefined;
	this.seq = undefined;
	this.dateTime = undefined;
	this.word = undefined;
	this.partOfSpeech = undefined;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}

/**
 * @returns {string} a string representation of this object
 */
Word.prototype.toString = function wordToString() {
	  var ret = "Word, userId: " + this.userId + 
	  	", seq: " + this.seq + 
	  	", dateTime: " + this.dateTime + 
	  	", word: " + this.word + 
	  	", partOfSpeech: " + this.partOfSpeech;
	  return ret;
};

module.exports = Word;