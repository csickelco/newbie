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
var Alexa = require('alexa-app');
var Winston = require('winston');
var BabyController = require('./baby/baby_controller');
var WeightController = require('./weight/weight_controller');
var FeedController = require('./feed/feed_controller');
var SummaryController = require('./summary/summary_controller');
var DiaperController = require('./diaper/diaper_controller');
var ActivityController = require('./activity/activity_controller');
var SleepController = require('./sleep/sleep_controller');
var Utils = require('./common/utils');

//Properties
var app = new Alexa.app('newbie');
var babyController = new BabyController();
var weightController = new WeightController();
var feedController = new FeedController();
var summaryController = new SummaryController();
var diaperController = new DiaperController();
var activityController = new ActivityController();
var sleepController = new SleepController();

//Configure the logger with basic logging template
var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Newbie v1.0 - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//Constants
var HELP_TEXT = "Add 5 ounce bottle. Add wet and dirty diaper. The baby is sleeping. The baby woke up. " +
		"Add activity reading. Add weight 12 pounds 2 ounces. How long has the baby been awake? " +
		"When did the baby last eat?";

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
		logger.error("Invalid applicationId %s, request: %s",
				request.sessionDetails.application.applicationId,
				JSON.stringify(request));
        // Fail ungracefully
        response.fail("Invalid applicationId");
    }
	
	//Commenting out lines below, all tables exist at this point and have been properly configured
	//so avoiding this overhead
	/*
	logger.debug('pre: Start initialization of newbie data...');	
	babyController.initBabyData()
		.then(function(resp) {
			logger.debug("pre: Successfully initialized baby data");
		})
		.catch(function(error) {
			logger.error("pre: An error occurred initializing baby data: " + error.message + ", " + error.stack);
		});
	
	weightController.initWeightData()
		.then(function(resp) {
			logger.debug("pre: Successfully initialized weight data");
		})
		.catch(function(error) {
			logger.error("pre: An error occurred initializing weight data: " + error.message + ", " + error.stack);
		});
	
	feedController.initFeedData()
		.then(function(resp) {
			logger.debug("pre: Successfully initialized feed data");
		})
		.catch(function(error) {
			logger.error("pre: An error occurred initializing feed data: " + error.message + ", " + error.stack);
		});
	
	diaperController.initDiaperData()
		.then(function(resp) {
			logger.debug("pre: Successfully initialized diaper data");
		})
		.catch(function(error) {
			logger.error("pre: An error occurred initializing diaper data: " + error.message + ", " + error.stack);
		});
	
	activityController.initActivityData()
		.then(function(resp) {
			logger.debug("pre: Successfully initialized activity data");
		})
		.catch(function(error) {
			logger.error("pre: An error occurred initializing activity data: " + error.message + ", " + error.stack);
		});
	
	sleepController.initSleepData()
		.then(function(resp) {
			logger.debug("pre: Successfully initialized sleep data");
		})
		.catch(function(error) {
			logger.error("pre: An error occurred initializing sleep data: " + error.message + ", " + error.stack);
		});
		*/
};

/**
 * Triggered when the user says "Launch Newbie" - essentially a boot-up/introduction
 * to the app that describes what it's all about.
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This function generates a response that gives a basic introduction
 * 					to Newbie and points the User as to how to start.
 */
