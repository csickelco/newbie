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
var FeedDao = require('./feed_aws_dao');
var BabyDao = require('../baby/baby_aws_dao');
var Response = require('../common/response');
var Feed = require('./feed');
var Utils = require('../common/utils');
var Winston = require('winston');
var rp = require('request-promise');

//Properties
var feedDao = new FeedDao();
var babyDao = new BabyDao();

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

/**
 * Represents business logic for feed-related operations.
 * @constructor
 */
function FeedController () {
}

/**
 * Asynchronous operation to setup any needed feed data in the data store.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
FeedController.prototype.initFeedData = function() {
	logger.debug("initFeedData: Starting initialization...");
	return feedDao.createTable();
};

/**
 * Asynchronous operation to add (or overwrite) a new feed to the data store
 * and return a response.
 * 
 * @param 	userId {string}		the userId who performed the feed. Non-nullable.
 * @param	dateTime {Date}		the date/time the feed occurred. Non-nullable.
 * @param	feedAmount {number}	feed amount (bottle size) in ounces. Non-nullable
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
	var template = _.template("Added ${feedAmount} ounce feed for ${babyName}. " +
			"Today, ${pronoun} has eaten ${totalFeedAmt} ounces over ${numFeeds} feeds"); 
	var loadedBaby;
	var totalFeedAmt = 0;
	var numFeeds = 0;
	var feed = new Feed();
	feed.userId = userId;
	feed.dateTime = dateTime;
	feed.feedAmount = feedAmount;
	
	return feedDao.createFeed(feed)
		.then( function(result) {
			return feedDao.getFeeds(userId, dateTime);
		})
		.then( function(feedsForDayResult) 
		{
			feedsForDayResult.Items.forEach(function(item) {
	            logger.debug(" -", item.dateTime + ": " + item.feedAmount);
	            totalFeedAmt += parseInt(item.feedAmount);
	            numFeeds++;
	        });
			
			return babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) 
		{
			loadedBaby = readBabyResult.Item;	
			var babyName = loadedBaby.name;
			var responseMsg = template(
			{
				feedAmount: feedAmount,
				babyName: loadedBaby.name,
				totalFeedAmt: totalFeedAmt,
				numFeeds: numFeeds,
				pronoun: Utils.heShe(loadedBaby.sex)
			});
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

	return feedDao.getLastFeed(userId)
		.then( function(result) {
			result.Items.forEach(function(item) {
	            logger.debug("getLastFeed: lastFeed %s %s", item.dateTime, item.feedAmount);
	            lastFeedDate = new Date(item.dateTime); //TODO: Can't the DAO do this?
	            lastFeedAmt = item.feedAmount;
	        });
			return babyDao.readBaby(userId);
		}).then( function(readBabyResult) {
			var loadedBaby = readBabyResult.Item;	
			var babyName = loadedBaby.name;
			
			if(lastFeedDate) {
				var today = new Date();
				var diffMs = (today - lastFeedDate); 
				logger.debug("getLastFeed: diffMs %d", diffMs);
				var diffDays = Math.round(diffMs / 86400000); // days
				var diffHrs = Math.round((diffMs % 86400000) / 3600000); // hours
				var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes
				response.message = babyName + " last ate " + lastFeedAmt + " ounces ";
				if( diffDays > 0 ) {
					response.message += diffDays + " days ";
				}
				if( diffHrs > 0 ) {
					response.message += diffHrs + " hours and ";
				}
				if( diffMins > 0 ) {
					response.message += diffMins + " minutes ";
				}
				response.message += " ago";
			} else {
				response.message = "No previous feeding recorded";
			}
			return response;
		});
};

module.exports = FeedController;