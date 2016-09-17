/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;
var _ = require('lodash');
var DiaperDao = require('./diaper_aws_dao');
var BabyDao = require('../baby/baby_aws_dao');
var Diaper = require('./diaper');
var Utils = require('../common/utils');
var Response = require('../common/response');
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
	logger.debug("initDiaperData: Starting initialization...");
	return diaperDao.createTable();
};

DiaperController.prototype.addDiaper = function(userId, dateTime, isWet, isDirty) {
	//TODO: When productionizing, eliminate log stmt due to privacy concerns
	//TODO: Provide option to use different units
	logger.debug("addDiaper: Adding diaper for %s, date: %s, isWet: %s, isDirty: %s", userId, dateTime, isWet, isDirty);
	var loadedBaby;
	var totalWetDiapers = 0;
	var totalDirtyDiapers = 0;
	var diaper = new Diaper();
	diaper.userId = userId;
	diaper.dateTime = dateTime;
	diaper.isWet = isWet;
	diaper.isDirty = isDirty;
	
	return diaperDao.createDiaper(diaper)
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
			loadedBaby = readBabyResult.Item;	
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
				totalWetDiapers + " wet and " + totalDirtyDiapers + " dirty diaper" + Utils.pluralizeIfNeeded(totalDirtyDiapers); //TODO: replace she with proper prononun
			logger.debug("addDiaper: Response %s", responseMsg);
			return new Response(responseMsg, "Diaper", responseMsg);
		});
};
//Test
module.exports = DiaperController;