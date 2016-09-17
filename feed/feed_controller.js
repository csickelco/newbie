/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;
var _ = require('lodash');
//var FeedDao = require('./feed_dao');
var FeedDao = require('./feed_aws_dao');
var BabyDao = require('../baby/baby_aws_dao');
var Response = require('../common/response');
var Feed = require('./feed');
var Winston = require('winston');
var rp = require('request-promise');

var feedDao = new FeedDao();
var babyDao = new BabyDao();
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

function FeedController () {
}

FeedController.prototype.initFeedData = function() {
	logger.info("initFeedData: Starting initialization...");
	return feedDao.createTable();
};

FeedController.prototype.addFeed = function(userId, dateTime, feedAmount) {
	//TODO: When productionizing, eliminate log stmt due to privacy concerns
	//TODO: Provide option to use different units
	logger.info("addFeed: Adding feed for %s, date: %s, amount: %d ounces", userId, dateTime, feedAmount);
	var template = _.template("Added ${feedAmount} ounce feed for ${babyName}. " +
			"Today, she has eaten ${totalFeedAmt} ounces over ${numFeeds} feeds"); //TODO: replace she with proper prononun
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
				numFeeds: numFeeds
			});
			logger.info("addFeed: Response %s", responseMsg);
			return new Response(responseMsg, "Feed", responseMsg);
		});
};

FeedController.prototype.getLastFeed = function(userId) {
	var lastFeedAmt;
	var lastFeedDate;
	var response = new Response();

	return feedDao.getLastFeed(userId)
		.then( function(result) {
			//TODO: make a feed object
			result.Items.forEach(function(item) {
	            logger.info("getLastFeed: lastFeed %s %s", item.dateTime, item.feedAmount);
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
				logger.info("getLastFeed: diffMs %d", diffMs);
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