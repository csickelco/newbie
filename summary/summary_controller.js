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
 * @property {ActivityAWSDao} 	activityDao 	- Interacts with the activity data store
 * @property {BabyAWSDao} 		babyDao			- Interacts with the baby data store
 * @property {DiaperAWSDao} 	diaperDao		- Interacts with the diaper data store
 * @property {FeedAWSDao} 		feedDao 		- Interacts with the feed data store
 * @property {SleepAWSDao} 		sleepDao		- Interacts with the sleep data store
 * @property {WeightAWSDao} 	weightDao		- Interacts with the weight data store
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
var Summary = require('./summary');
var FeedSummary = require('./feed_summary');
var DiaperSummary = require('./diaper_summary');
var Utils = require('../common/utils');
var ValidationUtils = require('../common/validation_utils');
var IllegalStateError = require('../common/illegal_state_error');
var Response = require('../common/response');
var Winston = require('winston');

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
function SummaryController (feedDao, babyDao, weightDao, diaperDao, activityDao, sleepDao) {
	this.feedDao = feedDao;
	this.babyDao = babyDao;
	this.weightDao = weightDao;
	this.diaperDao = diaperDao;
	this.activityDao = activityDao;
	this.sleepDao = sleepDao;
}

/**
 * Asynchronous operation to get a summary of the baby for the week.
 * 
 * @param 	userId	{string}	the userId whose summary to return. Non-nullable.
 * @param 	{string} baby				the name of the baby to get the summary for. Nullable.
 * 										If not specified, the summary is assumed to be for the most
 * 										recently added baby.
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
SummaryController.prototype.getWeeklySummary = function(userId, baby) {
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
	var self = this;
	
	var feedMap = new Map();
	var diaperMap = new Map();
	var sleepMap = new Map();
	var weightMap = new Map();
	var loadedBaby;
	
	//First, check arguments
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			if( baby ) {
				logger.debug("getWeeklySummary: Getting summary for %s", baby);
				return self.babyDao.readBabyByName(userId, baby);
			} else {
				return self.babyDao.readBaby(userId);
			}
		})
		.then( function(readBabyResult) {
			//Then, get feeds from the datastore provided the baby exists
			if(readBabyResult) {
				loadedBaby = readBabyResult;
				weeklySummary.name = readBabyResult.name;
				weeklySummary.sex = readBabyResult.sex;
				if( readBabyResult.birthdate ) {
					weeklySummary.age = Utils.calculateAgeFromBirthdate(new Date(readBabyResult.birthdate));
				}
				logger.debug("getWeeklySummary: baby name %s, age %s", weeklySummary.name, weeklySummary.age);
				
				//TODO: Maybe put an end-bound of today? So we don't get today's partial results?
				return self.feedDao.getFeeds(userId, loadedBaby.seq, aWeekAgo, readBabyResult.timezone);
			} else {
				if(baby) {
					return Promise.reject(new IllegalStateError(
							"Before getting a summary for " + baby + ", you must first add " + baby + 
							" by saying 'tell Newbie to add baby'"));
				} else {
					return Promise.reject(new IllegalStateError("Before getting a summary, you must first add a baby"));
				}
			}
		}).then( function(feedsForWeekResult) {
			//Process the returned feeds
			feedsForWeekResult.Items.forEach(function(item) {
	            //YYYY-MM-DD
	            var dateKey = item.dateTime.substring(0, 10);
	            var feedSummary = feedMap.get(dateKey);
	            if( !feedSummary ) {
	            	feedSummary = new FeedSummary();
	            } 
	            if( item.feedAmount ) {
	            	feedSummary.totalFeedAmount += parseInt(item.feedAmount);
	            	feedSummary.numSpecifiedFeedings++;
	            } else {
	            	feedSummary.numUnspecifiedFeedings++;
	            }
	            feedMap.set(dateKey, feedSummary);
	            logger.debug("getWeeklySummary: Put in feedMap %s - %s", dateKey, feedSummary.toString());
	        });
			//Next get diapers
			return self.diaperDao.getDiapers(userId, loadedBaby.seq, aWeekAgo, loadedBaby.timezone);
		}).then( function(diapersForWeekResult) {
			//Process returned diapers
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
			//Next get sleep
			return self.sleepDao.getSleep(userId, loadedBaby.seq, aWeekAgo, loadedBaby.timezone);
		}).then( function(sleepForWeekResult) {
			//Process returned sleep
			//TODO: refactor this logic so we're not duplicating
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
			//Finally get weight
			return self.weightDao.getWeight(userId, loadedBaby.seq, aWeekAgo, loadedBaby.timezone);
		}).then( function(weightForWeekResult) {
			if( weightForWeekResult ) {
				weightForWeekResult.Items.forEach(function(item) {
		            if( item.weight ) {
		            	var dateKey = item.date.substring(0, 10);
		            	var ounces = item.weight;
		            	weightMap.set(dateKey, ounces);
		            	logger.debug("getWeeklySummary: Put in weightMap %s - %s", dateKey, ounces);
					}
		        });
			}
			//Calculate feeding averages
			var totalNumSpecifiedFeedings = 0;
			var totalNumUnspecifiedFeedings = 0;
			var totalFeedAmount = 0;
			feedMap.forEach(function(value, key) 
			{
				totalNumSpecifiedFeedings += value.numSpecifiedFeedings;
				totalNumUnspecifiedFeedings += value.numUnspecifiedFeedings;
				if( value.totalFeedAmount ) {
					totalFeedAmount += value.totalFeedAmount;
				}
			}, feedMap);
			var numDaysWithFeedsRecorded = feedMap.size;
			if(numDaysWithFeedsRecorded > 0) {
				weeklySummary.totalFeedAmount = Math.round(totalFeedAmount/numDaysWithFeedsRecorded);
				weeklySummary.numFeedings = Math.round((totalNumSpecifiedFeedings+totalNumUnspecifiedFeedings)/numDaysWithFeedsRecorded);
			}
			//Calculate diaper averages
			var totalNumWetDiapers = 0;
			var totalNumDirtyDiapers = 0;
			diaperMap.forEach(function(value, key) 
			{
				totalNumWetDiapers += value.numWetDiapers;
				totalNumDirtyDiapers += value.numDirtyDiapers;
			}, diaperMap);
			var numDaysWithDiapersRecorded = diaperMap.size;
			if( numDaysWithDiapersRecorded > 0 ) {
				weeklySummary.numWetDiapers = Math.round(totalNumWetDiapers/numDaysWithDiapersRecorded);
				weeklySummary.numDirtyDiapers = Math.round(totalNumDirtyDiapers/numDaysWithDiapersRecorded);
			}
			
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
			var responseMsg = "";
			var responseCard = "";
			if( weeklySummary.age ) {
				responseMsg += 
					weeklySummary.name +
					" is now " + weeklySummary.age + " old";
				responseCard += "Age: " + weeklySummary.age + "\n";
			}
			if( weeklySummary.age && weeklySummary.weightInOunces ) {
				responseMsg += " and";
			} else if( weeklySummary.weightInOunces ) {
				responseMsg += weeklySummary.name;
			} 
			if( weeklySummary.weightInOunces > 0 ) {
				responseMsg += " weighs " + Utils.getPoundsAndOuncesString(weeklySummary.weightInOunces);
				responseCard += "Weight: " + Utils.getPoundsAndOuncesString(weeklySummary.weightInOunces) + "\n";
			}
			if( weightDifferenceInOunces && weightDifferenceNumDays ) {
				responseMsg += ". " + Utils.heShe(weeklySummary.sex, true) + " gained " + weightDifferenceInOunces + " ounce" + Utils.pluralizeIfNeeded(weightDifferenceInOunces) + " in " + weightDifferenceNumDays + " day" + Utils.pluralizeIfNeeded(weightDifferenceNumDays);
				responseCard += "Weight gain: " + weightDifferenceInOunces + " ounces over " + weightDifferenceNumDays + " days\n";
			}
			
			if( !weeklySummary.age && !weeklySummary.weightInOunces ) {
				responseMsg += "On average, " + weeklySummary.name;
			} else {
				responseMsg += ". On average, " + Utils.heShe(weeklySummary.sex);
			}
			responseMsg += " ate " + weeklySummary.numFeedings + " time" + Utils.pluralizeIfNeeded(weeklySummary.numFeedings);
			if( weeklySummary.totalFeedAmount ) {
				responseMsg += " for a total of " + weeklySummary.totalFeedAmount + " ounce" + Utils.pluralizeIfNeeded(weeklySummary.totalFeedAmount);
			}
			responseMsg +=
				" and had " + weeklySummary.numWetDiapers + " wet and " +
				weeklySummary.numDirtyDiapers + " dirty diaper" + Utils.pluralizeIfNeeded(weeklySummary.numDirtyDiapers) + " per day. ";
			responseCard += "Average number of feedings per day: " + weeklySummary.numFeedings + "\n";
			if( weeklySummary.totalFeedAmount ) {
				responseCard += "Average feeding amount per day: " + weeklySummary.totalFeedAmount + " ounces\n";
			}
			responseCard += "Average number of wet diapers per day: " + weeklySummary.numWetDiapers + "\n";
			responseCard += "Average number of dirty diapers per day: " + weeklySummary.numDirtyDiapers + "\n";
			if( weeklySummary.sleep ) {
				responseMsg += "Each day, " + Utils.heShe(weeklySummary.sex) + " generally slept about " + weeklySummary.sleep; //TODO: replace she with proper prononun
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
 * @param 	{string} babyName				the name of the baby to get the summary for. Nullable.
 * 										If not specified, the summary is assumed to be for the most
 * 										recently added baby.
 * 
 * @returns {Promise<Response|DaoError} Returns a promise with a 
 * 			response if the operation succeeded,
 * 			where the response has both a verbal message and written card
 * 			confirming the action,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB.
 */
