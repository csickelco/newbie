/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;
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

var feedDao = new FeedDao();
var babyDao = new BabyDao();
var weightDao = new WeightDao();
var diaperDao = new DiaperDao();
var activityDao = new ActivityDao();
var sleepDao = new SleepDao();

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

function SummaryController () {
}

SummaryController.prototype.getWeeklySummary = function(userId) {
	logger.info("getWeeklySummary: getting weekly summary for userId %s", userId);
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
			weeklySummary.name = JSON.parse(readBabyResult.Item.data).name;
			weeklySummary.age = Utils.calculateAgeFromBirthdate(new Date(JSON.parse(readBabyResult.Item.data).birthdate));
			logger.info("getWeeklySummary: baby name %s, age %s", weeklySummary.name, weeklySummary.age);
			
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
			logger.info("Most recent weight of %d ounces recorded on %s", lastWeightRecorded, dateOfLastWeightRecorded);
			if(dateOfEarliestWeightRecorded && dateOfLastWeightRecorded && dateOfEarliestWeightRecorded !== dateOfLastWeightRecorded) {
				weightDifferenceInOunces = lastWeightRecorded - earliestWeightRecorded; //TODO: Handle negative weight difference
				var dateOfEarliestWeightRecordedDate = new Date(dateOfEarliestWeightRecorded);
				var dateOfLastWeightRecordedDate = new Date(dateOfLastWeightRecorded);
				var timeDiff = Math.abs(dateOfLastWeightRecordedDate.getTime() - dateOfEarliestWeightRecordedDate.getTime());
				weightDifferenceNumDays = Math.ceil(timeDiff / (1000 * 3600 * 24)); 
			}
			weeklySummary.weightInOunces = lastWeightRecorded;
			
			//TODO: Does this belong in controller?
			//TODO: replace hardcoded values
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
				responseMsg += ". She gained " + weightDifferenceInOunces + " ounce" + Utils.pluralizeIfNeeded(weightDifferenceInOunces) + " in " + weightDifferenceNumDays + " day" + Utils.pluralizeIfNeeded(weightDifferenceNumDays);
				responseCard += "Weight gain: " + weightDifferenceInOunces + " ounces over " + weightDifferenceNumDays + " days\n";
			}
			responseMsg += ". On average, she ate " + weeklySummary.numFeedings + " time" + Utils.pluralizeIfNeeded(weeklySummary.numFeedings) + " for a total of " +
				weeklySummary.totalFeedAmount + " ounce" + Utils.pluralizeIfNeeded(weeklySummary.totalFeedAmount) +
				" and had " + weeklySummary.numWetDiapers + " wet and " +
				weeklySummary.numDirtyDiapers + " dirty diaper" + Utils.pluralizeIfNeeded(weeklySummary.numDirtyDiapers) + " per day. ";
			responseCard += "Average number of feedings per day: " + weeklySummary.numFeedings + "\n";
			responseCard += "Average feeding amount per day: " + weeklySummary.totalFeedAmount + " ounces\n";
			responseCard += "Average number of wet diapers per day: " + weeklySummary.numWetDiapers + "\n";
			responseCard += "Average number of dirty diapers per day: " + weeklySummary.numDirtyDiapers + "\n";
			if( weeklySummary.sleep ) {
				responseMsg += "Each day, she generally slept about " + weeklySummary.sleep; //TODO: replace she with proper prononun
				responseCard += "Average amount of sleep per day: " + weeklySummary.sleep + "\n";
			}
			
			response.message = responseMsg;
			response.card = responseCard;
			
			//TODO: Add activities
			logger.info("getWeeklySummary: Response %s", response.toString());
			return response;
		});
};

