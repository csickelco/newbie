/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * Main module for the Newbie application, essentially a set of "intent" handlers. 
 * "An intent is a description of what a user would like to 
 * accomplish that is sent to the skill service from the skill interface."
 * Examples of intents for Newbie include Adding Feeds, and Checking how long the baby
 * has been awake.
 * 
 * For more information, see https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference
 * 
 * @author Christina Sickelco
 */

//Used to write more secure javascript. See http://www.w3schools.com/js/js_strict.asp.
'use strict';

//Alexa app server hotswap module will reload code changes to apps
//if this is set to 1. Handy for local development and testing
//See https://runkit.com/npm/alexa-app-server
module.change_code = 1;

//Used to save data between different alexa calls for the same session
var NEWBIE_ADD_BABY_SESSION_KEY = 'newbie-add-baby';
var NEWBIE_REMOVE_BABY_SESSION_KEY = 'newbie-remove-baby';

//Dependencies
var _ = require('lodash');
var AWS = require("aws-sdk");
var Alexa = require('alexa-app');
var Winston = require('winston');
var BabyController = require('./baby/baby_controller');
var WeightController = require('./weight/weight_controller');
var FeedController = require('./feed/feed_controller');
var SummaryController = require('./summary/summary_controller');
var DiaperController = require('./diaper/diaper_controller');
var ActivityController = require('./activity/activity_controller');
var SleepController = require('./sleep/sleep_controller');
var WordController = require('./word/word_controller');
var Utils = require('./common/utils');
var DaoUtils = require('./common/dao_utils');
var BabyDao = require('./baby/baby_aws_dao');
var WordDao = require('./word/word_aws_dao');
var ActivityDao = require('./activity/activity_aws_dao');
var DiaperDao = require('./diaper/diaper_aws_dao');
var FeedDao = require('./feed/feed_aws_dao');
var SleepDao = require('./sleep/sleep_aws_dao');
var WeightDao = require('./weight/weight_aws_dao');

//Configure AWS APIs
//Configure DynamoDB access
AWS.config.update({
	region: "us-east-1",
	//endpoint: "http://localhost:4000"
	endpoint: "https://dynamodb.us-east-1.amazonaws.com"
});

//Check if environment supports native promises, otherwise use Bluebird
//See https://blogs.aws.amazon.com/javascript/post/Tx3BZ2DC4XARUGG/Support-for-Promises-in-the-SDK
//for AWS Promise support
if (typeof Promise === 'undefined') {
	AWS.config.setPromisesDependency(require('bluebird'));
}

//Properties
var app = new Alexa.app('newbie');

var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();
var daoUtils = new DaoUtils(dynamodb, docClient);

var activityDao = new ActivityDao(dynamodb, docClient, daoUtils);
var wordDao = new WordDao(dynamodb, docClient, daoUtils);
var babyDao = new BabyDao(dynamodb, docClient);
var diaperDao = new DiaperDao(dynamodb, docClient, daoUtils);
var feedDao = new FeedDao(dynamodb, docClient, daoUtils);
var sleepDao = new SleepDao(dynamodb, docClient, daoUtils);
var weightDao = new WeightDao(dynamodb, docClient, daoUtils);

var babyController = new BabyController(babyDao, feedDao, weightDao, diaperDao, activityDao, sleepDao, wordDao);
var weightController = new WeightController(weightDao, babyDao);
var feedController = new FeedController(feedDao, babyDao);
var summaryController = new SummaryController(feedDao, babyDao, weightDao, diaperDao, activityDao, sleepDao);
var diaperController = new DiaperController(diaperDao, babyDao);
var activityController = new ActivityController(activityDao, babyDao);
var sleepController = new SleepController(sleepDao, babyDao);
var wordController = new WordController(wordDao, babyDao);

//Configure the logger with basic logging template
var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Newbie v1.1 - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  },
    	  level: 'info'
      })
    ]
  });

require('winston-timer')(logger, {
    "useColors": false
});

//Constants
var HELP_TEXT = "Add 5 ounce bottle. Add wet and dirty diaper. The baby is sleeping. The baby woke up. " +
		"Add activity reading. Add weight 12 pounds 2 ounces. Add word mama. How many words does baby know? " +
		"How long has the baby been awake? " +
		"Give me a daily summary. You can also say, stop, if you're done. So, how can I help?";

//Helper functions
/**
 * @return true if the spoken diaper type indicates a wet diaper
 */
var determineIfWetDiaper = function(diaperType) {
	return diaperType === "wet" || diaperType === "pee";
};

/**
 * @return true if the spoken diaper type indicates a dirty diaper
 */
var determineIfDirtyDiaper = function(diaperType) {
	return diaperType === "dirty" || diaperType === "poopy" || 
		diaperType === "poop" || diaperType === "poo" || diaperType === "soiled";
};

/**
 * This function gets executed before every command and is used to
 * validate the request and setup any needed data.
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This function does not generate a response.
 */

app.pre = function(request, response, type) {
	if (request.sessionDetails.application.applicationId !== process.env.applicationId) {
		logger.error("app.pre: Invalid applicationId %s, request: %s",
				request.sessionDetails.application.applicationId,
				JSON.stringify(request));
        // Fail ungracefully
        response.fail("Invalid applicationId");
    }
};

/**
 * Triggered when the user says "Launch Newbie Log" - essentially a boot-up/introduction
 * to the app that describes what it's all about.
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This function generates a response that gives a basic introduction
 * 					to Newbie and points the User as to how to start.
 */
app.launch(function(req, res) {
	var userId = req.data.session.user.userId;
	logger.start_log('launch', 'info', ' ', ' [' + userId + ', ' + req.data.request.requestId + ']: Starting');
	var prompt = 'You can ask Newbie Log to track information about your baby. To begin, say Add baby, ' +
		"or, say ''Help'' to find out what else you can do.";
	logger.stop_log('launch', 'info');
    res.say(prompt).shouldEndSession(false);
});

