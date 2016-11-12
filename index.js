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
var NEWBIE_SESSION_KEY = 'newbie';

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
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Newbie - '+ (undefined !== options.message ? options.message : '') +
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
 * setup any needed data.
 * 
 * @param request 	The request made to the Echo. See https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/alexa-skills-kit-interface-reference#request-format
 * @param response  The spoken Echo response + any cards delivered to the Alexa app.
 * 					This function does not generate a response.
 */
//Commenting out lines below, all tables exist at this point and have been properly configured
//so avoiding this overhead
/*
app.pre = function(request, response, type) {
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
};
*/

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
	logger.debug('launch: Starting...');
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
	'utterances': ['{daily summary}']
}, function(request, response) {
	logger.debug('dailySummaryIntent: Getting summary for userId %s', request.userId);
	summaryController.getDailySummary(request.userId)
		.then(function(responseRetval) {
			logger.info('dailySummaryIntent: Response %s', responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug('dailySummaryIntent: Completed successfully');
		}, function (error) {
			logger.error("An error occurred getting the daily summary: " + error.message + ", " + error.stack);
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
	'utterances': ['{weekly summary}']
}, function(request, response) {
	logger.debug('weeklySummaryIntent: Getting summary for userId %s', request.userId);
	summaryController.getWeeklySummary(request.userId)
		.then(function(responseRetval) {
			logger.info('weeklySummaryIntent: Response %s', responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug('weeklySummaryIntent: Completed successfully');
		}, function (error) {
			logger.error("An error occurred getting the weekly summary: " + error.message + ", " + error.stack);
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
	logger.debug('startSleepIntent: started sleep');
	var userId = request.userId;
	var now = new Date();
	sleepController.startSleep(userId, now)
		.then(function(responseRetval) {
			logger.info('startSleepIntent: %s', responseRetval.toString());
			response.say(responseRetval.message).send();
			response.shouldEndSession(true);
		}, function (error) {
			logger.error("startSleepIntent: An error occurred starting sleep: " + error.message + ", " + error.stack);
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
	logger.debug('endSleepIntent: ended sleep');
	var userId = request.userId;
	var now = new Date();
	sleepController.endSleep(userId, now)
		.then(function(responseRetval) {
			logger.info('endSleepIntent: %s', responseRetval.toString());
			response.say(responseRetval.message).send();
			response.shouldEndSession(true);
		}, function (error) {
			logger.error("endSleepIntent: An error occurred ending sleep: " + error.message + ", " + error.stack);
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
	'utterances': ['{|remove|delete|undo} sleep']
},
function(request, response) {
	logger.debug("removeSleepIntent");
	sleepController.removeLastSleep(request.userId)
		.then(function(responseRetval) {
			logger.info('removeSleepIntent: %s', responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("Sleep successfully removed, response: %s", responseRetval.toString());
		}, function (error) {
			logger.error("An error occurred removing sleep: " + error.message + ", " + error.stack);
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
		sleepController.getAwakeTime(request.userId)
			.then(function(responseRetval) {
				logger.info('getAwakeTimeIntent: Response %s', responseRetval);
				response.say(responseRetval.message).send();	
				response.shouldEndSession(true);
				logger.debug("getAwakeTimeIntent: Successfully completed");
			}, function (error) {
				logger.error("getAwakeTimeIntent: An error occurred getting awake time: " + error.message + ", " + error.stack);
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
		feedController.getLastFeed(request.userId)
			.then(function(responseRetval) {
				logger.info('getLastFeedIntent: Response %s', responseRetval);
				response.say(responseRetval.message).send();	
				response.shouldEndSession(true);
				logger.debug("getLastFeedIntent: Successfully completed");
			}, function (error) {
				logger.error("getLastFeedIntent: An error occurred getting last feed: " + error.message + ", " + error.stack);
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
		'NUM_OUNCES': 'AMAZON.NUMBER'
	},
	'utterances': ['{|add|record} {-|NUM_OUNCES} {|ounce} {|feed|bottle}']
}, function(request, response) {
	var feedAmount = parseInt(request.slot('NUM_OUNCES'));
	var now = new Date();
	logger.debug('addFeedIntent: %d ounces for %s', feedAmount, now.toString());
	
	feedController.addFeed(request.userId, now, feedAmount)
		.then(function(responseRetval) {
			logger.info('addFeedIntent: %s', responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("Feed successfully added, response: %s", responseRetval.toString());
		}, function (error) {
			logger.error("An error occurred adding feed: " + error.message + ", " + error.stack);
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
	'utterances': ['{|remove|delete|undo} feed']
},
function(request, response) {
	logger.debug("removeFeedIntent");
	feedController.removeLastFeed(request.userId)
		.then(function(responseRetval) {
			logger.info('removeFeedIntent: %s', responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("Feed successfully removed, response: %s", responseRetval.toString());
		}, function (error) {
			logger.error("An error occurred removing feed: " + error.message + ", " + error.stack);
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
		'ACTIVITY': 'ACTIVITY_TYPE'
	},
	'utterances': ['{|add|record} activity {-|ACTIVITY}']
}, function(request, response) {
	var activity = request.slot('ACTIVITY');
	logger.debug('addActivityIntent: %s', activity);
	
	activityController.addActivity(request.userId, activity)
		.then(function(responseRetval) {
			logger.info('addActivityIntent: Response %s', responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("Activity successfully added: %s", responseRetval.toString());
		})
		.catch(function(error) {
			logger.error("An error occurred adding activity: " + error.message + ", " + error.stack);
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
	'utterances': ['{|remove|delete|undo} activity']
},
function(request, response) {
	logger.debug("removeActivityIntent");
	activityController.removeLastActivity(request.userId)
		.then(function(responseRetval) {
			logger.info('removeActivityIntent: %s', responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("Activity successfully removed, response: %s", responseRetval.toString());
		}, function (error) {
			logger.error("An error occurred removing activity: " + error.message + ", " + error.stack);
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
		'SECOND_DIAPER_TYPE': 'DIAPER_TYPE'
	},
	'utterances': ['{|add|record} {-|FIRST_DIAPER_TYPE} {|AND} {-|SECOND_DIAPER_TYPE} diaper']
},
function(request, response) {
	var diaperType1 = request.slot('FIRST_DIAPER_TYPE');
	var diaperType2 = request.slot('SECOND_DIAPER_TYPE');
	logger.debug("addDiaperIntent: %s diaper AND %s diaper", diaperType1, diaperType2);
	var isWet = determineIfWetDiaper(diaperType1) || determineIfWetDiaper(diaperType2);
	var isDirty = determineIfDirtyDiaper(diaperType1) || determineIfDirtyDiaper(diaperType2);
	logger.debug("addDiaperIntent: wet -- %s, dirty -- %s", isWet, isDirty);
	var now = new Date();
	diaperController.addDiaper(request.userId, now, isWet, isDirty)
		.then(function(responseRetval) {
			logger.info('addDiaperIntent: %s', responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("Diaper successfully added, response: %s", responseRetval.toString());
		}, function (error) {
			logger.error("An error occurred adding diaper: " + error.message + ", " + error.stack);
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
	'utterances': ['{|remove|delete|undo} diaper']
},
function(request, response) {
	logger.debug("removeDiaperIntent");
	diaperController.removeLastDiaper(request.userId)
		.then(function(responseRetval) {
			logger.info('removeDiaperIntent: %s', responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("Diaper successfully removed, response: %s", responseRetval.toString());
		}, function (error) {
			logger.error("An error occurred removing diaper: " + error.message + ", " + error.stack);
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
        'NUM_OUNCES': 'AMAZON.NUMBER'
    },
    'utterances': ['{|add|record} {|weight} {-|NUM_POUNDS} {|pounds} {-|NUM_OUNCES} {|ounces}']
	},

	function(request, response) {
	    // Get the slot
		//TODO: Should the integer parsing really be done in the controller, where we're already type checking?
	    var pounds = parseInt(request.slot('NUM_POUNDS'));
	    var ounces = parseInt(request.slot('NUM_OUNCES'));
	    logger.debug("addWeightIntent: %d pounds, %d ounces, request %s", pounds, ounces, JSON.stringify(request));
	    var now = new Date();
	    
	    if(pounds !== undefined && pounds !== "?" && ounces !== undefined && ounces !== "?") {
	    	var addWeightPromise = weightController.addWeight(
					request.userId, 
					now,
					pounds,
					ounces
				);
			addWeightPromise.then(function(responseRetval) {
				logger.debug('addWeightIntent: %s', responseRetval);
				response.say(responseRetval.message).send();	
				//TODO: ideally return the percentile and add that to the card as well
				response.card(responseRetval.cardTitle, responseRetval.cardBody);
				response.shouldEndSession(true);
				logger.info("Weight successfully added, %s", responseRetval.toString());
			}, function (error) {
				logger.error("An error occurred adding weight: " + error.message + ", " + error.stack);
				response.say(error.message).send();
				response.shouldEndSession(true);
			});
	    } else {
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
	'utterances': ['{|remove|delete|undo} weight']
},
function(request, response) {
	logger.debug("removeWeightIntent");
	weightController.removeLastWeight(request.userId)
		.then(function(responseRetval) {
			logger.info('removeWeightIntent: %s', responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card(responseRetval.cardTitle, responseRetval.cardBody);
			response.shouldEndSession(true);
			logger.debug("Weight successfully removed, response: %s", responseRetval.toString());
		}, function (error) {
			logger.error("An error occurred removing weight: " + error.message + ", " + error.stack);
			response.say(error.message).send();
			response.shouldEndSession(true);
		});
	return false;
});

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
		'TIMEZONE': 'TIMEZONE',
		'DAYLIGHT_SAVINGS_OBSERVED' : 'YES_NO'
	},
	'utterances': ['{|add|record} {|baby|child|kid}', '{-|SEX}', '{-|BIRTHDATE}', '{-|NAME}', '{-|TIMEZONE}', '{-|DAYLIGHT_SAVINGS_OBSERVED}']
	},
	function(request, response) {
		try {
			var sexValue = request.slot("SEX");
			var nameValue = request.slot("NAME");
			var birthdateValue = request.slot("BIRTHDATE");
			var timezoneValue = request.slot("TIMEZONE");
			var daylightSavingsObservedValue = request.slot('DAYLIGHT_SAVINGS_OBSERVED');
			logger.debug('addBabyIntent: Processing with sexValue: %s, nameValue: %s, birthdateValue: %s, timezoneValue: %s, daylightSavingsObseved: %s', 
					sexValue, nameValue, birthdateValue, timezoneValue, daylightSavingsObservedValue);
			
			var babyData = request.session(NEWBIE_SESSION_KEY);
			if(babyData === undefined) {
				logger.debug('addBabyIntent: babyData does not yet exist, creating...');
				babyData = {};
			} else {
				logger.debug('addBabyIntent: babyData exists - %s', JSON.stringify(babyData));
			}
			if( sexValue ) {
				logger.debug('addBabyIntent: Adding sexValue %s', sexValue);
				babyData.sex = sexValue;
			}
			if( nameValue ) {
				logger.debug('addBabyIntent: Adding nameValue %s', nameValue);
				babyData.name = nameValue;
			}
			if( birthdateValue ) {
				logger.debug('addBabyIntent: Adding birthdateValue %s', birthdateValue);
				babyData.birthdate = birthdateValue;
			}
			if( timezoneValue ) {
				logger.debug('addBabyIntent: Adding timezoneValue %s', timezoneValue);
				babyData.timezone = timezoneValue;
			}
			if( daylightSavingsObservedValue ) {
				logger.debug('addBabyIntent: Adding daylightSavingsObservedValue %s', daylightSavingsObservedValue);
				babyData.daylightSavingsObservedValue = daylightSavingsObservedValue;
			}
			response.session(NEWBIE_SESSION_KEY, babyData);
			logger.debug('addBabyIntent: babyData - %s', JSON.stringify(babyData));
			
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
			} else if(!daylightSavingsObservedValue && babyData.timezone === "mountain") {
				response.say('Is daylight savings time observed in your location?').send();
				response.shouldEndSession(false);
			} else {		
				var daylightSavingsObserved = babyData.daylightSavingsObservedValue === "no" ? false : true;
				var addBabyPromise = babyController.addBaby(
						request.userId, 
						babyData.sex, 
						babyData.name, 
						new Date(babyData.birthdate),
						babyData.timezone,
						daylightSavingsObserved
					);
				addBabyPromise.then(function(responseRetval) {
					logger.debug('addBabyIntent: %s', responseRetval.toString());
					response.say(responseRetval.message).send();		
					response.shouldEndSession(true);
					logger.info("Baby successfully added, response: %s", responseRetval.toString());
				}, function (error) {
					logger.error("An error occurred adding baby: " + error.message + ", " + error.stack);
					response.say(error.message).send();
					response.shouldEndSession(true);
				});
			} 
			//TODO: Checking if baby already exists. Right now, it just overwrites, which may be ok.
		} catch( err ) {
			logger.error("An error occurred adding baby: " + err.message + ", " + err.stack);
			response.say(err.message).send();
			response.shouldEndSession(true);
		}
		return false;
	}
);

var exitFunction = function(request, response) {
	var speechOutput = 'Goodbye.';
	response.say(speechOutput);
	response.shouldEndSession(true);
};

app.intent('AMAZON.StopIntent', exitFunction);

app.intent('AMAZON.CancelIntent', exitFunction);

app.intent('AMAZON.HelpIntent', function(request, response) {
	var speechOutput = "To first set up Newbie, say 'Alexa, tell newbie to add baby'. After that, here are some examples of things you can tell Newbie: " +
		HELP_TEXT;
	response.say(speechOutput);
	response.shouldEndSession(true);
});

module.exports = app;