SummaryController.prototype.getDailySummary = function(userId) {
	//TODO: When productionizing, eliminate log stmt due to privacy concerns
	//TODO: Provide option to use different units
	logger.info("getDailySummary: getting daily summary for userId %s", userId);
	var dailySummary = new Summary();
	var today = new Date();
	var activities = new Set();
	var response = new Response();
	
	return babyDao.readBaby(userId)
		.then( function(readBabyResult) {
			dailySummary.name = JSON.parse(readBabyResult.Item.data).name;
			dailySummary.age = Utils.calculateAgeFromBirthdate(new Date(JSON.parse(readBabyResult.Item.data).birthdate));
			logger.info("getDailySummary: baby name %s, age %s", dailySummary.name, dailySummary.age);
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
			logger.info("getDailySummary: weightForDayResult.Items %s", JSON.stringify(weightForDayResult));
			if( weightForDayResult.Items.length > 0 ) {
				//TODO: I think this works because of sort key but not sure
				logger.info("getDailySummary: weightInOunces %d", weightForDayResult.Items[weightForDayResult.Items.length-1].weight);
				dailySummary.weightInOunces = weightForDayResult.Items[weightForDayResult.Items.length-1].weight;
			} else {
				logger.info("getDailySummary: no weight recorded today");
			}
			return diaperDao.getDiapers(userId, today);
		})
		.then( function(diapersForDayResult) {
			logger.info("getDailySummary: diapersForDayResult.Items %s", JSON.stringify(diapersForDayResult));
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
			logger.info("getDailySummary: activitiesForDayResult.Items %s", JSON.stringify(activitiesForDayResult));
			//todo: refactor this logic so we're not duplicating
			activitiesForDayResult.Items.forEach(function(item) {
	            logger.info("getDailySummary: activity -- ", item.dateTime + ": " + item.activity);
	            activities.add(item.activity);
	        });
			logger.info("getDailySummary: activities size -- %s", activities.size);
			return sleepDao.getSleep(userId, today);
		})
		.then( function(sleepsForDayResult) {
			logger.info("getDailySummary: sleepsForDayResult.Items %s", JSON.stringify(sleepsForDayResult));
			var totalMillisecondsOfSleep = 0;
			//todo: refactor this logic so we're not duplicating
			sleepsForDayResult.Items.forEach(function(item) {
	            logger.info("getDailySummary: sleep -- ", item.sleepDateTime + " - " + item.wokeUpDateTime);
	            if( item.sleepDateTime && item.wokeUpDateTime ) {
	            	var sleepStart = new Date(item.sleepDateTime);
	            	var sleepEnd = new Date(item.wokeUpDateTime);
	            	totalMillisecondsOfSleep += (sleepEnd.getTime() - sleepStart.getTime());
				}
	        });
			logger.info("getDailySummary: totalMillisecondsOfSleep -- %d", totalMillisecondsOfSleep);
			if( totalMillisecondsOfSleep > 0 ) {
				dailySummary.sleep = Utils.formatDuration(totalMillisecondsOfSleep);
			}
			logger.info("getDailySummary: dailySummary -- %s", dailySummary.toString());
		
			//Format message and cards
			//TODO: Does this belong in controller?
			//TODO: replace hardcoded values
			//TODO: This could probably be a method in summary or a helper method
			var responseCard = "Age: " + dailySummary.age + "\n";
			var responseMsg = 
				"Today, " + dailySummary.name +
				" is " + dailySummary.age + " old";
			if( dailySummary.weightInOunces > 0 ) {
				responseMsg += " and weighs " + Utils.getPoundsAndOuncesString(dailySummary.weightInOunces);
				responseCard += "Weight: " + Utils.getPoundsAndOuncesString(dailySummary.weightInOunces) + "\n";
			}
			responseMsg += ". She ate " + dailySummary.numFeedings + " time" + Utils.pluralizeIfNeeded(dailySummary.numFeedings) + " for a total of " +
				dailySummary.totalFeedAmount + " ounce" + Utils.pluralizeIfNeeded(dailySummary.totalFeedAmount) + " " +
				"and had " + dailySummary.numWetDiapers + " wet diaper" + Utils.pluralizeIfNeeded(dailySummary.numWetDiapers) + " and " +
				dailySummary.numDirtyDiapers + " dirty diaper" + Utils.pluralizeIfNeeded(dailySummary.numDirtyDiapers) + ". ";
			responseCard += "Number of feedings: " + dailySummary.numFeedings + "\n";
			responseCard += "Total feeding amount: " + dailySummary.totalFeedAmount + "\n";
			responseCard += "Number of wet diapers: " + dailySummary.numWetDiapers + "\n";
			responseCard += "Number of dirty diapers: " + dailySummary.numDirtyDiapers + "\n";
			if( dailySummary.sleep ) {
				responseMsg += "She slept " + dailySummary.sleep + ". "; //TODO: replace she with proper prononun
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
			response.card = responseCard;
			logger.info("getDailySummary: Response %s", response.toString());
			return response;
		});
};
//Test
module.exports = SummaryController;