SummaryController.prototype.getDailySummary = function(userId, babyName) {
	logger.debug("getDailySummary: getting daily summary for userId %s", userId);
	var dailySummary = new Summary();
	var today = new Date();
	var activities = new Set();
	var response = new Response();
	var self = this;
	var baby;
	
	//First, validate all input
	return ValidationUtils.validateRequired("userId", userId)
		.then( function(result) {
			//Next, get this user's baby (to make sure it exists and to use the
			//name in the response)
			if( baby ) {
				logger.debug("getDailySummary: Getting summary for %s", babyName);
				return self.babyDao.readBabyByName(userId, babyName);
			} else {
				return self.babyDao.readBaby(userId);
			}
		})
		.then( function(readBabyResult) {
			//Then, get feeds from the datastore provided the baby exists
			if(readBabyResult) {
				baby = readBabyResult;
				dailySummary.name = readBabyResult.name;
				if( readBabyResult.birthdate ) {
					dailySummary.age = Utils.calculateAgeFromBirthdate(new Date(readBabyResult.birthdate));
				}
				dailySummary.sex = readBabyResult.sex;
				logger.debug("getDailySummary: baby name %s, age %s", dailySummary.name, dailySummary.age);
				return self.feedDao.getFeeds(userId, baby.seq, today, baby.timezone);
			} else {
				if(baby) {
					return Promise.reject(new IllegalStateError(
							"Before getting a summary for " + baby + ", you must first add " + baby + 
							" by saying 'tell Newbie to add baby'"));
				} else {
					return Promise.reject(new IllegalStateError("Before getting a summary, you must first add a baby"));
				}
			}
		})
		.then( function(feedsForDayResult) {
			feedsForDayResult.Items.forEach(function(item) {
	            logger.debug("getDailySummary: %s - %s", item.dateTime, item.feedAmount);
	            if( item.feedAmount ) {
	            	dailySummary.totalFeedAmount += parseInt(item.feedAmount);
	            	dailySummary.numSpecifiedFeedings++;
	            } else {
	            	dailySummary.numUnspecifiedFeedings++;
	            }
	        });
			return self.weightDao.getWeight(userId, baby.seq, today, baby.timezone);
		})
		.then( function(weightForDayResult) {
			logger.debug("getDailySummary: weightForDayResult.Items %s", JSON.stringify(weightForDayResult));
			if( weightForDayResult && weightForDayResult.Items.length > 0 ) {
				logger.debug("getDailySummary: weightInOunces %d", weightForDayResult.Items[weightForDayResult.Items.length-1].weight);
				dailySummary.weightInOunces = weightForDayResult.Items[weightForDayResult.Items.length-1].weight;
			} else {
				logger.debug("getDailySummary: no weight recorded today");
			}
			return self.diaperDao.getDiapers(userId, baby.seq, today, baby.timezone);
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
			return self.activityDao.getActivitiesForDay(userId, baby.seq, today, baby.timezone);
		})
		.then( function(activitiesForDayResult) {
			logger.debug("getDailySummary: activitiesForDayResult %s", JSON.stringify(activitiesForDayResult));
			//todo: refactor this logic so we're not duplicating
			activitiesForDayResult.Items.forEach(function(item) {
	            logger.debug("getDailySummary: activity -- ", item.dateTime + ": " + item.activity);
	            activities.add(item.activity);
	        });
			logger.debug("getDailySummary: activities size -- %s", activities.size);
			return self.sleepDao.getSleep(userId, baby.seq, today, baby.timezone);
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
			var responseCard = "";
			var responseMsg = "";
			if( dailySummary.age ) {
				responseCard += "Age: " + dailySummary.age + "\n";
				responseMsg += 
					"Today, " + dailySummary.name +
					" is " + dailySummary.age + " old";
			} else {
				responseMsg += "Today, " + dailySummary.name;
			}
			
			if(dailySummary.age && dailySummary.weightInOunces > 0) {
				responseMsg += " and";
			}
			
			if( dailySummary.weightInOunces > 0 ) {
				responseMsg += " weighs " + Utils.getPoundsAndOuncesString(dailySummary.weightInOunces);
				responseCard += "Weight: " + Utils.getPoundsAndOuncesString(dailySummary.weightInOunces) + "\n";
			}
			
			if( dailySummary.age || dailySummary.weightInOunces > 0 ) {
				responseMsg += ". " + Utils.heShe(dailySummary.sex, true);
			}
			
			responseMsg += " ate " + (dailySummary.numSpecifiedFeedings+dailySummary.numUnspecifiedFeedings) + 
				" time" + Utils.pluralizeIfNeeded(dailySummary.numSpecifiedFeedings+dailySummary.numUnspecifiedFeedings);
			if( dailySummary.numSpecifiedFeedings > 0 && dailySummary.numUnspecifiedFeedings === 0 ) {
				responseMsg += " for a total of " + dailySummary.totalFeedAmount + " ounce" + Utils.pluralizeIfNeeded(dailySummary.totalFeedAmount);
			} else if( dailySummary.numSpecifiedFeedings > 0 && dailySummary.numUnspecifiedFeedings > 0 ) {
				responseMsg += ", including " + dailySummary.numSpecifiedFeedings + " feed" + 
					Utils.pluralizeIfNeeded(dailySummary.numSpecifiedFeedings) + " totaling " +
					dailySummary.totalFeedAmount + " ounce" + Utils.pluralizeIfNeeded(dailySummary.totalFeedAmount) + ",";
			}
				
			responseMsg +=	" and had " + dailySummary.numWetDiapers + " wet diaper" + Utils.pluralizeIfNeeded(dailySummary.numWetDiapers) + " and " +
				dailySummary.numDirtyDiapers + " dirty diaper" + Utils.pluralizeIfNeeded(dailySummary.numDirtyDiapers) + ". ";
			responseCard += "Number of feedings: " + (dailySummary.numSpecifiedFeedings+dailySummary.numUnspecifiedFeedings) + "\n";
			if( dailySummary.numSpecifiedFeedings > 0 && dailySummary.numUnspecifiedFeedings === 0 ) {
				responseCard += "Total feeding amount: " + dailySummary.totalFeedAmount + " ounces\n";
			} else if( dailySummary.numSpecifiedFeedings > 0  ) {
				responseCard += "Total (specified) feeding amount: " + dailySummary.totalFeedAmount + " ounces\n";
			}
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