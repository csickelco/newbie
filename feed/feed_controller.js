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
 * @property {FeedAWSDao} 		feedDao		 	- Interacts with the feed data store
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
var FeedDao = require('./feed_aws_dao');
var BabyDao = require('../baby/baby_aws_dao');
var Response = require('../common/response');
var Feed = require('./feed');
var Utils = require('../common/utils');
var ValidationUtils = require('../common/validation_utils');
var IllegalStateError = require('../common/illegal_state_error');
var ActivityLimitError = require('../common/activity_limit_error');
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
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Feed_Controller - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//Constants
/**
 * The maximum number of feeds that can be added in any given day
 */
var ADD_LIMIT = 40;

/**
 * Represents business logic for feed-related operations.
 * @constructor
 */
function FeedController () {
	this.feedDao = new FeedDao();
	this.babyDao = new BabyDao();
}

/**
 * Asynchronous operation to setup any needed feed data in the data store.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
FeedController.prototype.initFeedData = function() {
	logger.debug("initFeedData: Starting initialization...");
	return this.feedDao.createTable();
};

/**
 * Asynchronous operation to add (or overwrite) a new feed to the data store
 * and return a response.
 * 
 * @param 	userId {string}		the userId who performed the feed. Non-nullable.
 * @param	dateTime {Date}		the date/time the feed occurred. Non-nullable.
 * @param	feedAmount {number}	feed amount (bottle size) in ounces. Non-nullable.
 * 								Must be > 0.
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
FeedController.prototype.addFeed = function(userId, dateTime, feedAmount) {
	logger.debug("addFeed: Adding feed for %s, date: %s, amount: %d ounces", userId, dateTime, feedAmount);
	
	var specifiedFeedTemplate = _.template("Added ${feedAmount} ounce feed for ${babyName}. ");
	var unspecifiedFeedTemplate = _.template("Added feed for ${babyName}. ");
	
	var allBottleFeedsTemplate = _.template("Today, ${pronoun} has eaten ${totalFeedAmt} ounce${feedAmtPlural} over ${numFeeds} feed${numFeedsPlural}"); 
	var allBreastFeedsTemplate = _.template("Today, ${pronoun}'s had ${numFeeds} feed${numFeedsPlural}"); 
	var allButOneBottleFeedTemplate = _.template("Today, ${pronoun}'s had ${numFeeds} feed${numFeedsPlural}, " +
			"including ${numSpecifiedFeeds} feed of ${totalFeedAmt} ounce${specifiedFeedAmtPlural}"); 
	var mixedFeedsTemplate = _.template("Today, ${pronoun}'s had ${numFeeds} feed${numFeedsPlural}, " +
		"including ${numSpecifiedFeeds} feed${numFeedsPlural} totaling ${totalFeedAmt} ounce${specifiedFeedAmtPlural}"); 

	var loadedBaby;
	var totalFeedAmt = 0;
	var numSpecifiedFeeds = 0;
	var numUnspecifiedFeeds = 0;
	var feed = new Feed();
	feed.userId = userId;
	feed.dateTime = dateTime;
	feed.feedAmount = feedAmount;
	var self = this;
	
	//First, validate all input
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			return ValidationUtils.validateRequired("feed date and time", dateTime);
		})
		.then( function(result) {
			return ValidationUtils.validateDate("feed date and time", dateTime);
		})
		.then( function(result) {
			return ValidationUtils.validateNumber("feed amount", feedAmount);
		})
		.then( function(result) {
			return ValidationUtils.validateNumberGreaterThanOrEqualTo("feed amount", feedAmount, 0);
		})
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			return self.babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) {
			//Provided the baby exists, get all feeds for the day to provide cumulative day count in response
			//and to make sure the user has not exceeded their limits
			if(readBabyResult && readBabyResult.Item && readBabyResult.Item.name) {
				loadedBaby = readBabyResult.Item;
			} else {
				return Promise.reject(new IllegalStateError("Before recording feeds, you must first add a baby"));
			}
			return self.feedDao.getFeeds(userId, dateTime);
		})
		.then( function(feedsForDayResult) {
			//Get all the previous feeds
			feedsForDayResult.Items.forEach(function(item) {
	            logger.debug(" -", item.dateTime + ": " + item.feedAmount);
	            if( item.feedAmount ) {
	            	totalFeedAmt += parseInt(item.feedAmount);
	            	numSpecifiedFeeds++;
	            } else {
	            	numUnspecifiedFeeds++;
	            }
	        });
			
			//Add the current
			if( feedAmount ) {
            	totalFeedAmt += parseInt(feedAmount);
            	numSpecifiedFeeds++;
            } else {
            	numUnspecifiedFeeds++;
            }
			
			//Make sure the user is within their limits
			if( numSpecifiedFeeds+numUnspecifiedFeeds > ADD_LIMIT ) {
				return Promise.reject(new ActivityLimitError("You cannot add more than " + ADD_LIMIT + 
						" feeds in any given day"));
			}
			
			//Finally, persist the current in the data store
			return self.feedDao.createFeed(feed);
		})
		.then( function(createFeedResult) {
			logger.debug("FeedAmount %d, NumSpecifiedFeeds %d, NumUnspecifiedFeeds %d", feedAmount, numSpecifiedFeeds, numUnspecifiedFeeds);
			//Finally, put it all together in a response
			var babyName = loadedBaby.name;
			var responseMsg;
			//First part of the message...
			if( feedAmount ) {
				responseMsg = specifiedFeedTemplate(
						{
							feedAmount: feedAmount,
							babyName: loadedBaby.name
						}
				);
			} else {
				responseMsg = unspecifiedFeedTemplate(
						{
							babyName: loadedBaby.name
						}
				);
			}
			//Second part of the message...
			if( numUnspecifiedFeeds === 0 ) {
				responseMsg += allBottleFeedsTemplate(
				{
					feedAmtPlural: Utils.pluralizeIfNeeded(feedAmount),
					totalFeedAmt: totalFeedAmt,
					numFeeds: numSpecifiedFeeds,
					pronoun: Utils.heShe(loadedBaby.sex),
					numFeedsPlural: Utils.pluralizeIfNeeded(numSpecifiedFeeds)
				});
			} else if( numSpecifiedFeeds === 0 ) {
				responseMsg += allBreastFeedsTemplate(
				{
					numFeeds: numUnspecifiedFeeds,
					pronoun: Utils.heShe(loadedBaby.sex),
					numFeedsPlural: Utils.pluralizeIfNeeded(numUnspecifiedFeeds)
				});
			} else if( numSpecifiedFeeds === 1 ) {
				var allButOneBottleFeedTemplate = _.template("Today, ${pronoun}'s had ${numFeeds} feed${numFeedsPlural}, " +
				"including ${numSpecifiedFeeds} feed of ${totalFeedAmt} ounce${specifiedFeedAmtPlural}"); 

				responseMsg += allButOneBottleFeedTemplate(
				{
					totalFeedAmt: totalFeedAmt,
					numSpecifiedFeeds: numSpecifiedFeeds,
					numFeeds: numSpecifiedFeeds+numUnspecifiedFeeds,
					pronoun: Utils.heShe(loadedBaby.sex),
					numFeedsPlural: Utils.pluralizeIfNeeded(numSpecifiedFeeds+numUnspecifiedFeeds),
					specifiedFeedAmtPlural: Utils.pluralizeIfNeeded(totalFeedAmt)
				});
			} else {
				var mixedFeedsTemplate = _.template("Today, ${pronoun}'s had ${numFeeds} feed${numFeedsPlural}, " +
				"including ${numSpecifiedFeeds} feed${numFeedsPlural} totaling ${totalFeedAmt} ounce${specifiedFeedAmtPlural}"); 

				responseMsg += mixedFeedsTemplate(
				{
					totalFeedAmt: totalFeedAmt,
					numFeeds: numSpecifiedFeeds+numUnspecifiedFeeds,
					pronoun: Utils.heShe(loadedBaby.sex),
					numFeedsPlural: Utils.pluralizeIfNeeded(numSpecifiedFeeds+numUnspecifiedFeeds),
					numSpecifiedFeeds: numSpecifiedFeeds,
					specifiedFeedAmtPlural: Utils.pluralizeIfNeeded(totalFeedAmt)
				});
			}
			logger.debug("addFeed: Response %s", responseMsg);
			return new Response(responseMsg, "Feed", responseMsg);
		});
};

/**
 * Asynchronous operation to get the last time a feed was performed
 * and return a response. If no feedings have been performed yet,
 * a response saying as much is returned.
 * 
 * @param 	userId {string}		the userId whose feeds to return. Non-nullable.
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
FeedController.prototype.getLastFeed = function(userId) {
	var lastFeedAmt;
	var lastFeedDate;
	var response = new Response();
	var self = this;
	var loadedBaby
	
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			return self.babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) {
			//Then, get the last feed in the datastore provided the baby exists
			if(readBabyResult && readBabyResult.Item && readBabyResult.Item.name) {
				loadedBaby = readBabyResult.Item;
			} else {
				return Promise.reject(new IllegalStateError("Before checking feeds, you must first add a baby"));
			}
			return self.feedDao.getLastFeed(userId);
		}).then( function(result) {
			//Then put it all together in a response
			result.Items.forEach(function(item) {
	            logger.debug("getLastFeed: lastFeed %s %s", item.dateTime, item.feedAmount);
	            lastFeedDate = new Date(item.dateTime); //TODO: Can't the DAO do this?
	            lastFeedAmt = item.feedAmount;
	        });
			var babyName = loadedBaby.name;
			
			if(lastFeedDate) {
				var today = new Date();
				var timeDiff = Utils.calculateDuration(lastFeedDate, today);
				response.message = babyName + " last ate ";
				if( lastFeedAmt ) {
					response.message += lastFeedAmt + " ounce" + Utils.pluralizeIfNeeded(lastFeedAmt) + " ";
				} 
				response.message += timeDiff + " ago";
			} else {
				response.message = "No previous feeding recorded";
			}
			return response;
		});
};

/**
 * Asynchronous operation to remove the most recent feed entry from the data store
 * and return a response.
 * 
 * @param 	userId {string}		the userId whose last feed entry to remove. Non-nullable.
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
FeedController.prototype.removeLastFeed = function(userId) {
	logger.debug("removeLastFeed: Removing feed for %s", userId);
	var loadedBaby;	
	var self = this;
	var feedAmount;
	var lastFeedDateTime;

	//First, validate all input arguments
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			return self.babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) {
			//Then, get the most recent feed entry from the datastore provided the baby exists
			if(readBabyResult && readBabyResult.Item && readBabyResult.Item.name) {
				loadedBaby = readBabyResult.Item;
			} else {
				return Promise.reject(new IllegalStateError("Before removing feeds, you must first add a baby"));
			}
			return self.feedDao.getLastFeed(userId);
		})
		.then( function(getLastFeedResult) {
			//TODO: Handle the case where there are no feed entries
			getLastFeedResult.Items.forEach(function(item) {
	            logger.debug("getLastFeed: lastFeed %s %d", item.dateTime, item.feedAmount);
	            lastFeedDateTime = new Date(item.dateTime); //TODO: Can't the DAO do this?
	            feedAmount = item.feedAmount;
	        });
			
			//Then delete that feed
			if( lastFeedDateTime ) {
				logger.debug("Deleting feed");
				return self.feedDao.deleteFeed(userId, new Date(lastFeedDateTime));
			} else {
				return Promise.resolve();
			}
		})
		.then( function(deleteFeedResult) 
		{
			logger.debug("Delete feed result: %s", JSON.stringify(deleteFeedResult));
			//Finally, put it all together in a response
			var babyName = loadedBaby.name;
			var responseMsg;
			if( lastFeedDateTime ) {
				responseMsg = "Removed ";
				if( feedAmount ) {
					responseMsg += feedAmount + " ounce ";
				} else {
					responseMsg += "last ";
				}
				responseMsg += "feed for " + babyName + "."; 
			} else {
				responseMsg =  "No previous feed entries recorded for " + babyName;
			}
			logger.debug("removeFeed: Response %s", responseMsg);
			return new Response(responseMsg, "Feed", responseMsg);
		});
};

module.exports = FeedController;