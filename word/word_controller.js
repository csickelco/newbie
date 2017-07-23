/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class handles business logic for word-related operations.
 * 
 * @property {WordAWSDao} 	wordDao 	- Interacts with the word data store
 * @property {BabyAWSDao} 	babyDao			- Interacts with the baby data store
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
var Word = require('./word');
var IllegalArgumentError = require('../common/illegal_argument_error');
var IllegalStateError = require('../common/illegal_state_error');
var ActivityLimitError = require('../common/activity_limit_error');
var ValidationUtils = require('../common/validation_utils');
var Response = require('../common/response');
var Winston = require('winston');
var Utils = require('../common/utils');

//Configure the logger with basic logging template
var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Word_Controller - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//Constants
/**
 * The maximum number of words that can be added for a given user
 */
var ADD_LIMIT = 1000;

/**
 * Represents business logic for word-related operations.
 * @constructor
 */
function WordController (wordDao, babyDao) {
	this.wordDao = wordDao;
	this.babyDao = babyDao;
}

/**
 * Asynchronous operation to setup any needed word data in the data store.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the table
 * 			creation succeeded, else returns a rejected promise with a 
 * 			DaoError if an error occurred creating the table in the data store.
 */
WordController.prototype.initWordData = function() {
	logger.debug("initWordData: Starting initialization...");
	return this.wordDao.createTable();
};

/**
 * Asynchronous operation to add (or overwrite) a new word to the data store
 * and return a response.
 * 
 * @param 	{string} userId				the userId of the user entering in the word records. Non-nullable.
 * @param	{Word} word					word spoken (e.g. "mom"). Non-nullable.					
 * @param	{Date} dateTime				the date/time the word occurred. Non-nullable.
 * @param 	{string} baby				the name of the baby to add the word for. Nullable.
 * 										If not specified, the word is assumed to be for the most
 * 										recently added baby.
 * 
 * @return 	{Promise<Response>|IllegalArgumentError, IllegalStateError, DaoError} 				
 * 										promise containing a response with both a verbal message and written card,
 *  									providing confirmation of the added word.
 *  									Rejected promise with IllegalArgumentError if no word or userId was specified.
 *  									Rejected promise with IllegalStateError if the user has not yet added a baby.  
 *  									Rejected promise with DaoError if an error occurred interacting with the data store while attempting
 * 										to add the word. 
 */
WordController.prototype.addWord = function(userId, word, dateTime, baby) {
	logger.debug("addWord: Adding word for %s, date: %s, word: %s, baby: %s", 
			userId, dateTime, word, baby);
	
	var template = _.template("Added word ${word} for ${babyName}. ${pronoun} now knows ${wordCount} words.");
	var firstWordTemplate = _.template("Added word ${word} for ${babyName}. This is ${pronoun} first word!");
	var alreadyAddedTemplate = _.template("The word ${word} was added previously for ${babyName}.");
	var loadedBaby;
	var wordObj = new Word();
	var self = this;
	var babyName;
	var totalWordCount = 0;
	
	//First, validate our required arguments
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result){
			return ValidationUtils.validateRequired("the word name ", word);
		})
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			if( baby ) {
				logger.debug("addWord: Retrieving baby %s...", baby);
				return self.babyDao.readBabyByName(userId, baby);
			} else {
				return self.babyDao.readBaby(userId);
			}
		})
		.then( function(readBabyResult) 
		{
			//Provided baby exists, get a count of words for the day 
			//to make sure the user has not exceeded their limits
			if(readBabyResult) {
				loadedBaby = readBabyResult;
				babyName = loadedBaby.name;
				wordObj.userId = userId;
				wordObj.dateTime = dateTime;
				wordObj.word = word;
				wordObj.seq = loadedBaby.seq;
				wordObj.timezone = loadedBaby.timezone;

				return self.wordDao.getWordCount(wordObj.userId, loadedBaby.seq);
			} else {
				if(baby) {
					return Promise.reject(new IllegalStateError(
							"Before recording words for " + baby + ", you must first add " + baby + 
							" by saying 'tell Newbie Log to add baby'"));
				} else {
					return Promise.reject(new IllegalStateError("Before recording words, you must first add a baby"));
				}
			}
		})
		.then( function(wordCountResult) 
		{
			logger.debug("addWord: Word count: %d", wordCountResult);
			totalWordCount = wordCountResult + 1; //All words for the day plus the one we're trying to add
			
			if( totalWordCount > ADD_LIMIT ) {
				return Promise.reject(new ActivityLimitError("You cannot add more than " + ADD_LIMIT + 
					" words in any given day"));
			} else {
				//Assuming they haven't exceeded the word limit, go ahead and create this one
				return self.wordDao.createWord(wordObj);
			}
		})
		.then( function(createWordResult)
		{
			logger.debug("addWord: createWordResult %s", JSON.stringify(createWordResult));
			//Finally, build the response confirming the add
			var responseMsg;
			
			if( createWordResult && createWordResult.Attributes) {
				//If the word was recorded already, it is returned by the dao
				responseMsg = alreadyAddedTemplate(
						{
							word: word,
							babyName: loadedBaby.name
						});
			} else if( totalWordCount === 1 ) {
				responseMsg = firstWordTemplate(
						{
							word: word,
							babyName: loadedBaby.name,
							pronoun : Utils.hisHer(loadedBaby.sex)
						});
			} else {
				responseMsg = template(
					{
						word: word,
						babyName: loadedBaby.name,
						pronoun : Utils.heShe(loadedBaby.sex, true),
						wordCount : totalWordCount
					});
			}
			logger.debug("addWord: Response %s", responseMsg);
			return new Response(responseMsg, "Word", responseMsg);
		});
};

/**
 * Asynchronous operation to get a count of the total number of words
 * spoken by the given baby.
 * 
 * @param 	userId {string}				the userId for the user whose child's word count to retrieve. Non-nullable.
 * @param 	{string} baby				the name of the baby to count words for. Nullable.
 * 										If not specified, the word count is assumed to be for the most
 * 										recently added baby.
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
WordController.prototype.getWordCount = function(userId, baby) {
	logger.debug("getWordCount: Getting word count for %s %s", userId, baby);
	var loadedBaby;	
	var self = this;
	var lastWord;
	var lastWordDateTime;

	//First, validate all input arguments
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			if( baby ) {
				logger.debug("getWordCount: Getting word count for %s", baby);
				return self.babyDao.readBabyByName(userId, baby);
			} else {
				return self.babyDao.readBaby(userId);
			}
		})
		.then( function(readBabyResult) {
			//Then, get the most recent word count from the datastore provided the baby exists
			if(readBabyResult) {
				loadedBaby = readBabyResult;
			} else {
				if(baby) {
					return Promise.reject(new IllegalStateError(
							"Before counting words for " + baby + ", you must first add " + baby + 
							" by saying 'tell Newbie Log to add baby'"));
				} else {
					return Promise.reject(new IllegalStateError("Before counting words, you must first add a baby"));
				}
			}
			return self.wordDao.getWordCount(userId, loadedBaby.seq);
		})
		.then( function(wordCountResult) 
		{
			logger.debug("getWordCount: %s", JSON.stringify(wordCountResult));
			//Finally, put it all together in a response
			var babyName = loadedBaby.name;
			var responseMsg;
			responseMsg = babyName + " knows " + wordCountResult + " words."; 
			logger.debug("getWordCount: Response %s", responseMsg);
			return new Response(responseMsg, "Word Count", responseMsg);
		});
};

module.exports = WordController;