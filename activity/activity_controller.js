/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;
var _ = require('lodash');
var ActivityDao = require('./activity_aws_dao');
var BabyDao = require('../baby/baby_aws_dao');
var Activity = require('./activity');
var Response = require('../common/response');
var Winston = require('winston');

var activityDao = new ActivityDao();
var babyDao = new BabyDao();
var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Activity_Controller - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

function ActivityController () {
}

ActivityController.prototype.initActivityData = function() {
	logger.info("initActivityData: Starting initialization...");
	return activityDao.createTable();
};

ActivityController.prototype.addActivity = function(userId, dateTime, activity) {
	//TODO: When productionizing, eliminate log stmt due to privacy concerns
	//TODO: Provide option to use different units
	logger.info("addActivity: Adding activity for %s, date: %s, activity: %s", userId, dateTime, activity);
	var template = _.template("Added activity ${activity} for ${babyName}");
	var loadedBaby;
	var activityObj = new Activity();
	activityObj.userId = userId;
	activityObj.dateTime = dateTime;
	activityObj.activity = activity;
	return activityDao.createActivity(activityObj)
		.then( function(result) 
		{	
			return babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) 
		{
			loadedBaby = readBabyResult.Item;	
			var babyName = loadedBaby.name;
			var responseMsg = template(
			{
				activity: activity,
				babyName: loadedBaby.name
			});
			logger.info("addActivity: Response %s", responseMsg);
			return new Response(responseMsg, "Activity", responseMsg);
		});
};

module.exports = ActivityController;