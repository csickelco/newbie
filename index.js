'use strict';

module.change_code = 1;

var NEWBIE_SESSION_KEY = 'newbie';

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

var app = new Alexa.app('newbie');
var babyController = new BabyController();
var weightController = new WeightController();
var feedController = new FeedController();
var summaryController = new SummaryController();
var diaperController = new DiaperController();
var activityController = new ActivityController();
var sleepController = new SleepController();

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
//Winston.handleExceptions(new Winston.transports.Console());

app.pre = function(request, response, type) {
	logger.info('pre: Start initialization of newbie data...');
	//babyController.initBabyData();
	//weightController.initWeightData();
	//feedController.initFeedData();
	
	
	babyController.initBabyData()
		.then(function(resp) {
			logger.info("pre: Successfully initialized baby data");
		})
		.catch(function(error) {
			logger.error("pre: An error occurred initializing baby data: " + error.message + ", " + error.stack);
		});
	
	weightController.initWeightData()
		.then(function(resp) {
			logger.info("pre: Successfully initialized weight data");
		})
		.catch(function(error) {
			logger.error("pre: An error occurred initializing weight data: " + error.message + ", " + error.stack);
		});
	
	feedController.initFeedData()
		.then(function(resp) {
			logger.info("pre: Successfully initialized feed data");
		})
		.catch(function(error) {
			logger.error("pre: An error occurred initializing feed data: " + error.message + ", " + error.stack);
		});
	
	diaperController.initDiaperData()
		.then(function(resp) {
			logger.info("pre: Successfully initialized diaper data");
		})
		.catch(function(error) {
			logger.error("pre: An error occurred initializing diaper data: " + error.message + ", " + error.stack);
		});
	
	activityController.initActivityData()
		.then(function(resp) {
			logger.info("pre: Successfully initialized activity data");
		})
		.catch(function(error) {
			logger.error("pre: An error occurred initializing activity data: " + error.message + ", " + error.stack);
		});
	
	sleepController.initSleepData()
		.then(function(resp) {
			logger.info("pre: Successfully initialized sleep data");
		})
		.catch(function(error) {
			logger.error("pre: An error occurred initializing sleep data: " + error.message + ", " + error.stack);
		});
};

app.launch(function(req, res) {
	logger.info('launch: Starting...');
    var prompt = 'You can ask Newbie to track information about your baby. To begin, say Add baby';
    res.say(prompt).shouldEndSession(false);
    logger.info('launch: Successfully completed');
});

app.intent('dailySummaryIntent', {
	'utterances': ['{daily summary}']
}, function(request, response) {
	logger.info('dailySummaryIntent: Getting summary for userId %s', request.userId);
	summaryController.getDailySummary(request.userId)
		.then(function(responseRetval) {
			logger.info('dailySummaryIntent: Response %s', responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card("DailySummary - " + new Date().toLocaleDateString("en-US"), responseRetval.card);
			response.shouldEndSession(true);
			logger.info('dailySummaryIntent: Completed successfully');
		}, function (error) {
			logger.error("An error occurred getting the daily summary: " + error.message + ", " + error.stack);
		});
	return false;
});

app.intent('weeklySummaryIntent', {
	'utterances': ['{weekly summary}']
}, function(request, response) {
	logger.info('weeklySummaryIntent: Getting summary for userId %s', request.userId);
	summaryController.getWeeklySummary(request.userId)
		.then(function(responseRetval) {
			logger.info('weeklySummaryIntent: Response %s', responseRetval.toString());
			response.say(responseRetval.message).send();	
			response.card("Weekly Summary - " + new Date().toLocaleDateString("en-US"), responseRetval.card);
			response.shouldEndSession(true);
			logger.info('weeklySummaryIntent: Completed successfully');
		}, function (error) {
			logger.error("An error occurred getting the weekly summary: " + error.message + ", " + error.stack);
		});
	return false;
});

app.intent('startSleepIntent', {
	'slots': {
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|the baby} {-|NAME} {|is|started} {|sleeping|went to sleep|taking a nap|napping}']
}, function(request, response) {
	logger.info('startSleepIntent: started sleep');
	var userId = request.userId;
	var now = new Date();
	sleepController.startSleep(userId, now)
		.then(function(responseMsg) {
			logger.info('startSleepIntent: Response message %s', responseMsg);
			response.say(responseMsg).send();
			response.shouldEndSession(true);
		}, function (error) {
			logger.error("startSleepIntent: An error occurred starting sleep: " + error.message + ", " + error.stack);
		});
	return false;
});

app.intent('endSleepIntent', {
	'slots': {
		'NAME': 'AMAZON.US_FIRST_NAME'
	},
	'utterances': ['{|the baby} {-|NAME} {|is awake|woke up|finished sleeping|finished napping}']
}, function(request, response) {
	logger.info('endSleepIntent: ended sleep');
	var userId = request.userId;
	var now = new Date();
	sleepController.endSleep(userId, now)
		.then(function(responseMsg) {
			logger.info('endSleepIntent: Response message %s', responseMsg);
			response.say(responseMsg).send();
			response.shouldEndSession(true);
		}, function (error) {
			logger.error("endSleepIntent: An error occurred ending sleep: " + error.message + ", " + error.stack);
		});
	return false;
});

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
				logger.info("getAwakeTimeIntent: Successfully completed");
			});
		return false;
	}
);

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
				logger.info("getLastFeedIntent: Successfully completed");
			});
		return false;
	}
);

