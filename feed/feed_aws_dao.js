/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class handles all data persistence (create-retrieve-update-delete operations) 
 * for feeds via the AWS SDK.
 * 
 * @author Christina Sickelco
 */

//Used to write more secure javascript. See http://www.w3schools.com/js/js_strict.asp. 
'use strict';

//Alexa app server hotswap module will reload code changes to apps
//if this is set to 1. Handy for local development and testing
//See https://runkit.com/npm/alexa-app-server
module.change_code = 1;

//Dependencies
var Utils = require('../common/utils');
var DaoError = require('../common/dao_error');
var Winston = require('winston');
var AWS = require("aws-sdk");

//Check if environment supports native promises, otherwise use Bluebird
//See https://blogs.aws.amazon.com/javascript/post/Tx3BZ2DC4XARUGG/Support-for-Promises-in-the-SDK
//for AWS Promise support
if (typeof Promise === 'undefined') {
AWS.config.setPromisesDependency(require('bluebird'));
}

AWS.config.update({
	region: "us-east-1",
	//endpoint: "http://localhost:4000"
	endpoint: "https://dynamodb.us-east-1.amazonaws.com"
});

//Configure the logger with basic logging template
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

//DynamoDB table name
var TABLE_NAME = 'NEWBIE.FEED'; 

//DynamoDB access objects
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

/**
 * Represents data access operations for feeds.
 * @constructor
 */
function FeedAWSDao() {}

/**
 * Asynchronous operation to create the feed table if it doesn't already exist.
 * If it does exist, does nothing.
 * @throws {DaoError} 	An error occurred interacting with DynamoDB. 
 * 						Could be caused by an InternalServerError, LimitExceededException, 
 * 						or ResourceInUseException. 
 */
FeedAWSDao.prototype.createTable = function() {
	logger.debug("createTable: Starting table setup...");
	var describeParams = {
			TableName: TABLE_NAME,
	};
	return dynamodb.describeTable(describeParams).promise()
		.catch(function(error) {
			logger.debug("createTable: Table doesn't yet exist, attempting to create..., error: " + error.message);
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
			return dynamodb.createTable(params).promise()
			.catch(function(error) {
				throw new DaoError("create feed table", error);
			});
	});
};

/**
 * Asynchronous operation to delete the feed table
 * @throws {DaoError} 	An error occurred interacting with DynamoDB. 
 * 						Could be caused by an InternalServerError, LimitExceededException, 
 * 						ResourceInUseException, or ResourceNotFoundException.
 */
FeedAWSDao.prototype.deleteTable = function() {
	logger.debug("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return dynamodb.deleteTable(params).promise()
	.catch(function(error) {
		throw new DaoError("delete feed table", error);
	});
};

/**
 * Asynchronous operation to persist a new feed 
 * (or overwrite the existing feed if one exists for 
 * the same userId, dateTime).
 * 
 * @param 	feed {Feed} the feed object to persist. Non-nullable. 
 * 			Must have all properties populated.
 * 
 * @throws {DaoError} 	An error occurred interacting with DynamoDB. 
 * 						Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 						or ResourceNotFoundException.
 */
FeedAWSDao.prototype.createFeed = function(feed) {
	var dateTimeString = feed.dateTime.toISOString();
	logger.debug("createFeed: Starting feed creation for %s", feed.toString());
	var params = {
	    TableName: TABLE_NAME,
	    Item:{
	    	userId: feed.userId,
	    	dateTime: dateTimeString,
			feedAmount: feed.feedAmount
	    }
	};
	return docClient.put(params).promise()
	.catch(function(error) {
		throw new DaoError("create feed", error);
	});
};

/**
 * Asynchronous operation to retrieve all feeds created 
 * for the specified date or later for a given user.
 * 
 * @param userId {string}	AWS user ID whose feeds to retrieve. Non-nullable.
 * @param date	{Date}		Date/time after which to retrieve all feeds. Non-nullable.
 * 
 * @throws {DaoError} 	An error occurred interacting with DynamoDB. 
 * 						Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 						or ResourceNotFoundException.
 */
FeedAWSDao.prototype.getFeeds = function(userId, date) {
	logger.debug("getFeeds: Starting get feeds for day %s", date.toString());
	var params = {
			TableName : TABLE_NAME,
			KeyConditionExpression: "userId = :val1 and #dt > :val2",
			ExpressionAttributeNames: {
				"#dt": "dateTime" //This is needed because dateTime is a reserved word
			},
		    ExpressionAttributeValues: {
		    	":val1":userId,
		        ":val2":Utils.formatDateString(date) 
		    }
	};
	return docClient.query(params).promise()
	.catch(function(error) {
		throw new DaoError("get feeds", error);
	});
};

/**
 * Asynchronous operation to retrieve the most recent feed for 
 * the given userId, or null if no feeds exist.
 * 
 * @param userId {string} 	AWS user ID whose most recent feed to retrieve. Non-nullable.
 * 
 * @throws {DaoError} 	An error occurred interacting with DynamoDB. 
 * 						Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 						or ResourceNotFoundException.
 */
FeedAWSDao.prototype.getLastFeed = function(userId) {
	logger.debug("getLastFeed: Starting get last feed for user %s", userId);
	var params = {
			TableName : TABLE_NAME,
			KeyConditionExpression: "userId = :val1",
		    ExpressionAttributeValues: {
		    	":val1":userId
		    },
		    ScanIndexForward: false,
		    Limit: 1
	};
	return docClient.query(params).promise()
	.catch(function(error) {
		throw new DaoError("get last feed", error);
	});
};

module.exports = FeedAWSDao;
