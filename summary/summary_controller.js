/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class handles business logic for summary-related operations.
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
var FeedDao = require('../feed/feed_aws_dao');
var BabyDao = require('../baby/baby_aws_dao');
var WeightDao = require('../weight/weight_aws_dao');
var Summary = require('./summary');
var FeedSummary = require('./feed_summary');
var DiaperSummary = require('./diaper_summary');
var DiaperDao= require('../diaper/diaper_aws_dao');
var ActivityDao = require('../activity/activity_aws_dao');
var SleepDao = require('../sleep/sleep_aws_dao');
var Utils = require('../common/utils');
var Response = require('../common/response');
var Winston = require('winston');

//Properties
var feedDao = new FeedDao();
var babyDao = new BabyDao();
var weightDao = new WeightDao();
var diaperDao = new DiaperDao();
var activityDao = new ActivityDao();
var sleepDao = new SleepDao();

//Configure the logger with basic logging template
var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Summary_Controller - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

/**
 * Represents business logic for feed-related operations.
 * @constructor
 */
function SummaryController () {
}

/**
 * Asynchronous operation to get a summary of the baby for the week.
 * 
 * @param 	userId	{string}	the userId whose summary to return. Non-nullable.
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
SummaryController.prototype.getWeeklySummary = function(userId) {
	logger.debug("getWeeklySummary: getting weekly summary for userId %s", userId);
	var response = new Response();
	var weeklySummary = new Summary();
	var today = new Date();
	var aWeekAgo = new Date();
	aWeekAgo.setDate(today.getDate()-7);
	aWeekAgo.setHours(0);
	aWeekAgo.setMinutes(0);
	aWeekAgo.setSeconds(0);
	aWeekAgo.setMilliseconds(0);
	
	var feedMap = new Map();
	var diaperMap = new Map();
	var sleepMap = new Map();
	var weightMap = new Map();
	
	return babyDao.readBaby(userId)
		.then( function(readBabyResult) {
			weeklySummary.name = readBabyResult.Item.name;
			weeklySummary.sex = readBabyResult.Item.sex;
			weeklySummary.age = Utils.calculateAgeFromBirthdate(new Date(readBabyResult.Item.birthdate));
			logger.debug("getWeeklySummary: baby name %s, age %s", weeklySummary.name, weeklySummary.age);
			
			//TODO: Maybe put an end-bound of today? So we don't get today's partial results?
			return feedDao.getFeeds(userId, aWeekAgo);
		}).then( function(feedsForWeekResult) {
			feedsForWeekResult.Items.forEach(function(item) {
	            //YYYY-MM-DD
	            var dateKey = item.dateTime.substring(0, 10);
	            var feedSummary = feedMap.get(dateKey);
	            if( !feedSummary ) {
	            	feedSummary = new FeedSummary();
	            } 
	            feedSummary.totalFeedAmount += parseInt(item.feedAmount);
	            feedSummary.numFeedings++;
	            feedMap.set(dateKey, feedSummary);
	            logger.debug("getWeeklySummary: Put in feedMap %s - %s", dateKey, feedSummary.toString());
	        });
			return diaperDao.getDiapers(userId, aWeekAgo);
		}).then( function(diapersForWeekResult) {
			diapersForWeekResult.Items.forEach(function(item) {
	            //YYYY-MM-DD
	            var dateKey = item.dateTime.substring(0, 10);
	            var diaperSummary = diaperMap.get(dateKey);
	            if( !diaperSummary ) {
	            	diaperSummary = new DiaperSummary();
	            } 
	            if(item.isWet) {
	            	diaperSummary.numWetDiapers++;
	            }
	            if(item.isDirty) {
	            	diaperSummary.numDirtyDiapers++;
	            }
	            diaperMap.set(dateKey, diaperSummary);
	            logger.debug("getWeeklySummary: Put in diaperMap %s - %s", dateKey, diaperSummary.toString());
	        });
			return sleepDao.getSleep(userId, aWeekAgo);
		}).then( function(sleepForWeekResult) {
			//todo: refactor this logic so we're not duplicating
			sleepForWeekResult.Items.forEach(function(item) {
	            if( item.sleepDateTime && item.wokeUpDateTime ) {
	            	var dateKey = item.sleepDateTime.substring(0, 10);
	            	var millisecondsOfSleep = sleepMap.get(dateKey);
	            	if(!millisecondsOfSleep) {
	            		millisecondsOfSleep = 0;
	            	}
	            	var sleepStart = new Date(item.sleepDateTime);
	            	var sleepEnd = new Date(item.wokeUpDateTime);
	            	millisecondsOfSleep += (sleepEnd.getTime() - sleepStart.getTime());
	            	sleepMap.set(dateKey, millisecondsOfSleep);
	            	logger.debug("getWeeklySummary: Put in sleepMap %s - %s", dateKey, millisecondsOfSleep);
				}
	        });
			return weightDao.getWeight(userId, aWeekAgo);
		}).then( function(weightForWeekResult) {
			weightForWeekResult.Items.forEach(function(item) {
	            if( item.weight ) {
	            	var dateKey = item.date.substring(0, 10);
	            	var ounces = item.weight;
	            	weightMap.set(dateKey, ounces);
	            	logger.debug("getWeeklySummary: Put in weightMap %s - %s", dateKey, ounces);
				}
	        });
			
			//Calculate feeding averages
			var totalNumFeedings = 0;
			var totalFeedAmount = 0;
			feedMap.forEach(function(value, key) 
			{
				totalNumFeedings += value.numFeedings;
				totalFeedAmount += value.totalFeedAmount;
			}, feedMap);
			var numDaysWithFeedsRecorded = feedMap.size;
			weeklySummary.totalFeedAmount = Math.round(totalFeedAmount/numDaysWithFeedsRecorded);
			weeklySummary.numFeedings = Math.round(totalNumFeedings/numDaysWithFeedsRecorded);
			
			//Calculate diaper averages
			var totalNumWetDiapers = 0;
			var totalNumDirtyDiapers = 0;
			diaperMap.forEach(function(value, key) 
			{
				totalNumWetDiapers += value.numWetDiapers;
				totalNumDirtyDiapers += value.numDirtyDiapers;
			}, diaperMap);
			var numDaysWithDiapersRecorded = diaperMap.size;
			weeklySummary.numWetDiapers = Math.round(totalNumWetDiapers/numDaysWithDiapersRecorded);
			weeklySummary.numDirtyDiapers = Math.round(totalNumDirtyDiapers/numDaysWithDiapersRecorded);
			
			//Calculate sleep averages
			var totalSleep = 0;
			sleepMap.forEach(function(value, key) 
			{
				totalSleep += value;
			}, sleepMap);
			var numDaysWithSleepRecorded = sleepMap.size;
			weeklySummary.sleep = Utils.formatDuration(Math.round(totalSleep/numDaysWithSleepRecorded));
			
			//Calculate weight differences
			var lastWeightRecorded;
			var dateOfLastWeightRecorded;
			var earliestWeightRecorded;
			var dateOfEarliestWeightRecorded;
			var weightDifferenceInOunces;
			var weightDifferenceNumDays;
			weightMap.forEach(function(value, key) 
			{
				logger.debug("WEIGHT %s, %s", key, value);
				if(!dateOfLastWeightRecorded || key > dateOfLastWeightRecorded) {
					dateOfLastWeightRecorded = key;
					lastWeightRecorded = value;
				}
				if(!dateOfEarliestWeightRecorded || key < dateOfEarliestWeightRecorded) {
					dateOfEarliestWeightRecorded = key;
					earliestWeightRecorded = value;
				}
			}, weightMap);
			logger.debug("Most recent weight of %d ounces recorded on %s", lastWeightRecorded, dateOfLastWeightRecorded);
			if(dateOfEarliestWeightRecorded && dateOfLastWeightRecorded && dateOfEarliestWeightRecorded !== dateOfLastWeightRecorded) {
				weightDifferenceInOunces = lastWeightRecorded - earliestWeightRecorded; //TODO: Handle negative weight difference
				var dateOfEarliestWeightRecordedDate = new Date(dateOfEarliestWeightRecorded);
				var dateOfLastWeightRecordedDate = new Date(dateOfLastWeightRecorded);
				var timeDiff = Math.abs(dateOfLastWeightRecordedDate.getTime() - dateOfEarliestWeightRecordedDate.getTime());
				weightDifferenceNumDays = Math.ceil(timeDiff / (1000 * 3600 * 24)); 
			}
			weeklySummary.weightInOunces = lastWeightRecorded;
			
			//TODO: Does this belong in controller?
			//TODO: This could probably be a method in summary
			var responseMsg = 
				weeklySummary.name +
				" is now " + weeklySummary.age + " old";
			var responseCard = "Age: " + weeklySummary.age + "\n";
			if( weeklySummary.weightInOunces > 0 ) {
				responseMsg += " and weighs " + Utils.getPoundsAndOuncesString(weeklySummary.weightInOunces);
				responseCard += "Weight: " + Utils.getPoundsAndOuncesString(weeklySummary.weightInOunces) + "\n";
			}
			if( weightDifferenceInOunces && weightDifferenceNumDays ) {
				responseMsg += ". " + Utils.heShe(weeklySummary.sex, true) + " gained " + weightDifferenceInOunces + " ounce" + Utils.pluralizeIfNeeded(weightDifferenceInOunces) + " in " + weightDifferenceNumDays + " day" + Utils.pluralizeIfNeeded(weightDifferenceNumDays);
				responseCard += "Weight gain: " + weightDifferenceInOunces + " ounces over " + weightDifferenceNumDays + " days\n";
			}
			responseMsg += ". On average, " + Utils.heShe(weeklySummary.sex) + " ate " + weeklySummary.numFeedings + " time" + Utils.pluralizeIfNeeded(weeklySummary.numFeedings) + " for a total of " +
				weeklySummary.totalFeedAmount + " ounce" + Utils.pluralizeIfNeeded(weeklySummary.totalFeedAmount) +
				" and had " + weeklySummary.numWetDiapers + " wet and " +
				weeklySummary.numDirtyDiapers + " dirty diaper" + Utils.pluralizeIfNeeded(weeklySummary.numDirtyDiapers) + " per day. ";
			responseCard += "Average number of feedings per day: " + weeklySummary.numFeedings + "\n";
			responseCard += "Average feeding amount per day: " + weeklySummary.totalFeedAmount + " ounces\n";
			responseCard += "Average number of wet diapers per day: " + weeklySummary.numWetDiapers + "\n";
			responseCard += "Average number of dirty diapers per day: " + weeklySummary.numDirtyDiapers + "\n";
			if( weeklySummary.sleep ) {
				responseMsg += "Each day, " + Utils.heShe(loadedBaby.sex) + " generally slept about " + weeklySummary.sleep; //TODO: replace she with proper prononun
				responseCard += "Average amount of sleep per day: " + weeklySummary.sleep + "\n";
			}
			
			response.message = responseMsg;
			response.setCard("Weekly Summary", responseCard);
			
			//TODO: Add activities
			logger.debug("getWeeklySummary: Response %s", response.toString());
			return response;
		});
};

/**
 * Asynchronous operation to get a summary of the baby for the current day.
 * 
 * @param 	userId	{string}	the userId whose summary to return. Non-nullable.
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
SummaryController.prototype.getDailySummary = function(userId) {
	logger.debug("getDailySummary: getting daily summary for userId %s", userId);
	var dailySummary = new Summary();
	var today = new Date();
	var activities = new Set();
	var response = new Response();
	
	return babyDao.readBaby(userId)
		.then( function(readBabyResult) {
			dailySummary.name = readBabyResult.Item.name;
			dailySummary.age = Utils.calculateAgeFromBirthdate(new Date(readBabyResult.Item.birthdate));
			dailySummary.sex = readBabyResult.Item.sex;
			logger.debug("getDailySummary: baby name %s, age %s", dailySummary.name, dailySummary.age);
			return feedDao.getFeeds(userId, today);
		})
		.then( function(feedsForDayResult) {
			feedsForDayResult.Items.forEach(function(item) {
	            logger.debug("getDailySummary: %s - %s", item.dateTime, item.feedAmount);
	            dailySummary.totalFeedAmount += parseInt(item.feedAmount);
	            dailySummary.numFeedings++;
	        });
			return weightDao.getWeight(userId, today);
		})
		.then( function(weightForDayResult) {
			logger.debug("getDailySummary: weightForDayResult.Items %s", JSON.stringify(weightForDayResult));
			if( weightForDayResult.Items.length > 0 ) {
				logger.debug("getDailySummary: weightInOunces %d", weightForDayResult.Items[weightForDayResult.Items.length-1].weight);
				dailySummary.weightInOunces = weightForDayResult.Items[weightForDayResult.Items.length-1].weight;
			} else {
				logger.debug("getDailySummary: no weight recorded today");
			}
			return diaperDao.getDiapers(userId, today);
		})
		.then( function(diapersForDayResult) {
			logger.debug("getDailySummary: diapersForDayResult.Items %s", JSON.stringify(diapersForDayResult));
			//todo: refactor this logic so we're not duplicating
			diapersForDayResult.Items.forEach(function(item) {
	            logger.debug(" -", item.dateTime + ": " + item.isWet + ", " + item.isDirty);
	            if(item.isWet) {
	            	dailySummary.numWetDiapers++;
	            }
	            if(item.isDirty) {
	            	dailySummary.numDirtyDiapers++;
	            }
	        });
			return activityDao.getActivitiesForDay(userId, today);
		})
		.then( function(activitiesForDayResult) {
			logger.debug("getDailySummary: activitiesForDayResult.Items %s", JSON.stringify(activitiesForDayResult));
			//todo: refactor this logic so we're not duplicating
			activitiesForDayResult.Items.forEach(function(item) {
	            logger.debug("getDailySummary: activity -- ", item.dateTime + ": " + item.activity);
	            activities.add(item.activity);
	        });
			logger.debug("getDailySummary: activities size -- %s", activities.size);
			return sleepDao.getSleep(userId, today);
		})
		.then( function(sleepsForDayResult) {
			logger.debug("getDailySummary: sleepsForDayResult.Items %s", JSON.stringify(sleepsForDayResult));
			var totalMillisecondsOfSleep = 0;
			//todo: refactor this logic so we're not duplicating
			sleepsForDayResult.Items.forEach(function(item) {
	            logger.debug("getDailySummary: sleep -- ", item.sleepDateTime + " - " + item.wokeUpDateTime);
	            if( item.sleepDateTime && item.wokeUpDateTime ) {
	            	var sleepStart = new Date(item.sleepDateTime);
	            	var sleepEnd = new Date(item.wokeUpDateTime);
	            	totalMillisecondsOfSleep += (sleepEnd.getTime() - sleepStart.getTime());
				}
	        });
			logger.debug("getDailySummary: totalMillisecondsOfSleep -- %d", totalMillisecondsOfSleep);
			if( totalMillisecondsOfSleep > 0 ) {
				dailySummary.sleep = Utils.formatDuration(totalMillisecondsOfSleep);
			}
			logger.debug("getDailySummary: dailySummary -- %s", dailySummary.toString());
		
			//Format message and cards
			//TODO: Does this belong in controller?
			//TODO: This could probably be a method in summary or a helper method
			var responseCard = "Age: " + dailySummary.age + "\n";
			var responseMsg = 
				"Today, " + dailySummary.name +
				" is " + dailySummary.age + " old";
			if( dailySummary.weightInOunces > 0 ) {
				responseMsg += " and weighs " + Utils.getPoundsAndOuncesString(dailySummary.weightInOunces);
				responseCard += "Weight: " + Utils.getPoundsAndOuncesString(dailySummary.weightInOunces) + "\n";
			}
			responseMsg += ". " + Utils.heShe(dailySummary.sex, true) + " ate " + dailySummary.numFeedings + " time" + Utils.pluralizeIfNeeded(dailySummary.numFeedings) + " for a total of " +
				dailySummary.totalFeedAmount + " ounce" + Utils.pluralizeIfNeeded(dailySummary.totalFeedAmount) + " " +
				"and had " + dailySummary.numWetDiapers + " wet diaper" + Utils.pluralizeIfNeeded(dailySummary.numWetDiapers) + " and " +
				dailySummary.numDirtyDiapers + " dirty diaper" + Utils.pluralizeIfNeeded(dailySummary.numDirtyDiapers) + ". ";
			responseCard += "Number of feedings: " + dailySummary.numFeedings + "\n";
			responseCard += "Total feeding amount: " + dailySummary.totalFeedAmount + "\n";
			responseCard += "Number of wet diapers: " + dailySummary.numWetDiapers + "\n";
			responseCard += "Number of dirty diapers: " + dailySummary.numDirtyDiapers + "\n";
			if( dailySummary.sleep ) {
				responseMsg += Utils.heShe(dailySummary.sex, true) + " slept " + dailySummary.sleep + ". "; 
				responseCard += "Sleep: " + dailySummary.sleep + "\n";
			}
			if(activities.size > 0 ) {
				responseCard += "Activities:\n";
				responseMsg += "Today's activities included ";
				var activitiesAsArray = Array.from(activities);
				for (var i = 0; i < activitiesAsArray.length; i++) {
					responseMsg += activitiesAsArray[i];
				    if( i < activitiesAsArray.length - 2 ) {
				    	responseMsg += ", ";
				    }
				    if( i === activitiesAsArray.length - 2 ) {
				    	responseMsg += " and ";
				    }
				    responseCard += activitiesAsArray[i] + "\n";
				}
			}
			response.message = responseMsg;
			response.setCard("Daily Summary", responseCard);
			logger.debug("getDailySummary: Response %s", response.toString());
			return response;
		});
};

module.exports = SummaryController;