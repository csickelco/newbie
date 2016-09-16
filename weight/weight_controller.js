/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;
var _ = require('lodash');
//var WeightDao = require('./weight_dao');
var WeightDao = require('./weight_aws_dao');
var BabyDao = require('../baby/baby_aws_dao');
var Winston = require('winston');
var rp = require('request-promise');

var weightDao = new WeightDao();
var babyDao = new BabyDao();
var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Weight_Controller - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//http://stackoverflow.com/questions/20425771/how-to-replace-1-with-first-2-with-second-3-with-third-etc
var special = ['zeroth','first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelvth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth'];
var deca = ['twent', 'thirt', 'fourt', 'fift', 'sixt', 'sevent', 'eight', 'ninet'];

function stringifyNumber(n) {
  if (n < 20) {
	  return special[n];
  }
  if (n%10 === 0) {
	  return deca[Math.floor(n/10)-2] + 'ieth';
  }
  return deca[Math.floor(n/10)-2] + 'y-' + special[n%10];
}

function WeightController () {
}

WeightController.prototype.initWeightData = function() {
	logger.info("initWeightData: Starting initialization...");
	return weightDao.createTable();
};

WeightController.prototype.addWeight = function(userId, date, pounds, ounces) {
	//TODO: When productionizing, eliminate log stmt due to privacy concerns
	logger.info("pounds - " + pounds + ", ounces - " + ounces);
	logger.info("addWeight: Adding weight for %s, date: %s, pounds: %d, ounces: %d", userId, date, pounds, ounces);
	var template = _.template('Added weight ${pounds} pounds, ${ounces} ounces for ${babyName}. She is in the ${percentile} percentile');
	
	var totalOunces = (pounds*16) + parseInt(ounces);
	var loadedBaby;
	
	var weightInKg = 0.02834952*totalOunces;
	//TODO: Support different weight units
	var createWeightPromise = weightDao.createWeight(userId, totalOunces, date );
	var readBabyPromise = createWeightPromise.then( function(createWeightResult) 
	{
		return babyDao.readBaby(userId);
	});
	var calculatePercentilePromise = readBabyPromise.then( function(readBabyResult) 
	{
		loadedBaby = readBabyResult === undefined ? {} : JSON.parse(readBabyResult.Item.data);			
		var dobValue = loadedBaby.birthdate.toString('yyyy-MM-dd');
		var dateValue = date.toString('yyyy-MM-dd');
		logger.info("addWeight: Percentile calculation for dob %s, date %s, weight in kg %d, weight in ounces %d", dobValue, dateValue, weightInKg, totalOunces);
		var options = {
		    method: 'POST',
		    uri: 'http://peditools.org/growthinfant/index.php',
		    form: {
		        sex: '2', // Will be urlencoded //TODO: Handle boys
		        dob: dobValue,
		        date: dateValue,
		        weight: weightInKg
		    },
		    headers: {
		    }
		};

		return rp(options);
	});
	return calculatePercentilePromise.then( function(body) {
			// logger.info("POST: %s", body);
	    	//TODO: This is pretty hacky
	        var percentile = body.match(/oz<TD>(.*)%<TD>/)[1];
	        logger.info("addWeight: Percentile-- %s, readBabyPromise %s", percentile, JSON.stringify(readBabyPromise));
	        //TODO: Is there any way to have the daos return the Item.data part?
			var responseMsg = template(
			{
				pounds: pounds,
				ounces: ounces,
				babyName: loadedBaby.name,
				percentile: stringifyNumber(percentile)
			});
			logger.info("addWeight: Response %s", responseMsg);
			return responseMsg;
	});
	//TODO: Investigate yields and generators
};

module.exports = WeightController;