app.launch(function(req, res) {
	logger.info('launch [%s, %s]: Starting ...', req.userId, req.data.request.requestId);
	var prompt = 'You can ask Newbie to track information about your baby. To begin, say Add baby. ' +
		"If you've already added your baby, say ''Help'' to find out what else you can do with Newbie";
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
	'utterances': ['{daily summary} {|for} {-|NAME}']
}, function(request, response) {
	var babyName = request.slot('NAME');
	logger.debug('dailySummaryIntent [%s, %s]: Getting summary for userId %s', 
			request.userId, request.data.request.requestId, request.userId);
	summaryController.getDailySummary(request.userId, babyName)
		.then(function(responseRetval) {
			logger.info('dailySummaryIntent [%s, %s]: babyName %s, Response %s', 
					request.userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug('dailySummaryIntent [%s, %s]: Completed successfully', 
					request.userId, request.data.request.requestId);
		}, function (error) {
			logger.error("dailySummaryIntent [%s, %s]: An error occurred getting the daily summary: " + error.message + ", " + error.stack, 
					request.userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
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
	'utterances': ['{weekly summary} {|for} {-|NAME}']
}, function(request, response) {
	var babyName = request.slot('NAME');
	logger.debug('weeklySummaryIntent [%s, %s]: Getting summary for userId %s', 
			request.userId, request.data.request.requestId, request.userId);
	summaryController.getWeeklySummary(request.userId, babyName)
		.then(function(responseRetval) {
			logger.info('weeklySummaryIntent [%s, %s]: babyName %s, Response %s', 
					request.userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug('weeklySummaryIntent [%s, %s]: Completed successfully', 
					request.userId, request.data.request.requestId);
		}, function (error) {
			logger.error("weeklySummaryIntent [%s, %s]: An error occurred getting the weekly summary: " + error.message + ", " + error.stack, 
					request.userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
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
	var babyName = request.slot('NAME');
	logger.debug('startSleepIntent [%s, %s]: started sleep', request.userId, request.data.request.requestId );
	var userId = request.userId;
	var now = new Date();
	sleepController.startSleep(userId, now, babyName)
		.then(function(responseRetval) {
			logger.info('startSleepIntent [%s, %s]: babyName %s, Response %s', 
					request.userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();
			response.shouldEndSession(true);
		}, function (error) {
			logger.error("startSleepIntent [%s, %s]: An error occurred starting sleep: " + error.message + ", " + error.stack, 
					request.userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
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
	logger.debug('endSleepIntent [%s, %s]: ended sleep', 
			request.userId, request.data.request.requestId);
	var babyName = request.slot('NAME');
	var userId = request.userId;
	var now = new Date();
	sleepController.endSleep(userId, now, babyName)
		.then(function(responseRetval) {
			logger.info('endSleepIntent [%s, %s]: babyName %s, response %s', 
					request.userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();
			response.shouldEndSession(true);
		}, function (error) {
			logger.error("endSleepIntent [%s, %s]: An error occurred ending sleep: " + error.message + ", " + error.stack, 
					request.userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
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
	'utterances': ['{|remove|delete|undo} sleep {|for} {-|NAME}']
},
function(request, response) {
	logger.debug("removeSleepIntent [%s, %s]", request.userId, request.data.request.requestId);
	var babyName = request.slot('NAME');
	sleepController.removeLastSleep(request.userId, babyName)
		.then(function(responseRetval) {
			logger.info('removeSleepIntent [%s, %s]: babyName %s, response %s', 
					request.userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("removeSleepIntent [%s, %s]: Sleep successfully removed, response: %s", 
					request.userId, request.data.request.requestId, responseRetval.toString());
		}, function (error) {
			logger.error("removeSleepIntent [%s, %s]: An error occurred removing sleep: " + error.message + ", " + error.stack, 
					request.userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
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
	'utterances': ['how long has {|baby} {|the baby} {-|NAME} been awake']
	}, function(request, response) {
		var babyName = request.slot('NAME');
		sleepController.getAwakeTime(request.userId, babyName)
			.then(function(responseRetval) {
				logger.info('getAwakeTimeIntent [%s, %s]: babyName %s, Response %s', 
						request.userId, request.data.request.requestId, babyName, responseRetval);
				response.say(responseRetval.message).send();	
				response.shouldEndSession(true);
				logger.debug("getAwakeTimeIntent [%s, %s]: Successfully completed", 
						request.userId, request.data.request.requestId);
			}, function (error) {
				logger.error("getAwakeTimeIntent [%s, %s]: An error occurred getting awake time: " + error.message + ", " + error.stack, 
						request.userId, request.data.request.requestId);
				response.say(error.message).send();
				response.shouldEndSession(true);
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
	'utterances': ['when did {|baby} {|the baby} {-|NAME} last eat']
	}, function(request, response) {
		var babyName = request.slot('NAME');
		feedController.getLastFeed(request.userId, babyName)
			.then(function(responseRetval) {
				logger.info('getLastFeedIntent [%s, %s]: babyName, Response %s', 
						request.userId, request.data.request.requestId, babyName, responseRetval);
				response.say(responseRetval.message).send();	
				response.shouldEndSession(true);
				logger.debug("getLastFeedIntent [%s, %s]: Successfully completed", 
						request.userId, request.data.request.requestId);
			}, function (error) {
				logger.error("getLastFeedIntent [%s, %s]: An error occurred getting last feed: " + error.message + ", " + error.stack, 
						request.userId, request.data.request.requestId);
				response.say(error.message).send();
				response.shouldEndSession(true);
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
	var now = new Date();
	var feedAmount;
	var babyName = request.slot('NAME');
	logger.debug('addFeedIntent [%s, %s]: %d ounces for %s', 
			request.userId, request.data.request.requestId, request.slot('NUM_OUNCES'), now.toString());
	
	if( request.slot('NUM_OUNCES') ) {
		feedAmount = parseInt(request.slot('NUM_OUNCES'));
	}
	feedController.addFeed(request.userId, now, feedAmount, babyName)
		.then(function(responseRetval) {
			logger.info('addFeedIntent [%s, %s]: babyName %s, feedAmount %d, response %s', 
					request.userId, request.data.request.requestId, babyName, feedAmount, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("addFeedIntent [%s, %s]: Feed successfully added, response: %s", 
					request.userId, request.data.request.requestId, responseRetval.toString());
		}, function (error) {
			logger.error("addFeedIntent [%s, %s]: An error occurred adding feed: " + error.message + ", " + error.stack, 
					request.userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
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
	'utterances': ['{|remove|delete|undo} feed {|for} {-|NAME}']
},
function(request, response) {
	logger.debug("removeFeedIntent [%s, %s]", request.userId, request.data.request.requestId);
	var babyName = request.slot('NAME');
	feedController.removeLastFeed(request.userId, babyName)
		.then(function(responseRetval) {
			logger.info('removeFeedIntent [%s, %s]: babyName %s, response %s', 
					request.userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("removeFeedIntent [%s, %s]: Feed successfully removed, response: %s", 
					request.userId, request.data.request.requestId, responseRetval.toString());
		}, function (error) {
			logger.error("removeFeedIntent [%s, %s]: An error occurred removing feed: " + error.message + ", " + error.stack, 
					request.userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
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
	var activity = request.slot('ACTIVITY');
	var babyName = request.slot('NAME');
	logger.debug('addActivityIntent [%s, %s]: %s', request.userId, activity);
	
	activityController.addActivity(request.userId, activity, new Date(), babyName)
		.then(function(responseRetval) {
			logger.info('addActivityIntent [%s, %s]: babyName %s, activity %s, Response %s', 
					request.userId, request.data.request.requestId, babyName, activity, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("addActivityIntent [%s, %s]: Activity successfully added: %s", 
					request.userId, request.data.request.requestId, responseRetval.toString());
		})
		.catch(function(error) {
			logger.error("addActivityIntent [%s, %s]: An error occurred adding activity: " + error.message + ", " + error.stack, 
					request.userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
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
		'ACTIVITY': 'ACTIVITY_TYPE',
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|remove|delete|undo} activity {|for} {-|NAME}']
},
function(request, response) {
	logger.debug("removeActivityIntent [%s, %s]", request.userId, request.data.request.requestId);
	var babyName = request.slot('NAME');
	activityController.removeLastActivity(request.userId, babyName)
		.then(function(responseRetval) {
			logger.info('removeActivityIntent [%s, %s]: babyName %s, Response %s', 
					request.userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("removeActivityIntent [%s, %s]: Activity successfully removed, response: %s", 
					request.userId, request.data.request.requestId, responseRetval.toString());
		}, function (error) {
			logger.error("removeActivityIntent [%s, %s]: An error occurred removing activity: " + error.message + ", " + error.stack, 
					request.userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
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
	var diaperType1 = request.slot('FIRST_DIAPER_TYPE');
	var diaperType2 = request.slot('SECOND_DIAPER_TYPE');
	var babyName = request.slot('NAME');
	logger.debug("addDiaperIntent [%s, %s]: %s diaper AND %s diaper", 
			request.userId, request.data.request.requestId, diaperType1, diaperType2);
	var isWet = determineIfWetDiaper(diaperType1) || determineIfWetDiaper(diaperType2);
	var isDirty = determineIfDirtyDiaper(diaperType1) || determineIfDirtyDiaper(diaperType2);
	logger.debug("addDiaperIntent [%s, %s]: wet -- %s, dirty -- %s", 
			request.userId, request.data.request.requestId, isWet, isDirty);
	var now = new Date();
	diaperController.addDiaper(request.userId, now, isWet, isDirty, babyName)
		.then(function(responseRetval) {
			logger.info('addDiaperIntent [%s, %s]: babyName %s, diaperType1 %s, diaperType2 %s, Response %s', 
					request.userId, request.data.request.requestId, babyName, diaperType1, diaperType2, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("addDiaperIntent [%s, %s]: Diaper successfully added, response: %s", 
					request.userId, request.data.request.requestId, responseRetval.toString());
		}, function (error) {
			logger.error("addDiaperIntent [%s, %s]: An error occurred adding diaper: " + error.message + ", " + error.stack, 
					request.userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
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
	'utterances': ['{|remove|delete|undo} diaper {|for} {-|NAME}']
},
function(request, response) {
	var babyName = request.slot('NAME');
	logger.debug("removeDiaperIntent [%s, %s]", request.userId, request.data.request.requestId);
	diaperController.removeLastDiaper(request.userId, babyName)
		.then(function(responseRetval) {
			logger.info('removeDiaperIntent [%s, %s]: babyName %s, Response %s', 
					request.userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("removeDiaperIntent [%s, %s]: Diaper successfully removed, response: %s", 
					request.userId, request.data.request.requestId, responseRetval.toString());
		}, function (error) {
			logger.error("removeDiaperIntent [%s, %s]: An error occurred removing diaper: " + error.message + ", " + error.stack, 
					request.userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
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
	    // Get the slot
		//TODO: Should the integer parsing really be done in the controller, where we're already type checking?
	    var pounds = parseInt(request.slot('NUM_POUNDS'));
	    var ounces = parseInt(request.slot('NUM_OUNCES'));
	    var babyName = request.slot('NAME');
	    logger.debug("addWeightIntent [%s, %s]: %d pounds, %d ounces, request %s", 
	    		request.userId, request.data.request.requestId, pounds, ounces, JSON.stringify(request));
	    var now = new Date();
	    
	    if(pounds !== undefined && pounds !== "?" && ounces !== undefined && ounces !== "?") {
	    	var addWeightPromise = weightController.addWeight(
					request.userId, 
					now,
					pounds,
					ounces,
					babyName
				);
			addWeightPromise.then(function(responseRetval) {
				logger.debug('addWeightIntent [%s, %s]: %s', request.userId, request.data.request.requestId, responseRetval);
				response.say(responseRetval.message).send();	
				//TODO: ideally return the percentile and add that to the card as well
				response.card(responseRetval.cardTitle, responseRetval.cardBody);
				response.shouldEndSession(true);
				logger.info("addWeightIntent [%s, %s]: babyName %s, pounds %d, ounces %d, Weight successfully added, %s", 
						request.userId, request.data.request.requestId, babyName, pounds, ounces, responseRetval.toString());
			}, function (error) {
				logger.error("addWeightIntent [%s, %s]: An error occurred adding weight: " + error.message + ", " + error.stack, 
						request.userId, request.data.request.requestId);
				response.say(error.message).send();
				response.shouldEndSession(true);
			});
	    } else {
	    	logger.error("addWeightIntent [%s, %s]: Couldn't add weight. Both pounds and ounces must be specified, pounds - %d, ounces - %d",
	    			request.userId, request.data.request.requestId, pounds, ounces);
	    	response.say("I'm sorry, I couldn't add weight - you must specify both pounds and ounces").send();		
			response.shouldEndSession(true);
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
	'utterances': ['{|remove|delete|undo} weight {|for} {-|NAME}']
},
function(request, response) {
	logger.debug("removeWeightIntent [%s, %s]", request.userId, request.data.request.requestId);
	var babyName = request.slot('NAME');
	weightController.removeLastWeight(request.userId, babyName)
		.then(function(responseRetval) {
			logger.info('removeWeightIntent [%s, %s]: babyName %s, %s', 
					request.userId, request.data.request.requestId, babyName, responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("removeWeightIntent [%s, %s]: Weight successfully removed, response: %s", 
					request.userId, request.data.request.requestId, responseRetval.toString());
		}, function (error) {
			logger.error("removeWeightIntent [%s, %s]: An error occurred removing weight: " + error.message + ", " + error.stack, 
					request.userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
		});
	return false;
});

var addBabyFunction = function(request, response, babyName, babySex, babyBirthdate, timezone, daylightSavingsObserved) {
	var addBabyPromise = babyController.addBaby(
			request.userId, 
			babySex, 
			babyName, 
			new Date(babyBirthdate),
			timezone,
			daylightSavingsObserved
		);
	addBabyPromise.then(function(responseRetval) {
		logger.debug('addBabyIntent [%s, %s]: %s', request.userId, request.data.request.requestId, responseRetval.toString());
		
		//Send response
		response.say(responseRetval.message).send();		
		response.shouldEndSession(true);
		logger.info("addBabyIntent [%s, %s]: Baby successfully added, response: %s", request.userId, request.data.request.requestId, responseRetval.toString());
	}, function (error) {
		logger.error("addBabyIntent [%s, %s]: An error occurred adding baby: " + error.message + ", " + error.stack, 
				request.userId, request.data.request.requestId);
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
	'utterances': ['{|add|record} {|baby|child|kid}', '{-|SEX}', '{-|BIRTHDATE}', '{-|NAME}', '{-|TIMEZONE}', '{-|DAYLIGHT_SAVINGS_OBSERVED}']
	},
	function(request, response) {
		try {
			var sexValue = request.slot("SEX");
			var nameValue = request.slot("NAME");
			var birthdateValue = request.slot("BIRTHDATE");
			var timezoneValue = request.slot("TIMEZONE");
			logger.debug('addBabyIntent [%s, %s]: Processing with sexValue: %s, nameValue: %s, birthdateValue: %s, timezoneValue: %s: %s', 
					request.userId, request.data.request.requestId, sexValue, nameValue, birthdateValue, timezoneValue);
			
			var babyData = request.session(NEWBIE_ADD_BABY_SESSION_KEY);
			if(babyData === undefined) {
				logger.debug('addBabyIntent [%s, %s]: babyData does not yet exist, creating...', request.userId, request.data.request.requestId);
				babyData = {};
			} else {
				logger.debug('addBabyIntent [%s, %s]: babyData exists - %s', request.userId, request.data.request.requestId, JSON.stringify(babyData));
			}
			if( sexValue ) {
				logger.debug('addBabyIntent [%s, %s]: Adding sexValue %s', request.userId, request.data.request.requestId, sexValue);
				babyData.sex = sexValue;
			}
			if( nameValue ) {
				logger.debug('addBabyIntent [%s, %s]: Adding nameValue %s', request.userId, request.data.request.requestId, nameValue);
				babyData.name = nameValue;
			}
			if( birthdateValue ) {
				logger.debug('addBabyIntent [%s, %s]: Adding birthdateValue %s', request.userId, request.data.request.requestId, birthdateValue);
				babyData.birthdate = birthdateValue;
			}
			if( timezoneValue ) {
				logger.debug('addBabyIntent [%s, %s]: Adding timezoneValue %s', request.userId, request.data.request.requestId, timezoneValue);
				babyData.timezone = timezoneValue;
			}

			response.session(NEWBIE_ADD_BABY_SESSION_KEY, babyData);
			logger.debug('addBabyIntent [%s, %s]: babyData - %s', request.userId, request.data.request.requestId, JSON.stringify(babyData));
			
			if(!babyData.name) {
				response.say("What is your baby's first name?").send();
				response.shouldEndSession(false);
			} else if(!babyData.sex) {
				response.say('Is ' + babyData.name + ' a boy or girl?').send();
				response.shouldEndSession(false);
			} else if(!babyData.birthdate) {
				response.say("What is " + Utils.hisHer(babyData.sex, false) + " birthdate?").send();
				response.shouldEndSession(false);
			} else if(!babyData.timezone) {
				response.say('What is your timezone? For example: Eastern, Central, Mountain, Pacific').send();
				response.shouldEndSession(false);
			} else if(babyData.timezone === "mountain") {
				response.say('Is daylight savings time observed in your location?').send();
				response.shouldEndSession(false);
			} else {
				var babyName = babyData.name;
				var babySex = babyData.sex;
				var babyBirthdate = babyData.birthdate;
				var babyTimezone = babyData.timezone;
				
				//Clear session
				babyData = {};
				response.session(NEWBIE_ADD_BABY_SESSION_KEY, babyData);
				
				//Process request
				addBabyFunction(request, response, babyName, babySex, babyBirthdate, babyTimezone, false);
			} 
			//TODO: Checking if baby already exists. Right now, it just overwrites, which may be ok.
		} catch( err ) {
			logger.error("addBabyIntent [%s, %s]: An error occurred adding baby: " + err.message + ", " + err.stack, request.userId);
			response.say(err.message).send();
			response.shouldEndSession(true);
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
	var babyName = request.slot('NAME');
	logger.info("removeBabyIntent [%s, %s]: Removing baby %s...", request.userId, request.data.request.requestId, babyName);
	
	var babyData = request.session(NEWBIE_REMOVE_BABY_SESSION_KEY);
	if(babyData === undefined) {
		logger.debug('removeBabyIntent [%s, %s]: babyData does not yet exist, creating...', request.userId, request.data.request.requestId);
		babyData = {};
	} else {
		logger.debug('removeBabyIntent [%s, %s]: babyData exists - %s', request.userId, request.data.request.requestId, JSON.stringify(babyData));
	}
	
	if( babyName ) {
		logger.debug('removeBabyIntent [%s, %s]: Adding babyName %s', request.userId, request.data.request.requestId, babyName);
		babyData.name = babyName;
	}
	response.session(NEWBIE_REMOVE_BABY_SESSION_KEY, babyData);
	logger.debug('removeBabyIntent [%s, %s]: babyData %s', request.userId, request.data.request.requestId, JSON.stringify(babyData));
	
	if(!babyData.name) {
		response.say("What is the first name of the baby whose data you want to remove?").send();
		response.shouldEndSession(false);
	} else {
		response.say("Are you sure you want to delete all newbie data for baby " + babyData.name + "?").send();
		response.shouldEndSession(false);
	}
	return false;
});

var exitFunction = function(request, response) {
	var speechOutput = 'Goodbye.';
	response.say(speechOutput);
	response.shouldEndSession(true);
};

var removeBabyFunction = function(request, response, babyName) {
	logger.debug('removeBabyFunction [%s, %s]: removing baby data...', request.userId, request.data.request.requestId);
	babyController.removeBaby(request.userId, babyName)
		.then(function(responseRetval) {
			logger.info('removeBabyIntent [%s, %s]: babyName %s, %s', 
					request.userId, request.data.request.requestId, babyName, responseRetval.toString());
						
			//Send response
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("removeBabyIntent [%s, %s]: Baby successfully removed, response: %s", 
					request.userId, request.data.request.requestId, responseRetval.toString());
		}, function (error) {
			logger.error("removeBabyIntent [%s, %s]: An error occurred removing baby: " + error.message + ", " + error.stack, 
					request.userId, request.data.request.requestId);
			response.say(error.message).send();
			response.shouldEndSession(true);
		});
};

app.intent('AMAZON.YesIntent', function(request, response) {
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
		removeBabyFunction(request, response, removeBabyName);
	} else if( addBabyData && addBabyData.name ) {
		//User was in the middle of an add request and answering the question
		//about daylight savings
		var babyName = addBabyData.name;
		var babySex = addBabyData.sex;
		var babyBirthdate = addBabyData.birthdate;
		var babyTimezone = addBabyData.timezone;
		
		//Clear session
		addBabyData = {};
		response.session(NEWBIE_ADD_BABY_SESSION_KEY, addBabyData);
		
		//Process request
		addBabyFunction(request, response, babyName, babySex, babyBirthdate, babyTimezone, true);
	} else {
		logger.error("YesIntent [%s, %s]: Unclear what user is responding yes to");
		response.say("I'm sorry, I didn't understand your request").send();
		response.shouldEndSession(true);
	}
	return false;
});

app.intent('AMAZON.NoIntent', function(request, response) {
	var removeBabyData = request.session(NEWBIE_REMOVE_BABY_SESSION_KEY);
	var addBabyData = request.session(NEWBIE_ADD_BABY_SESSION_KEY);

	if( removeBabyData && removeBabyData.name) {
		//User was in the middle of a delete request
	
		//Clear session
		removeBabyData = {};
		response.session(NEWBIE_REMOVE_BABY_SESSION_KEY, removeBabyData);
	
		//Report cancel
		response.say("Ok, cancelling delete request").send();
		response.shouldEndSession(true);
	} else if( addBabyData && addBabyData.name ) {
		//User was in the middle of an add request and answering the question
		//about daylight savings
		var babyName = addBabyData.name;
		var babySex = addBabyData.sex;
		var babyBirthdate = addBabyData.birthdate;
		var babyTimezone = addBabyData.timezone;
		
		//Clear session
		addBabyData = {};
		response.session(NEWBIE_ADD_BABY_SESSION_KEY, addBabyData);
		
		//Process request
		addBabyFunction(request, response, babyName, babySex, babyBirthdate, babyTimezone, false);
	} else {
		logger.error("NoIntent [%s, %s]: Unclear what user is responding no to");
		response.say("I'm sorry, I didn't understand your request").send();
		response.shouldEndSession(true);
	}
});

app.intent('AMAZON.StopIntent', exitFunction);

app.intent('AMAZON.CancelIntent', exitFunction);

app.intent('AMAZON.HelpIntent', function(request, response) {
	var speechOutput = "To first set up Newbie, say 'tell newbie to add baby'. After that, here are some examples of things you can tell Newbie: " +
		HELP_TEXT;
	response.say(speechOutput);
	response.shouldEndSession(true);
});

module.exports = app;