app.intent('addFeedIntent', {
	'slots': {
		'NUM_OUNCES': 'AMAZON.NUMBER'
	},
	'utterances': ['{|add|record} {-|NUM_OUNCES} {|ounce} {|feed|bottle}']
}, function(request, response) {
	var feedAmount = request.slot('NUM_OUNCES');
	var now = new Date();
	logger.info('addFeedIntent: %d ounces for %s', feedAmount, now.toString());
	
	feedController.addFeed(request.userId, now, feedAmount)
		.then(function(responseMsg) {
			logger.info('addFeedIntent: Response message %s', responseMsg);
			response.say(responseMsg).send();	
			response.card("Feed - " + now.toLocaleDateString("en-US"), feedAmount + " ounces");
			response.shouldEndSession(true);
			logger.info("Feed successfully added, message: %s", responseMsg);
		}, function (error) {
			logger.error("An error occurred adding feed: " + error.message + ", " + error.stack);
		});
	return false;
});

app.intent('addActivityIntent', {
	'slots': {
		'ACTIVITY': 'ACTIVITY_TYPE'
	},
	'utterances': ['{|add|record} activity {-|ACTIVITY}']
}, function(request, response) {
	var activity = request.slot('ACTIVITY');
	var now = new Date();
	logger.info('addActivityIntent: %s on %s', activity, now.toString());
	
	activityController.addActivity(request.userId, now, activity)
		.then(function(responseMsg) {
			logger.info('addActivityIntent: Response message %s', responseMsg);
			response.say(responseMsg).send();	
			response.card("Activity - " + now.toLocaleDateString("en-US"), responseMsg);
			response.shouldEndSession(true);
			logger.info("Activity successfully added, message: %s", responseMsg);
		}, function (error) {
			logger.error("An error occurred adding activity: " + error.message + ", " + error.stack);
		});
	return false;
});

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
	logger.info("addDiaperIntent: %s diaper AND %s diaper", diaperType1, diaperType2);
	var isWet = diaperType1 === "wet" || diaperType2 === "wet";
	var isDirty = diaperType1 === "dirty" || diaperType2 === "dirty"; //TODO: Add more flexible wording
	logger.info("addDiaperIntent: wet -- %s, dirty -- %s", isWet, isDirty);
	var now = new Date();
	diaperController.addDiaper(request.userId, now, isWet, isDirty)
		.then(function(responseMsg) {
			logger.info('addDiaperIntent: Response message %s', responseMsg);
			response.say(responseMsg).send();	
			response.card("Diaper - " + now.toLocaleDateString("en-US"), responseMsg);
			response.shouldEndSession(true);
			logger.info("Diaper successfully added, message: %s", responseMsg);
		}, function (error) {
			logger.error("An error occurred adding diaper: " + error.message + ", " + error.stack);
		});
	return false;
});

