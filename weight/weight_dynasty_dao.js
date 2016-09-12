/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;
var _ = require('lodash');
var Winston = require('winston');

var WEIGHT_TABLE_NAME = 'weight'; //TODO: Is there an equivalent of a schema name? e.g. NEWBIE.baby
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
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Weight_Dao - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

function WeightDao() {}

var weightTable = function() {
	return dynasty.table(WEIGHT_TABLE_NAME);
};

WeightDao.prototype.setupWeightTable = function() {
	logger.info("setupWeightTable: Starting table setup...");
	return dynasty.describe(WEIGHT_TABLE_NAME)
    	.catch(function(error) {
    		logger.info("setupWeightTable: Table doesn't yet exist, attempting to create..., error: " + error.message);
    		return dynasty.create(WEIGHT_TABLE_NAME, {
    			key_schema: {
    				hash: ['userId', 'string'],
    				range: ['date', 'string']
    			}
    		}).catch(function(error) {
				if(error) {
					logger.error("setupWeightTable: Error creating table: " + error.message + ", " + error.stack);
				} else {
					logger.info("setupWeightTable: Table successfully created.");
				}
			});
    	});
};

//TODO: Weight table should really be specific to a baby
WeightDao.prototype.createWeight = function(userId, weight, date) {
	var dateString = date.toISOString();
	logger.log('info', "createWeight: Starting weight creation for user %s, dateString %s, weight %s...", userId, dateString, weight);
	return weightTable().insert({
			userId: userId,
			date: dateString,
			weight: weight
		}).catch(function(error) {
			logger.error("createWeight: Error creating weight: " + error.message + ", " + error.stack);
		});
};

module.exports = WeightDao;