/**
 * This intent handler generates a daily summary
 * (how much eaten, how many diapers, activities for the day, etc) 
 * for the baby.
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response with the daily summary
 * 					as well as a card with similar information.
 */
app.intent('dailySummaryIntent', {
	'slots': {
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|give me|get me|tell me} {|a|my} {daily summary} {|for} {-|NAME}']
}, function(request, response) {
	logger.start('daily-summary');
	var babyName = request.slot('NAME');
	var userId = request.data.session.user.userId;
	logger.debug('dailySummaryIntent [%s, %s]: Getting summary for userId %s', 
			userId, request.data.request.requestId, userId);
	summaryController.getDailySummary(userId, babyName)
		.then(function(responseRetval) {
			logger.info('dailySummaryIntent [%s, %s]: babyName %s, Response %s', 
					userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug('dailySummaryIntent [%s, %s]: Completed successfully', 
					userId, request.data.request.requestId);
			logger.stop_log('daily-summary', 'info');
		}, function (error) {
			logger.error("dailySummaryIntent [%s, %s]: An error occurred getting the daily summary: " + error.message + ", " + error.stack, 
					userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
			logger.stop_log('daily-summary', 'info');
		});
	//Per https://www.npmjs.com/package/alexa-app, returning false should be used for
	//asynchronous intent handlers so a response isn't sent automatically, but
	//manually when we call response.send() after executing our own async logic
	return false;
});

/**
 * This intent generates a weekly summary for the baby.
 * A weekly summary is similar to a daily summary except
 * it contains averages (e.g. average amount eaten per day,
 * average number of wet and dirty diapers per day)
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response with the weekly summary
 * 					as well as a card with similar information.
 */
app.intent('weeklySummaryIntent', {
	'slots': {
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|give me|get me|tell me} {|a|my} {weekly summary} {|for} {-|NAME}']
}, function(request, response) {
	logger.start('weekly-summary');
	var babyName = request.slot('NAME');
	var userId = request.data.session.user.userId;
	logger.debug('weeklySummaryIntent [%s, %s]: Getting summary for userId %s', 
			userId, request.data.request.requestId, userId);
	summaryController.getWeeklySummary(userId, babyName)
		.then(function(responseRetval) {
			logger.info('weeklySummaryIntent [%s, %s]: babyName %s, Response %s', 
					userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug('weeklySummaryIntent [%s, %s]: Completed successfully', 
					userId, request.data.request.requestId);
			logger.stop_log('weekly-summary', 'info');
		}, function (error) {
			logger.error("weeklySummaryIntent [%s, %s]: An error occurred getting the weekly summary: " + error.message + ", " + error.stack, 
					userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
			logger.stop_log('weekly-summary', 'info');
		});
	return false;
});

/**
 * This intent handler records the beginning of sleep
 * for the baby.
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response acknowleging that 
 * 					sleep is being recorded.
 */
app.intent('startSleepIntent', {
	'slots': {
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|the baby} {-|NAME} {|is|started} {|sleeping|went to sleep|taking a nap|napping}']
}, function(request, response) {
	logger.start('start-sleep');
	var babyName = request.slot('NAME');
	var userId = request.data.session.user.userId;
	logger.debug('startSleepIntent [%s, %s]: started sleep', userId, request.data.request.requestId );
	var now = new Date();
	sleepController.startSleep(userId, now, babyName)
		.then(function(responseRetval) {
			logger.info('startSleepIntent [%s, %s]: babyName %s, Response %s', 
					userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();
			response.shouldEndSession(true);
			logger.stop_log('start-sleep', 'info');
		}, function (error) {
			logger.error("startSleepIntent [%s, %s]: An error occurred starting sleep: " + error.message + ", " + error.stack, 
					userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
			logger.stop_log('start-sleep', 'info');
		});
	return false;
});

/**
 * This intent handler handles the end of sleep
 * for the baby.
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response with the amount of
 * 					time the baby has slept.
 */
app.intent('endSleepIntent', {
	'slots': {
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|the baby} {-|NAME} {|is awake|woke up|finished sleeping|finished napping}']
}, function(request, response) {
	logger.start('end-sleep');
	var userId = request.data.session.user.userId;
	logger.debug('endSleepIntent [%s, %s]: ended sleep', 
			userId, request.data.request.requestId);
	var babyName = request.slot('NAME');
	var userId = userId;
	var now = new Date();
	sleepController.endSleep(userId, now, babyName)
		.then(function(responseRetval) {
			logger.info('endSleepIntent [%s, %s]: babyName %s, response %s', 
					userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();
			response.shouldEndSession(true);
			logger.stop_log('end-sleep', 'info');
		}, function (error) {
			logger.error("endSleepIntent [%s, %s]: An error occurred ending sleep: " + error.message + ", " + error.stack, 
					userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
			logger.stop_log('end-sleep', 'info');
		});
	return false;
});

/**
 * This intent handler removes the last sleep entry for the baby
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response and card acknowledging
 * 					the sleep change recorded.
 */
app.intent('removeSleepIntent', {
	'slots': {
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|remove|delete|undo|discard} sleep {|for} {-|NAME}']
},
function(request, response) {
	logger.start('remove-sleep');
	var userId = request.data.session.user.userId;
	logger.debug("removeSleepIntent [%s, %s]", userId, request.data.request.requestId);
	var babyName = request.slot('NAME');
	sleepController.removeLastSleep(userId, babyName)
		.then(function(responseRetval) {
			logger.info('removeSleepIntent [%s, %s]: babyName %s, response %s', 
					userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("removeSleepIntent [%s, %s]: Sleep successfully removed, response: %s", 
					userId, request.data.request.requestId, responseRetval.toString());
			logger.stop_log('remove-sleep', 'info');
		}, function (error) {
			logger.error("removeSleepIntent [%s, %s]: An error occurred removing sleep: " + error.message + ", " + error.stack, 
					userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
			logger.stop_log('remove-sleep', 'info');
		});
	return false;
});

/**
 * This intent handler determines how long the baby has been awake.
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response with how long
 * 					the baby has been awake or the fact that they are still sleeping.
 */
app.intent('getAwakeTimeIntent', {
	'slots': {
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	//When did {baby|Natalie} last eat?
	'utterances': ['how long {|since} has {|baby} {|the baby} {-|NAME} been {|awake|up}']
	}, function(request, response) {
		logger.start('awake-time');
		var userId = request.data.session.user.userId;
		var babyName = request.slot('NAME');
		sleepController.getAwakeTime(userId, babyName)
			.then(function(responseRetval) {
				logger.info('getAwakeTimeIntent [%s, %s]: babyName %s, Response %s', 
						userId, request.data.request.requestId, babyName, responseRetval);
				response.say(responseRetval.message).send();	
				response.shouldEndSession(true);
				logger.debug("getAwakeTimeIntent [%s, %s]: Successfully completed", 
						userId, request.data.request.requestId);
				logger.stop_log('awake-time', 'info');
			}, function (error) {
				logger.error("getAwakeTimeIntent [%s, %s]: An error occurred getting awake time: " + error.message + ", " + error.stack, 
						userId, request.data.request.requestId);
				response.say(error.message).send();
				response.shouldEndSession(true);
				logger.stop_log('awake-time', 'info');
			});
		return false;
	}
);

/**
 * This intent handler determines how much and when the baby last ate.
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response that says
 * 					when and how much the baby last ate.
 */
app.intent('getLastFeedIntent', {
	'slots': {
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	//When did {baby|Natalie} last eat?
	'utterances': ['when {|did} {|baby|the baby} {-|NAME} {|last} {|eat|ate|had a bottle|have a bottle} {|last}']
	}, function(request, response) {
		logger.start('last-feed');
		var userId = request.data.session.user.userId;
		var babyName = request.slot('NAME');
		feedController.getLastFeed(userId, babyName)
			.then(function(responseRetval) {
				logger.info('getLastFeedIntent [%s, %s]: babyName, Response %s', 
						userId, request.data.request.requestId, babyName, responseRetval);
				response.say(responseRetval.message).send();	
				response.shouldEndSession(true);
				logger.debug("getLastFeedIntent [%s, %s]: Successfully completed", 
						userId, request.data.request.requestId);
				logger.stop_log('last-feed', 'info');
			}, function (error) {
				logger.error("getLastFeedIntent [%s, %s]: An error occurred getting last feed: " + error.message + ", " + error.stack, 
						userId, request.data.request.requestId);
				response.say(error.message).send();
				response.shouldEndSession(true);
				logger.stop_log('last-feed', 'info');
			});
		return false;
	}
);

/**
 * This intent handler records a new feed/bottle for the baby.
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response and card with
 * 					an acknowledgement of recording the feed.
 */
app.intent('addFeedIntent', {
	'slots': {
		'NUM_OUNCES': 'AMAZON.NUMBER',
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|add|record} {-|NUM_OUNCES} {|ounce} {|feed|bottle|breastfeeding|nursing} {|for} {-|NAME}']
}, function(request, response) {
	logger.start('add-feed');
	var now = new Date();
	var userId = request.data.session.user.userId;
	var feedAmount;
	var babyName = request.slot('NAME');
	logger.debug('addFeedIntent [%s, %s]: %d ounces for %s', 
			userId, request.data.request.requestId, request.slot('NUM_OUNCES'), now.toString());
	
	if( request.slot('NUM_OUNCES') ) {
		feedAmount = parseInt(request.slot('NUM_OUNCES'));
	}
	feedController.addFeed(userId, now, feedAmount, babyName)
		.then(function(responseRetval) {
			logger.info('addFeedIntent [%s, %s]: babyName %s, feedAmount %d, response %s', 
					userId, request.data.request.requestId, babyName, feedAmount, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("addFeedIntent [%s, %s]: Feed successfully added, response: %s", 
					userId, request.data.request.requestId, responseRetval.toString());
			logger.stop_log('add-feed', 'info');
		}, function (error) {
			logger.error("addFeedIntent [%s, %s]: An error occurred adding feed: " + error.message + ", " + error.stack, 
					userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
			logger.stop_log('add-feed', 'info');
		});
	return false;
});

/**
 * This intent handler removes the last feed entry for the baby
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response and card acknowledging
 * 					the feed change recorded.
 */
app.intent('removeFeedIntent', {
	'slots': {
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|remove|delete|undo|discard} {|feed|bottle|breastfeeding} {|for} {-|NAME}']
},
function(request, response) {
	logger.start('remove-feed');
	var userId = request.data.session.user.userId;
	logger.debug("removeFeedIntent [%s, %s]", userId, request.data.request.requestId);
	var babyName = request.slot('NAME');
	feedController.removeLastFeed(userId, babyName)
		.then(function(responseRetval) {
			logger.info('removeFeedIntent [%s, %s]: babyName %s, response %s', 
					userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("removeFeedIntent [%s, %s]: Feed successfully removed, response: %s", 
					userId, request.data.request.requestId, responseRetval.toString());
			logger.stop_log('remove-feed', 'info');
		}, function (error) {
			logger.error("removeFeedIntent [%s, %s]: An error occurred removing feed: " + error.message + ", " + error.stack, 
					userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
			logger.stop_log('remove-feed', 'info');
		});
	return false;
});

/**
 * This intent handler records a new activity for the baby
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response and card with 
 * 					an acknowledgement that the activity was added.
 */
app.intent('addActivityIntent', {
	'slots': {
		'ACTIVITY': 'ACTIVITY_TYPE',
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|add|record} activity {-|ACTIVITY} {|for} {-|NAME}']
}, function(request, response) {
	logger.start('add-activity');
	var userId = request.data.session.user.userId;
	var activity = request.slot('ACTIVITY');
	var babyName = request.slot('NAME');
	logger.debug('addActivityIntent [%s, %s]: %s', userId, activity);
	
	activityController.addActivity(userId, activity, new Date(), babyName)
		.then(function(responseRetval) {
			logger.info('addActivityIntent [%s, %s]: babyName %s, activity %s, Response %s', 
					userId, request.data.request.requestId, babyName, activity, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("addActivityIntent [%s, %s]: Activity successfully added: %s", 
					userId, request.data.request.requestId, responseRetval.toString());
			logger.stop_log('add-activity', 'info');
		})
		.catch(function(error) {
			logger.error("addActivityIntent [%s, %s]: An error occurred adding activity: " + error.message + ", " + error.stack, 
					userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
			logger.stop_log('add-activity', 'info');
		});
	return false;
});

/**
 * This intent handler removes the last activity entry for the baby
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response and card acknowledging
 * 					the activity change recorded.
 */
app.intent('removeActivityIntent', {
	'slots': {
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|remove|delete|undo|discard} activity {|for} {-|NAME}']
},
function(request, response) {
	logger.start('remove-activity');
	var userId = request.data.session.user.userId;
	logger.debug("removeActivityIntent [%s, %s]", userId, request.data.request.requestId);
	var babyName = request.slot('NAME');
	activityController.removeLastActivity(userId, babyName)
		.then(function(responseRetval) {
			logger.info('removeActivityIntent [%s, %s]: babyName %s, Response %s', 
					userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("removeActivityIntent [%s, %s]: Activity successfully removed, response: %s", 
					userId, request.data.request.requestId, responseRetval.toString());
			logger.stop_log('remove-activity', 'info');
		}, function (error) {
			logger.error("removeActivityIntent [%s, %s]: An error occurred removing activity: " + error.message + ", " + error.stack, 
					userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
			logger.stop_log('remove-activity', 'info');
		});
	return false;
});

/**
 * This intent handler records a new wet and/or dirty diaper for the baby
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response and card acknowledging
 * 					the diaper change recorded.
 */
app.intent('addDiaperIntent', {
	'slots': {
		'FIRST_DIAPER_TYPE': 'DIAPER_TYPE',
		'SECOND_DIAPER_TYPE': 'DIAPER_TYPE',
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|add|record} {-|FIRST_DIAPER_TYPE} {|AND} {-|SECOND_DIAPER_TYPE} diaper {|for} {-|NAME}']
},
function(request, response) {
	logger.start('add-diaper');
	var userId = request.data.session.user.userId;
	var diaperType1 = request.slot('FIRST_DIAPER_TYPE');
	var diaperType2 = request.slot('SECOND_DIAPER_TYPE');
	var babyName = request.slot('NAME');
	logger.debug("addDiaperIntent [%s, %s]: %s diaper AND %s diaper", 
			userId, request.data.request.requestId, diaperType1, diaperType2);
	var isWet = determineIfWetDiaper(diaperType1) || determineIfWetDiaper(diaperType2);
	var isDirty = determineIfDirtyDiaper(diaperType1) || determineIfDirtyDiaper(diaperType2);
	logger.debug("addDiaperIntent [%s, %s]: wet -- %s, dirty -- %s", 
			userId, request.data.request.requestId, isWet, isDirty);
	var now = new Date();
	diaperController.addDiaper(userId, now, isWet, isDirty, babyName)
		.then(function(responseRetval) {
			logger.info('addDiaperIntent [%s, %s]: babyName %s, diaperType1 %s, diaperType2 %s, Response %s', 
					userId, request.data.request.requestId, babyName, diaperType1, diaperType2, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("addDiaperIntent [%s, %s]: Diaper successfully added, response: %s", 
					userId, request.data.request.requestId, responseRetval.toString());
			logger.stop_log('add-diaper', 'info');
		}, function (error) {
			logger.error("addDiaperIntent [%s, %s]: An error occurred adding diaper: " + error.message + ", " + error.stack, 
					userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
			logger.stop_log('add-diaper', 'info');
		});
	return false;
});

/**
 * This intent handler removes the last diaper entry for the baby
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response and card acknowledging
 * 					the diaper change recorded.
 */
app.intent('removeDiaperIntent', {
	'slots': {
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|remove|delete|undo|discard} diaper {|for} {-|NAME}']
},
function(request, response) {
	logger.start('remove-diaper');
	var userId = request.data.session.user.userId;
	var babyName = request.slot('NAME');
	logger.debug("removeDiaperIntent [%s, %s]", userId, request.data.request.requestId);
	diaperController.removeLastDiaper(userId, babyName)
		.then(function(responseRetval) {
			logger.info('removeDiaperIntent [%s, %s]: babyName %s, Response %s', 
					userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("removeDiaperIntent [%s, %s]: Diaper successfully removed, response: %s", 
					userId, request.data.request.requestId, responseRetval.toString());
			logger.stop_log('remove-diaper', 'info');
		}, function (error) {
			logger.error("removeDiaperIntent [%s, %s]: An error occurred removing diaper: " + error.message + ", " + error.stack, 
					userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
			logger.stop_log('remove-diaper', 'info');
		});
	return false;
});

/**
 * This intent handler records the baby's weight
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response and card acknowledging
 * 					the weight recorded and stating the baby's percentile.
 */
app.intent('addWeightIntent', {
    'slots': {
        'NUM_POUNDS': 'AMAZON.NUMBER',
        'NUM_OUNCES': 'AMAZON.NUMBER',
        'NAME': 'AMAZON.US_FIRST_NAME'
    },
    'utterances': ['{|add|record} {|weight} {-|NUM_POUNDS} {|pounds} {-|NUM_OUNCES} {|ounces} {|for} {-|NAME}']
	},

	function(request, response) {
		logger.start('add-weight');
	    // Get the slot
		//TODO: Should the integer parsing really be done in the controller, where we're already type checking?
		var userId = request.data.session.user.userId;
		var pounds = parseInt(request.slot('NUM_POUNDS'));
	    var ounces = parseInt(request.slot('NUM_OUNCES'));
	    var babyName = request.slot('NAME');
	    logger.debug("addWeightIntent [%s, %s]: %d pounds, %d ounces, request %s", 
	    		userId, request.data.request.requestId, pounds, ounces, JSON.stringify(request));
	    var now = new Date();
	    
	    if(pounds !== undefined && pounds !== "?" && ounces !== undefined && ounces !== "?") {
	    	var addWeightPromise = weightController.addWeight(
					userId, 
					now,
					pounds,
					ounces,
					babyName
				);
			addWeightPromise.then(function(responseRetval) {
				logger.debug('addWeightIntent [%s, %s]: %s', userId, request.data.request.requestId, responseRetval);
				response.say(responseRetval.message).send();	
				//TODO: ideally return the percentile and add that to the card as well
				response.card(responseRetval.cardTitle, responseRetval.cardBody);
				response.shouldEndSession(true);
				logger.info("addWeightIntent [%s, %s]: babyName %s, pounds %d, ounces %d, Weight successfully added, %s", 
						userId, request.data.request.requestId, babyName, pounds, ounces, responseRetval.toString());
				logger.stop_log('add-weight', 'info');
			}, function (error) {
				logger.error("addWeightIntent [%s, %s]: An error occurred adding weight: " + error.message + ", " + error.stack, 
						userId, request.data.request.requestId);
				response.say(error.message).send();
				response.shouldEndSession(true);
				logger.stop_log('add-weight', 'info');
			});
	    } else {
	    	logger.error("addWeightIntent [%s, %s]: Couldn't add weight. Both pounds and ounces must be specified, pounds - %d, ounces - %d",
	    			userId, request.data.request.requestId, pounds, ounces);
	    	response.say("I'm sorry, I couldn't add weight - you must specify both pounds and ounces").send();		
			response.shouldEndSession(true);
			logger.stop_log('add-weight', 'info');
	    }
	    return false;
	}

);

/**
 * This intent handler removes the last weight entry for the baby
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response and card acknowledging
 * 					the weight recorded.
 */
app.intent('removeWeightIntent', {
	'slots': {
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|remove|delete|undo|discard} weight {|for} {-|NAME}']
},
function(request, response) {
	logger.start('remove-weight');
	var userId = request.data.session.user.userId;
	logger.debug("removeWeightIntent [%s, %s]", userId, request.data.request.requestId);
	var babyName = request.slot('NAME');
	weightController.removeLastWeight(userId, babyName)
		.then(function(responseRetval) {
			logger.info('removeWeightIntent [%s, %s]: babyName %s, %s', 
					userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("removeWeightIntent [%s, %s]: Weight successfully removed, response: %s", 
					userId, request.data.request.requestId, responseRetval.toString());
			logger.stop_log('remove-weight', 'info');
		}, function (error) {
			logger.error("removeWeightIntent [%s, %s]: An error occurred removing weight: " + error.message + ", " + error.stack, 
					userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
			logger.stop_log('remove-weight', 'info');
		});
	return false;
});

var addBabyFunction = function(request, response, babyName, babySex, babyBirthdate, timezone, daylightSavingsObserved) {
	var birthdateDateValue;
	var userId = request.data.session.user.userId;
	if(babyBirthdate) {
		birthdateDateValue = new Date(babyBirthdate);
	}
	babyController.addBaby(
			userId, 
			babySex, 
			babyName, 
			birthdateDateValue,
			timezone,
			daylightSavingsObserved
		).then(function(responseRetval) {
			logger.debug('addBabyIntent [%s, %s]: %s', userId, request.data.request.requestId, responseRetval.toString());
			
			//Send response
			response.say(responseRetval.message).send();
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.info("addBabyIntent [%s, %s]: Baby successfully added, response: %s", userId, request.data.request.requestId, responseRetval.toString());
		}, function (error) {
			logger.error("addBabyIntent [%s, %s]: An error occurred adding baby: " + error.message + ", " + error.stack, 
					userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
		});
};

/**
 * This intent handler adds a new baby for the user. It is the first
 * command that the user should say.
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response acknowledging
 * 					that the baby was added and stating how old he/she is.
 */
app.intent('addBabyIntent', {
	"slots": {
		'SEX': 'SEXES', 
		'NAME': 'AMAZON.US_FIRST_NAME', //TODO: Not sure this will really work for all names
		'BIRTHDATE': 'DATE',
		'TIMEZONE': 'TIMEZONE'
	},
	'utterances': ['{|add|record} {|new} {|baby|child|kid}', '{-|SEX}', '{-|BIRTHDATE}', '{-|NAME}', '{-|TIMEZONE}', '{-|DAYLIGHT_SAVINGS_OBSERVED}']
	},
	function(request, response) {
		try {
			logger.start('add-baby');
			var userId = request.data.session.user.userId;
			var sexValue = request.slot("SEX");
			var nameValue = request.slot("NAME");
			var birthdateValue = request.slot("BIRTHDATE");
			var timezoneValue = request.slot("TIMEZONE");
			var removeBabyData = request.session(NEWBIE_REMOVE_BABY_SESSION_KEY);
			logger.debug('addBabyIntent [%s, %s]: Processing with sexValue: %s, nameValue: %s, birthdateValue: %s, timezoneValue: %s: %s', 
					userId, request.data.request.requestId, sexValue, nameValue, birthdateValue, timezoneValue);
			
			var babyData = request.session(NEWBIE_ADD_BABY_SESSION_KEY);
			if(babyData === undefined) {
				logger.debug('addBabyIntent [%s, %s]: babyData does not yet exist, creating...', userId, request.data.request.requestId);
				babyData = {};
			} else {
				logger.debug('addBabyIntent [%s, %s]: babyData exists - %s', userId, request.data.request.requestId, JSON.stringify(babyData));
			}
			babyData.beganAddBabySession = true;
			
			if( sexValue ) {
				logger.debug('addBabyIntent [%s, %s]: Adding sexValue %s', userId, request.data.request.requestId, sexValue);
				babyData.sex = sexValue;
			}
			if( nameValue ) {
				logger.debug('addBabyIntent [%s, %s]: Adding nameValue %s', userId, request.data.request.requestId, nameValue);
				if( removeBabyData && removeBabyData.beganRemoveBabySession ) {
					//It's possible we got into this intent because the user said "Remove baby"
					//(without a name), newbie prompted for a name, and they provided it
					removeBabyData.name = nameValue;
				} else {
					babyData.name = nameValue;
				}
			}
			if( birthdateValue ) {
				logger.debug('addBabyIntent [%s, %s]: Adding birthdateValue %s', userId, request.data.request.requestId, birthdateValue);
				babyData.birthdate = birthdateValue;
			}
			if( timezoneValue ) {
				logger.debug('addBabyIntent [%s, %s]: Adding timezoneValue %s', userId, request.data.request.requestId, timezoneValue);
				babyData.timezone = timezoneValue;
			}

			response.session(NEWBIE_ADD_BABY_SESSION_KEY, babyData);
			logger.debug('addBabyIntent [%s, %s]: babyData - %s', userId, request.data.request.requestId, JSON.stringify(babyData));
			
			/*
			 * The dialog should go as follows:
			 * To add your baby, I'll just need to ask you a few questions.
			 * 1. First, what is your timezone?
			 * 2. [Only if the user is in a timezone that may observe daylight savings]: Is daylight savings observed?
			 * 3. Is your baby a boy or girl?
			 * The last two questions are optional. If you 
			 * don't want to answer, just say no.
			 * 4. What is your baby's first name?
			 * 5. What is your baby's birthdate?
			 * Added baby [sex] [name - if provided]. [he/she is [age] - if birthdate provided].
			 * 
			 * (the no responses are handled in the yes and no intent handlers)
			 */
			if( removeBabyData && removeBabyData.name) {
				response.say("Are you sure you want to delete all newbie logs for baby " + removeBabyData.name + "?").send();
				response.shouldEndSession(false);
				logger.stop_log('add-baby', 'info');
			} else if(!babyData.introPrompt) {
				babyData.introPrompt = true;
				response.session(NEWBIE_ADD_BABY_SESSION_KEY, babyData);
				response.say("To add your baby, I'll just need to ask you a few questions. " +
					"First, what is your timezone?").send();
				response.shouldEndSession(false);
				logger.stop_log('add-baby', 'info');
			} else if(!babyData.timezone) {
				response.say("What is your timezone? For example: Eastern, Central, Mountain, Pacific").send();
				response.shouldEndSession(false);
				logger.stop_log('add-baby', 'info');
			} else if(babyData.timezone === "mountain" && !babyData.promptedDaylightSavingsObserved) {
				babyData.promptedDaylightSavingsObserved = true;
				response.session(NEWBIE_ADD_BABY_SESSION_KEY, babyData);
				response.say('Is daylight savings time observed in your location?').send();
				response.shouldEndSession(false);
				logger.stop_log('add-baby', 'info');
			} else if(!babyData.sex) {
				logger.debug("addBabyIntent: asking if boy or girl");
				response.say('Is your baby a boy or girl?').send();
				response.shouldEndSession(false);
				logger.stop_log('add-baby', 'info');
			} else if(!babyData.promptedName) {
				logger.debug("addBabyIntent: asking if want to specify name and birthdate");
				babyData.promptedName = true;
				response.session(NEWBIE_ADD_BABY_SESSION_KEY, babyData);
				response.say("The last two questions are optional. If you don't want to answer, just say skip. " + 
						"What is your baby's first name?").send();
				response.shouldEndSession(false);
				logger.stop_log('add-baby', 'info');
			} else if(babyData.promptedName && !babyData.name) {
				logger.debug("addBabyIntent: reprompting for name");
				response.say("Hmm, I didn't catch baby's name. Please say " +
						Utils.hisHer(babyData.sex, false) +  
						" first name or 'skip' to move on").send();
				response.shouldEndSession(false);
				logger.stop_log('add-baby', 'info');
			} else if(!babyData.promptedBirthdate) {
				logger.debug("addBabyIntent: asking if they want to specify birthdate");
				babyData.promptedBirthdate = true;
				response.session(NEWBIE_ADD_BABY_SESSION_KEY, babyData);
				response.say("What is " + babyData.name + "'s birthdate?").send();
				response.shouldEndSession(false);
				logger.stop_log('add-baby', 'info');
			} else {
				var babyName = babyData.name;
				var babySex = babyData.sex;
				var babyBirthdate = babyData.birthdate;
				var babyTimezone = babyData.timezone;
				var daylightSavingsObserved = babyData.daylightSavingsObserved;
				
				//Clear session
				babyData = {};
				response.session(NEWBIE_ADD_BABY_SESSION_KEY, babyData);
				
				//Process request
				addBabyFunction(request, response, babyName, babySex, babyBirthdate, babyTimezone, daylightSavingsObserved);
				logger.stop_log('add-baby', 'info');
			} 
			//TODO: Checking if baby already exists. Right now, it just overwrites, which may be ok.
		} catch( err ) {
			logger.error("addBabyIntent [%s, %s]: An error occurred adding baby: " + err.message + ", " + err.stack, userId);
			response.say(err.message).send();
			response.shouldEndSession(true);
			logger.stop_log('add-baby', 'info');
		}
		return false;
	}
);

/**
 * This intent handler removes all data for one of the user's babies
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response and card acknowledging
 * 					the weight recorded.
 */
app.intent('removeBabyIntent', {
	'slots': {
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|remove|delete} baby {-|NAME}']
},
function(request, response) {
	logger.start('remove-baby');
	var userId = request.data.session.user.userId;
	var babyName = request.slot('NAME');
	logger.info("removeBabyIntent [%s, %s]: Removing baby %s...", userId, request.data.request.requestId, babyName);
	
	var babyData = request.session(NEWBIE_REMOVE_BABY_SESSION_KEY);
	if(babyData === undefined) {
		logger.debug('removeBabyIntent [%s, %s]: babyData does not yet exist, creating...', userId, request.data.request.requestId);
		babyData = {};
	} else {
		logger.debug('removeBabyIntent [%s, %s]: babyData exists - %s', userId, request.data.request.requestId, JSON.stringify(babyData));
	}
	babyData.beganRemoveBabySession = true;
	
	if( babyName ) {
		logger.debug('removeBabyIntent [%s, %s]: Adding babyName %s', userId, request.data.request.requestId, babyName);
		babyData.name = babyName;
	}
	response.session(NEWBIE_REMOVE_BABY_SESSION_KEY, babyData);
	logger.debug('removeBabyIntent [%s, %s]: babyData %s', userId, request.data.request.requestId, JSON.stringify(babyData));
	
	if(!babyData.name) {
		response.say("What is the first name of the baby whose data you want to remove?").send();
		response.shouldEndSession(false);
		logger.stop_log('remove-baby', 'info');
	} else {
		response.say("Are you sure you want to delete all newbie logs for baby " + babyData.name + "?").send();
		response.shouldEndSession(false);
		logger.stop_log('remove-baby', 'info');
	}
	return false;
});

/**
 * This intent handler records a new word for the baby
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response and card with 
 * 					an acknowledgement that the activity was added.
 */
app.intent('addWordIntent', {
	'slots': {
		'WORD': 'WORD_TYPE',
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|add|record} word {-|WORD} {|for} {-|NAME}']
}, function(request, response) {
	logger.start('add-word');
	var userId = request.data.session.user.userId;
	var word = request.slot('WORD');
	var babyName = request.slot('NAME');
	logger.debug('addWordIntent [%s, %s]: %s', userId, request.data.request.requestId, word);
	
	wordController.addWord(userId, word, new Date(), babyName)
		.then(function(responseRetval) {
			logger.info('addWordIntent [%s, %s]: babyName %s, word %s, Response %s', 
					userId, request.data.request.requestId, babyName, word, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("addWordIntent [%s, %s]: Activity successfully added: %s", 
					userId, request.data.request.requestId, responseRetval.toString());
			logger.stop_log('add-word', 'info');
		})
		.catch(function(error) {
			logger.error("addWordIntent [%s, %s]: An error occurred adding word: " + error.message + ", " + error.stack, 
					userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
			logger.stop_log('add-word', 'info');
		});
	return false;
});

/**
 * This intent handler gets a summary of the words recorded for a baby
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This intent handler generates a spoken response and card with 
 * 					an acknowledgement that the activity was added.
 */
app.intent('getWordIntent', {
	'slots': {
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|give me|get me|tell me} {|how many words does} {-|NAME} {|know}']
}, function(request, response) {
	logger.start('word-summary');
	var userId = request.data.session.user.userId;
	var babyName = request.slot('NAME');
	logger.debug('getWordIntent [%s, %s]: %s', userId, babyName);
	
	wordController.getWordCount(userId, babyName)
		.then(function(responseRetval) {
			logger.info('getWordIntent [%s, %s]: babyName %s, Response %s', 
					userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("getWordIntent [%s, %s]: Words successfully retrieved: %s", 
					userId, request.data.request.requestId, responseRetval.toString());
			logger.stop_log('word-summary', 'info');
		})
		.catch(function(error) {
			logger.error("getWordIntent [%s, %s]: An error occurred getting words: " + error.message + ", " + error.stack, 
					userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
			logger.stop_log('word-summary', 'info');
		});
	return false;
});

var exitFunction = function(request, response) {
	var removeBabyData = request.session(NEWBIE_REMOVE_BABY_SESSION_KEY);
	var addBabyData = request.session(NEWBIE_ADD_BABY_SESSION_KEY);
	var speechOutput = "";
	if( removeBabyData && removeBabyData.beganRemoveBabySession ) {
		speechOutput = "Ok, cancelling remove baby request";
	} else if( addBabyData && addBabyData.beganAddBabySession ) {
		speechOutput = "Ok, cancelling add baby request";
	} else {
		speechOutput = "Okay, goodbye.";
	}
	
	//Clear sessions
	var data = {};
	response.session(NEWBIE_ADD_BABY_SESSION_KEY, data);
	response.session(NEWBIE_REMOVE_BABY_SESSION_KEY, data);
	
	//Say goodbye
	response.say(speechOutput);
	response.shouldEndSession(true);
};

app.intent('AMAZON.YesIntent', function(request, response) {
	logger.start('yes');
	var retval = false;
	var userId = request.data.session.user.userId;
	var removeBabyData = request.session(NEWBIE_REMOVE_BABY_SESSION_KEY);
	var addBabyData = request.session(NEWBIE_ADD_BABY_SESSION_KEY);
	
	if( removeBabyData && removeBabyData.name) {
		//User was in the middle of a delete request
		//and confirming the delete
		var removeBabyName = removeBabyData.name;
		
		//Clear session
		removeBabyData = {};
		response.session(NEWBIE_REMOVE_BABY_SESSION_KEY, removeBabyData);
	
		//Perform operation
		logger.debug('removeBabyFunction [%s, %s]: removing baby data...', userId, request.data.request.requestId);
		babyController.removeBaby(userId, removeBabyName)
			.then(function(responseRetval) {
				logger.info('removeBabyIntent [%s, %s]: babyName %s, %s', 
						userId, request.data.request.requestId, removeBabyName, responseRetval.toString());
							
				//Send response
				response.say(responseRetval.message).send();	
				response.card(responseRetval.cardTitle, responseRetval.cardBody);
				response.shouldEndSession(true);
				logger.debug("removeBabyIntent [%s, %s]: Baby successfully removed, response: %s", 
						userId, request.data.request.requestId, responseRetval.toString());
				logger.stop_log('yes', 'info');
			}, function (error) {
				logger.error("removeBabyIntent [%s, %s]: An error occurred removing baby: " + error.message + ", " + error.stack, 
						userId, request.data.request.requestId);
				response.say(error.message).send();
				response.shouldEndSession(true);
				logger.stop_log('yes', 'info');
			});
	} else if( addBabyData && addBabyData.promptedDaylightSavingsObserved ) {
		logger.debug("YesIntent: User answered question about daylights savings as Yes");
		retval = true;
		
		//User was in the middle of an add request and answering the question
		//about daylight savings
		addBabyData.daylightSavingsObserved = true;
		response.session(NEWBIE_ADD_BABY_SESSION_KEY, addBabyData);
		response.say('Is your baby a boy or girl?').send();
		response.shouldEndSession(false);
		logger.stop_log('yes', 'info');
	} else {
		logger.error("YesIntent [%s, %s]: Unclear what user is responding yes to");
		retval = true;
		response.say("I'm sorry, I didn't understand your request").send();
		response.shouldEndSession(true);
		logger.stop_log('yes', 'info');
	}
	return retval;
});

app.intent('AMAZON.NoIntent', function(request, response) {
	logger.start('no');
	var userId = request.data.session.user.userId;
	var retval = false;
	var removeBabyData = request.session(NEWBIE_REMOVE_BABY_SESSION_KEY);
	var addBabyData = request.session(NEWBIE_ADD_BABY_SESSION_KEY);

	if( removeBabyData && removeBabyData.name) {
		//User was in the middle of a delete request
		retval = true;
	
		//Clear session
		removeBabyData = {};
		response.session(NEWBIE_REMOVE_BABY_SESSION_KEY, removeBabyData);
	
		//Report cancel
		response.say("Ok, cancelling delete request").send();
		response.shouldEndSession(true);
		logger.stop_log('no', 'info');
	} else if( addBabyData && addBabyData.promptedDaylightSavingsObserved ) {
		logger.debug("NoIntent: User answered question about daylights savings as No");
		retval = true;
		
		//User was in the middle of an add request and answering the question
		//about daylight savings
		addBabyData.daylightSavingsObserved = false;
		response.session(NEWBIE_ADD_BABY_SESSION_KEY, addBabyData);
		logger.debug("NoIntent: asking if boy or girl");
		response.say('Is your baby a boy or girl?').send();
		response.shouldEndSession(false);
		logger.stop_log('no', 'info');
	} else {
		logger.error("NoIntent [%s, %s]: Unclear what user is responding no to");
		retval = true;
		response.say("I'm sorry, I didn't understand your request").send();
		response.shouldEndSession(true);
		logger.stop_log('no', 'info');
	}
	
	return retval;
});

app.intent('AMAZON.NextIntent', function(request, response) {
	logger.start('next');
	var userId = request.data.session.user.userId;
	var retval = false;
	var addBabyData = request.session(NEWBIE_ADD_BABY_SESSION_KEY);

	if( addBabyData && addBabyData.promptedBirthdate ) {
		//User was in the middle of an add baby request and
		//responding that they didn't want to provide a birthdate
		//At this point, the dialog is complete so clear the session
		//and process the request
		var babyName = addBabyData.name;
		var babySex = addBabyData.sex;
		var babyBirthdate = null;
		var babyTimezone = addBabyData.timezone;
		var daylightSavingsObserved = addBabyData.daylightSavingsObserved;
		logger.debug("NextIntent: babyName - %s, babySex - %s, babyBirthdate - %s, babyTimezone - %s, daylightSavingsObserved %s",
				babyName, babySex, babyBirthdate, babyTimezone, daylightSavingsObserved);
		
		addBabyData = {};
		response.session(NEWBIE_ADD_BABY_SESSION_KEY, addBabyData);
		
		//Process request
		addBabyFunction(request, response, babyName, babySex, babyBirthdate, babyTimezone, daylightSavingsObserved);
		logger.stop_log('next', 'info');
	} else if( addBabyData && addBabyData.promptedName) {
		retval = true;
		
		//User was in the middle of an add baby request and
		//responding that they didn't want to provide a name
		addBabyData.promptedBirthdate = true;
		addBabyData.name = "Baby";
		response.session(NEWBIE_ADD_BABY_SESSION_KEY, addBabyData);
		response.say("Ok, I'll refer to your baby simply as 'Baby'. What is baby's birthdate?").send();
		response.shouldEndSession(false);
		logger.stop_log('next', 'info');
	} else {
		logger.error("NextIntent [%s, %s]: Unclear what user is responding no to");
		retval = true;
		response.say("I'm sorry, I didn't understand your request").send();
		response.shouldEndSession(true);
		logger.stop_log('next', 'info');
	}
	
	return retval;
});

app.intent('AMAZON.StopIntent', exitFunction);

app.intent('AMAZON.CancelIntent', exitFunction);

app.intent('AMAZON.HelpIntent', function(request, response) {
	logger.start('help');
	var speechOutput = "To first set up Newbie Log, say 'Add baby'. After that, here are some things you can tell Newbie Log: " +
		HELP_TEXT;
	response.say(speechOutput);
	response.shouldEndSession(false);
	logger.stop_log('help', 'info');
});

module.exports = app;