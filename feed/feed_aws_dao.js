/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;
var Utils = require('../common/utils');
var Winston = require('winston');
var AWS = require("aws-sdk");

//Check if environment supports native promises
if (typeof Promise === 'undefined') {
AWS.config.setPromisesDependency(require('bluebird'));
}

var TABLE_NAME = 'feed'; //TODO: Is there an equivalent of a schema name? e.g. NEWBIE.baby

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

AWS.config.update({
	region: "us-east-1",
	//endpoint: "http://localhost:4000"
	endpoint: "https://dynamodb.us-east-1.amazonaws.com"
});
//Use bluebird implementation of Promise
//AWS.config.setPromisesDependency(require('bluebird'));

var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

function FeedAWSDao() {}

FeedAWSDao.prototype.createTable = function() {
	logger.info("createTable: Starting table setup...");
	var describeParams = {
			TableName: TABLE_NAME,
	};
	return dynamodb.describeTable(describeParams).promise()
		.catch(function(error) {
			logger.info("createTable: Table doesn't yet exist, attempting to create..., error: " + error.message);
			var params = {
			    TableName : TABLE_NAME,
			    KeySchema: [       
			        { AttributeName: "userId", KeyType: "HASH"},  //Partition key
			        { AttributeName: "dateTime", KeyType: "RANGE" }  //Sort key
			    ],
			    AttributeDefinitions: [       
			        { AttributeName: "userId", AttributeType: "S" },
			        { AttributeName: "dateTime", AttributeType: "S" }
			    ],
			    ProvisionedThroughput: {       
			        ReadCapacityUnits: 5, 
			        WriteCapacityUnits: 5
			    }
			};
			return dynamodb.createTable(params).promise();
	});
};

FeedAWSDao.prototype.deleteTable = function() {
	logger.info("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return dynamodb.deleteTable(params).promise();
};

//TODO: Feed table should really be specific to a baby
FeedAWSDao.prototype.createFeed = function(feed) {
	var dateTimeString = feed.dateTime.toISOString();
	logger.info("createFeed: Starting feed creation for %s", feed.toString());
	var params = {
	    TableName: TABLE_NAME,
	    Item:{
	    	userId: feed.userId,
	    	dateTime: dateTimeString,
			feedAmount: feed.feedAmount
	    }
	};
	return docClient.put(params).promise();	
};

FeedAWSDao.prototype.getFeeds = function(userId, date) {
	//TODO: probably need to take into account timezones
	logger.info("getFeeds: Starting get feeds for day %s", date.toString());
	var params = {
			TableName : TABLE_NAME,
			//TODO: use begins_with instead?
			KeyConditionExpression: "userId = :val1 and #dt > :val2",
			ExpressionAttributeNames: {
				"#dt": "dateTime" //This is needed because dateTime is a reserved word
			},
		    ExpressionAttributeValues: {
		    	":val1":userId,
		        ":val2":Utils.formatDateString(date) 
		    }
	};
	return docClient.query(params).promise();
};

FeedAWSDao.prototype.getLastFeed = function(userId) {
	logger.info("getLastFeed: Starting get last feed for user %s", userId);
	var params = {
			TableName : TABLE_NAME,
			KeyConditionExpression: "userId = :val1",
		    ExpressionAttributeValues: {
		    	":val1":userId
		    },
		    ScanIndexForward: false,
		    Limit: 1
	};
	return docClient.query(params).promise();
};

module.exports = FeedAWSDao;
