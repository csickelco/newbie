/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;
var _ = require('lodash');
var Winston = require('winston');

var FEED_TABLE_NAME = 'feed'; //TODO: Is there an equivalent of a schema name? e.g. NEWBIE.baby
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
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Feed_Dao - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

function FeedDao() {}

var feedTable = function() {
	return dynasty.table(FEED_TABLE_NAME);
};

FeedDao.prototype.setupFeedTable = function() {
	logger.info("setupFeedTable: Starting table setup...");
	return dynasty.describe(FEED_TABLE_NAME)
    	.catch(function(error) {
    		logger.info("setupFeedTable: Table doesn't yet exist, attempting to create..., error: " + error.message);
    		return dynasty.create(FEED_TABLE_NAME, {
    			key_schema: {
    				hash: ['userId', 'string'],
    				range: ['dateTime', 'string']
    			}
    		}).catch(function(error) {
				if(error) {
					logger.error("setupFeedTable: Error creating table: " + error.message + ", " + error.stack);
				} else {
					logger.info("setupFeedTable: Table successfully created.");
				}
			});
    	});
};

//TODO: Feed table should really be specific to a baby
FeedDao.prototype.createFeed = function(userId, dateTime, feedAmount) {
	var dateTimeString = dateTime.toISOString();
	logger.log('info', "createFeed: Starting feed creation for user %s, dateTimeString %s, feedAmount %s...", userId, dateTimeString, feedAmount);
	return feedTable().insert({
			userId: userId,
			dateTime: dateTimeString,
			feedAmount: feedAmount
		}).catch(function(error) {
			logger.error("createFeed: Error creating feed: " + error.message + ", " + error.stack);
		});
};

module.exports = FeedDao;
