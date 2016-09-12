/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;
var _ = require('lodash');
var Winston = require('winston');

var BABY_TABLE_NAME = 'baby'; //TODO: Is there an equivalent of a schema name? e.g. NEWBIE.baby
//var dynasty = require('dynasty')({});

var localUrl = 'http://localhost:4000';
var localCredentials = {
  region: 'us-east-1',
  accessKeyId: 'fake',
  secretAccessKey: 'fake'
};
var localDynasty = require('dynasty')(localCredentials, localUrl);
var dynasty = localDynasty;

var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Baby_Dao - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

function BabyDao() {}

var babyTable = function() {
	return dynasty.table(BABY_TABLE_NAME);
};

BabyDao.prototype.setupBabyTable = function() {
	logger.info("setupBabyTable: Starting table setup...");
	return dynasty.describe(BABY_TABLE_NAME)
    	.catch(function(error) {
    		logger.info("setupBabyTable: Table doesn't yet exist, attempting to create..., error: " + error.message);
    		return dynasty.create(BABY_TABLE_NAME, {
    			key_schema: {
    				//TODO: Need another distinguisher once we have more than just me using it
    				hash: ['userId', 'string']
    			}
    		}).catch(function(error) {
				if(error) {
					logger.error("setupBabyTable: Error creating table: " + error.message + ", " + error.stack);
				} else {
					logger.info("setupBabyTable: Table successfully created.");
				}
			});
    	});
};

BabyDao.prototype.createBaby = function(userId, baby) {
	logger.log('info', "createBaby: Starting baby creation for user %s, baby %s...", userId, JSON.stringify(baby));
	return babyTable().insert({
		userId: userId,
		data: baby
		}).catch(function(error) {
			logger.error("createBaby: Error creating baby: " + error.message + ", " + error.stack);
		});
};

BabyDao.prototype.readBaby = function(userId) {
	logger.info("readBaby: Starting for user %s...", userId);
	return babyTable().find(userId).then(function(result) {
		logger.info("readBaby: Found baby, %s", JSON.stringify(result));
		return result;
	}) 
	.catch(function(error) {
		logger.error("readBaby: Error reading baby from database: " + error.message + ", " + error.stack);
	});
};

module.exports = BabyDao;
