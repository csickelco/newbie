/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;
var _ = require('lodash');
var DiaperDao = require('./diaper_aws_dao');
var BabyDao = require('../baby/baby_aws_dao');
var Winston = require('winston');
var rp = require('request-promise');

var diaperDao = new DiaperDao();
var babyDao = new BabyDao();
var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Diaper_Controller - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

function DiaperController () {
}

DiaperController.prototype.initDiaperData = function() {
	logger.info("initDiaperData: Starting initialization...");
	return diaperDao.createTable();
};

DiaperController.prototype.addDiaper = function(userId, dateTime, isWet, isDirty) {
	//TODO: When productionizing, eliminate log stmt due to privacy concerns
	//TODO: Provide option to use different units
	logger.info("addDiaper: Adding diaper for %s, date: %s, isWet: %s, isDirty: %s", userId, dateTime, isWet, isDirty);
	var loadedBaby;
	var totalWetDiapers = 0;
	var totalDirtyDiapers = 0;
	
	return diaperDao.createDiaper(userId, dateTime, isWet, isDirty )
		.then( function(result) {
			return diaperDao.getDiapers(userId, dateTime);
		})
		.then( function(diapersForDayResult) 
		{
			diapersForDayResult.Items.forEach(function(item) {
	            logger.debug(" -", item.dateTime + ": " + item.isWet + ", " + item.isDirty);
	            if(item.isWet) {
	            	totalWetDiapers++;
	            }
	            if(item.isDirty) {
	            	totalDirtyDiapers++;
	            }
	        });
			return babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) 
		{
			loadedBaby = readBabyResult === undefined ? {} : JSON.parse(readBabyResult.Item.data);	
			var babyName = loadedBaby.name;
			var responseMsg = "Added ";
			if(isWet) {
				responseMsg += "wet ";
			}
			if(isWet && isDirty) {
				responseMsg += "and ";
			}
			if(isDirty) {
				responseMsg += "dirty ";
			}
			//TODO: Plural diapers only if more than one
			responseMsg += "diaper for " + babyName + ". Today, she's had " + 
				totalWetDiapers + " wet and " + totalDirtyDiapers + " dirty diapers"; //TODO: replace she with proper prononun
			logger.info("addDiaper: Response %s", responseMsg);
			return responseMsg;
		});
};

module.exports = DiaperController;