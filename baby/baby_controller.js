/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;
var _ = require('lodash');
//var BabyDao = require('./baby_dao');
var BabyDao = require('./baby_aws_dao');
var Baby = require('./baby');
var Response = require('../common/response');
var Utils = require('../common/utils');
var Winston = require('winston');

var babyDao = new BabyDao();
var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Baby_Controller - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

function BabyController () {
}

BabyController.prototype.initBabyData = function() {
	logger.debug("initBabyData: Starting initialization...");
	return babyDao.createTable();
};

BabyController.prototype.addBaby = function(userId, sex, name, birthdate) {
	//TODO: When productionizing, eliminate log stmt due to privacy concerns
	logger.debug("addBaby: Adding baby for %s, sex: %s, name: %s, birthdate: %s", userId, sex, name, birthdate);
	//TODO: substitute proper pronoun
	var template = _.template('Added baby ${sex} ${name}. She is ${age} old');
	
	var baby = new Baby(); 
	baby.userId = userId;
	baby.sex = sex;
	baby.name = name;
	baby.birthdate = birthdate;
	
	//We will first create the baby in the data store, then read it back, 
	//then format a message
	return babyDao.createBaby(baby)
		.then( function(result) 
		{
			logger.debug("addBaby: Successfully created baby %s", JSON.stringify(baby));
			return babyDao.readBaby(userId);
		})
		.then( function(readBabyResult) 
		{
			logger.debug("addBaby: Successfully read baby %s", JSON.stringify(readBabyResult));
			var loadedBaby = readBabyResult.Item;
			logger.debug("addBaby: loadedBaby %s", JSON.stringify(loadedBaby));
			var responseMsg = template(
			{
				sex: loadedBaby.sex,
				name: loadedBaby.name,
				age: Utils.calculateAgeFromBirthdate(birthdate)
			});
			logger.debug("addBaby: Response %s", responseMsg);
			return new Response(responseMsg, "Added Baby", responseMsg);
		});
};



module.exports = BabyController;