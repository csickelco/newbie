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

var TABLE_NAME = 'sleep'; //TODO: Is there an equivalent of a schema name? e.g. NEWBIE.baby

var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Sleep_Dao - '+ (undefined !== options.message ? options.message : '') +
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

function SleepAWSDao() {}

SleepAWSDao.prototype.createTable = function() {
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
			        { AttributeName: "sleepDateTime", KeyType: "RANGE" }  //Sort key
			    ],
			    AttributeDefinitions: [       
			        { AttributeName: "userId", AttributeType: "S" },
			        { AttributeName: "sleepDateTime", AttributeType: "S" }
			    ],
			    ProvisionedThroughput: {       
			        ReadCapacityUnits: 5, 
			        WriteCapacityUnits: 5
			    }
			};
			return dynamodb.createTable(params).promise();
	});
};

SleepAWSDao.prototype.deleteTable = function() {
	logger.info("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return dynamodb.deleteTable(params).promise();
};

//TODO: sleep table should really be specific to a baby
SleepAWSDao.prototype.createSleep = function(sleep) {
	logger.info("createSleep: Starting sleep creation for %s...", sleep.toString());
	var sleepDateTimeString = sleep.sleepDateTime ? sleep.sleepDateTime.toISOString() : undefined;
	var wokeUpDateTimeString = sleep.wokeUpDateTime ? sleep.wokeUpDateTime.toISOString() : undefined;
	var params = {
	    TableName: TABLE_NAME,
	    Item:{
	    	userId: sleep.userId,
	    	sleepDateTime: sleepDateTimeString,
			wokeUpDateTime: wokeUpDateTimeString
	    }
	};
	logger.info("createSleep: Params -- %s", JSON.stringify(params));
	return docClient.put(params).promise();	
};

SleepAWSDao.prototype.getLastSleep = function(userId) {
	logger.info("getLastSleep: Starting get last sleep for user %s", userId);
	var params = {
			TableName : TABLE_NAME,
			//TODO: use begins_with instead? so we only get that day (in case not doing today)
			KeyConditionExpression: "userId = :val1",
		    ExpressionAttributeValues: {
		    	":val1":userId
		    },
		    ScanIndexForward: false,
		    Limit: 1
	};
	return docClient.query(params).promise();
};

SleepAWSDao.prototype.updateSleep = function(sleep) {
	logger.info("updateLastSleep: Updating last sleep %s", sleep);
	
	var params = {
		    TableName:TABLE_NAME,
		    Key:{
		    	userId: sleep.userId,
		    	sleepDateTime: sleep.sleepDateTime.toISOString()
		    },
		    UpdateExpression: "set wokeUpDateTime = :w",
		    ExpressionAttributeValues:{
		        ":w": sleep.wokeUpDateTime.toISOString()
		    },
		    ReturnValues:"UPDATED_NEW"
		};
	
	return docClient.update(params).promise();
};

SleepAWSDao.prototype.getSleep = function(userId, date) {
	//TODO: probably need to take into account timezones
	logger.info("getSleep: Starting get sleeps for day %s", date.toString());
	var params = {
			TableName : TABLE_NAME,
			//TODO: use begins_with instead? so we only get that day (in case not doing today)
			KeyConditionExpression: "userId = :val1 and sleepDateTime > :val2",
		    ExpressionAttributeValues: {
		    	":val1":userId,
		        ":val2":Utils.formatDateString(date) 
		    }
	};
	return docClient.query(params).promise();
};

module.exports = SleepAWSDao;