app.intent('addWeightIntent', {
    'slots': {
        'NUM_POUNDS': 'AMAZON.NUMBER',
        'NUM_OUNCES': 'AMAZON.NUMBER'
    },
    'utterances': ['{|add|record} {|weight} {-|NUM_POUNDS} {|pounds} {-|NUM_OUNCES} {|ounces}']
	},

	function(request, response) {
	    // Get the slot
	    var pounds = request.slot('NUM_POUNDS');
	    var ounces = request.slot('NUM_OUNCES');
	    logger.info("addWeightIntent: %d pounds, %d ounces, request %s", pounds, ounces, JSON.stringify(request));
	    var now = new Date();
	    
	    if(pounds !== undefined && pounds !== "?" && ounces !== undefined && ounces !== "?") {
	    	var addWeightPromise = weightController.addWeight(
					request.userId, 
					now,
					pounds,
					ounces
				);
			addWeightPromise.then(function(responseMsg) {
				logger.info('addWeightIntent: Response message %s', responseMsg);
				response.say(responseMsg).send();	
				//TODO: ideally return the percentile and add that to the card as well
				response.card("Weight - " + now.toLocaleDateString("en-US"), pounds + " pounds, " + ounces + ", ounces");
				response.shouldEndSession(true);
				logger.info("Weight successfully added, message: %s", responseMsg);
			}, function (error) {
				logger.error("An error occurred adding weight: " + error.message + ", " + error.stack);
			});
	    } else {
	    	response.say("I'm sorry, I couldn't add weight - you must specify both pounds and ounces").send();		
			response.shouldEndSession(true);
	    }
	    return false;
	}

);
	
app.intent('addBabyIntent', {
	"slots": {
		'SEX': 'SEXES', 
		'NAME': 'AMAZON.US_FIRST_NAME', //TODO: Not sure this will really work for all names
		'BIRTHDATE': 'DATE' 
	},
	'utterances': ['{|add|record} {|baby|child|kid}', '{-|SEX}', '{-|BIRTHDATE}', '{-|NAME}']
	},
	function(request, response) {
		try {
			var sexValue = request.slot("SEX");
			var nameValue = request.slot("NAME");
			var birthdateValue = request.slot("BIRTHDATE");
			logger.info('addBabyIntent: Processing with sexValue: %s, nameValue: %s, birthdateValue: %s', sexValue, nameValue, birthdateValue);
			
			var babyData = request.session(NEWBIE_SESSION_KEY);
			if(babyData === undefined) {
				logger.info('addBabyIntent: babyData does not yet exist, creating...');
				babyData = {};
			} else {
				logger.info('addBabyIntent: babyData exists - %s', JSON.stringify(babyData));
			}
			if( sexValue ) {
				logger.info('addBabyIntent: Adding sexValue %s', sexValue);
				babyData.sex = sexValue;
			}
			if( nameValue ) {
				logger.info('addBabyIntent: Adding nameValue %s', nameValue);
				babyData.name = nameValue;
			}
			if( birthdateValue ) {
				logger.info('addBabyIntent: Adding birthdateValue %s', birthdateValue);
				babyData.birthdate = birthdateValue;
			}
			response.session(NEWBIE_SESSION_KEY, babyData);
			logger.info('addBabyIntent: babyData - %s', JSON.stringify(babyData));
			
			if(!babyData.name) {
				response.say("What is your baby's name?").send();
				response.shouldEndSession(false);
			} else if(!babyData.sex) {
				response.say('Is ' + babyData.name + ' a boy or girl?').send();
				response.shouldEndSession(false);
			} else if(!babyData.birthdate) {
				//TODO: Add him
				response.say('What is her birthdate?').send();
				response.shouldEndSession(false);
			} else {				
				var addBabyPromise = babyController.addBaby(
						request.userId, 
						babyData.sex, 
						babyData.name, 
						new Date(babyData.birthdate)
					);
				addBabyPromise.then(function(responseMsg) {
					logger.info('addBabyIntent: Response message %s', responseMsg);
					response.say(responseMsg).send();		
					response.shouldEndSession(true);
					logger.info("Baby successfully added, message: %s", responseMsg);
				}, function (error) {
					logger.error("An error occurred adding baby: " + error.message + ", " + error.stack);
				});
			} 
			//TODO: Checking if baby already exists
		} catch( err ) {
			//TODO: Figure out exception management for all exception handling
			logger.error("An error occurred adding baby: " + err.message + ", " + err.stack);
		}
		return false;
	}
);

module.exports = app;