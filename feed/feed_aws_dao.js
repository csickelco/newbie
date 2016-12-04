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
 * @property {AWS.DynamoDB} 				dynamodb - AWS API for interacting with DynamoDB
 * @property {AWS.DynamoDB.DocumentClient} 	docClient - AWS API for interacting with items in DynamoDB
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
var DaoUtils = require('../common/dao_utils');
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

/**
 * Represents data access operations for feeds.
 * @constructor
 */
function FeedAWSDao() {
	//DynamoDB access objects
	this.dynamodb = new AWS.DynamoDB();
	this.docClient = new AWS.DynamoDB.DocumentClient();
	this.daoUtils = new DaoUtils(this.dynamodb, this.docClient);
}

/**
 * Asynchronous operation to create the feed table if it doesn't already exist.
 * If it does exist, does nothing.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, LimitExceededException, 
 * 			or ResourceInUseException. 
 */
FeedAWSDao.prototype.createTable = function() {
	logger.debug("createTable: Starting table setup...");
	var describeParams = {
			TableName: TABLE_NAME,
	};
	var self = this;
	return self.dynamodb.describeTable(describeParams).promise()
		.catch(function(error) {
			logger.debug("createTable: Table doesn't yet exist, attempting to create..., error: " + error.message);
			var params = {
			    TableName : TABLE_NAME,
			    KeySchema: [       
			        { AttributeName: "feedKey", KeyType: "HASH"},  //Partition key
			        { AttributeName: "dateTime", KeyType: "RANGE" }  //Sort key
			    ],
			    AttributeDefinitions: [       
			        { AttributeName: "feedKey", AttributeType: "S" },
			        { AttributeName: "dateTime", AttributeType: "S" }
			    ],
			    ProvisionedThroughput: {       
			        ReadCapacityUnits: 3, 
			        WriteCapacityUnits: 3
			    }
			};
			return self.dynamodb.createTable(params).promise()
			.catch(function(error) {
				return Promise.reject( new DaoError("create feed table", error) );
			});
	});
};

/**
 * Asynchronous operation to delete the feed table
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, LimitExceededException, 
 * 			ResourceInUseException, or ResourceNotFoundException.
 */
FeedAWSDao.prototype.deleteTable = function() {
	logger.debug("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return this.dynamodb.deleteTable(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("delete feed table", error) );
	});
};

/**
 * Asynchronous operation to persist a new feed 
 * (or overwrite the existing feed if one exists for 
 * the same userId, seq, dateTime).
 * 
 * @param 	feed {Feed} the feed object to persist. Non-nullable. 
 * 			Must have all properties populated.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException.
 */
FeedAWSDao.prototype.createFeed = function(feed) {
	var dateTimeString = Utils.formatDateTimeString(feed.dateTime, feed.timezone);
	logger.debug("createFeed: Starting feed creation for %s", feed.toString());
	var params = {
	    TableName: TABLE_NAME,
	    Item:{
	    	feedKey: feed.userId + "-" + feed.seq,
	    	dateTime: dateTimeString,
			feedAmount: feed.feedAmount
	    }
	};
	return this.docClient.put(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("add feed", error) );
	});
};

/**
 * Asynchronous operation to retrieve all feeds created 
 * for the specified date or later for a given user.
 * 
 * @param userId {string}	AWS user ID whose feeds to retrieve. Non-nullable.
 * @param {number} seq		the sequence number of the baby whose feeds to retrieve. Non-nullable.
 * @param date	{Date}		Date/time after which to retrieve all feeds. Non-nullable.
 * @param {String} timezone The timezone identifier for the user. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException.
 */
FeedAWSDao.prototype.getFeeds = function(userId, seq, date, timezone) {
	logger.debug("getFeeds: Starting get feeds for day %s", date.toString());
	var params = {
			TableName : TABLE_NAME,
			KeyConditionExpression: "feedKey = :val1 and #dt > :val2",
			ExpressionAttributeNames: {
				"#dt": "dateTime" //This is needed because dateTime is a reserved word
			},
		    ExpressionAttributeValues: {
		    	":val1":userId + "-" + seq,
		        ":val2":Utils.formatDateString(date, timezone) 
		    }
	};
	return this.docClient.query(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("get feeds", error) );
	});
};

/**
 * Asynchronous operation to retrieve the most recent feed for 
 * the given userId, or null if no feeds exist.
 * 
 * @param userId {string} 	AWS user ID whose most recent feed to retrieve. Non-nullable.
 * @param {number} seq		the sequence number of the baby whose feed to retrieve. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException.
 */
FeedAWSDao.prototype.getLastFeed = function(userId, seq) {
	logger.debug("getLastFeed: Starting get last feed for user %s", userId);
	var params = {
			TableName : TABLE_NAME,
			KeyConditionExpression: "feedKey = :val1",
		    ExpressionAttributeValues: {
		    	":val1":userId + "-" + seq
		    },
		    ScanIndexForward: false,
		    Limit: 1
	};
	return this.docClient.query(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("get last feed", error) );
	});
};

/**
 * Asynchronous operation to delete the specified feed entry 
 * from the datastore.
 * 
 * @param userId {string}	AWS user ID whose feed to delete. Non-nullable.
 * @param {number} seq		the sequence number of the baby whose feed to delete. Non-nullable.
 * @param date {Date}		The date/time of the feed entry to delete. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 						or ResourceNotFoundException.   
 */
FeedAWSDao.prototype.deleteFeed = function(userId, seq, dateTime, timezone) {
	var dateTimeString = Utils.formatDateTimeString(dateTime, timezone);
	logger.debug("deleteFeed: Starting delete feed for %s %s", userId, dateTimeString );
	var params = {
	    TableName: TABLE_NAME,
	    Key:{
	        "feedKey":userId+"-"+seq,
	        "dateTime":dateTimeString
	    }
	};
	return this.docClient.delete(params).promise()
		.catch(function(error) {
			return Promise.reject( new DaoError("remove feed", error) );
		});
};

/**
 * Asynchronous operation to delete all feed records for the given baby
 * param userId {string} 	AWS user ID whose records to delete. Non-nullable.
 * @param {number} seq		the sequence number of the baby whose records to delete. Non-nullable.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException.
 */
FeedAWSDao.prototype.deleteFeedsForBaby = function(userId, seq) {
	return this.daoUtils.deleteRecordsForBaby(TABLE_NAME, "feedKey", "dateTime", userId, seq);
};

module.exports = FeedAWSDao;
