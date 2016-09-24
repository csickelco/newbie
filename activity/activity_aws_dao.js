/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class handles all data persistence (create-retrieve-update-delete operations) 
 * for activities via the AWS SDK.
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

//Configure DynamoDB access
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
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Activity_Dao - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//DynamoDB table name
var TABLE_NAME = 'NEWBIE.ACTIVITY'; 

//DynamoDB access objects
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

/**
 * Represents data access operations for activities.
 * @constructor
 */
function ActivityAWSDao() {}

/**
 * Asynchronous operation to create the activity table if it doesn't already exist.
 * If it does exist, does nothing.
 * @throws {DaoError} 	An error occurred interacting with DynamoDB. 
 * 						Could be caused by an InternalServerError, LimitExceededException, or ResourceInUseException. 
 */
ActivityAWSDao.prototype.createTable = function() {
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
					throw new DaoError("create the activity table", error);
				});
	});
};

/**
 * Asynchronous operation to delete the activity table
 * @throws {DaoError} 	An error occurred interacting with DynamoDB. 
 * 						Could be caused by an InternalServerError, LimitExceededException, 
 * 						ResourceInUseException, or ResourceNotFoundException.
 */
ActivityAWSDao.prototype.deleteTable = function() {
	logger.debug("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return dynamodb.deleteTable(params).promise()
		.catch(function(error) {
			throw new DaoError("delete the activity table", error);
		});
};

/**
 * Asynchronous operation to persist a new activity 
 * (or overwrite the existing activity if one exists for 
 * the same userId, dateTime).
 * 
 * @param 	{Activity} activity the activity object to persist. Non-nullable. 
 * 			Must have all properties populated.
 * 
 * @throws {DaoError} 	An error occurred interacting with DynamoDB. 
 * 						Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 						or ResourceNotFoundException.
 */
ActivityAWSDao.prototype.createActivity = function(activity) {
	var dateTimeString = activity.dateTime.toISOString();
	logger.debug("createActivity: Starting activity creation for user %s, dateTimeString %s, activity %s...", activity.userId, dateTimeString, activity.activity);
	var params = {
	    TableName: TABLE_NAME,
	    Item:{
	    	userId: activity.userId,
	    	dateTime: dateTimeString,
			activity: activity.activity
	    }
	};
	return docClient.put(params).promise()
		.catch(function(error) {
			throw new DaoError("create an activity", error);
		});
};

/**
 * Asynchronous operation to retrieve all activities created 
 * for the specified date or later for a given user.
 * 
 * @param {string} userId 	AWS user ID whose activities to retrieve. Non-nullable.
 * @param {Date} date		Date/time after which to retrieve all activities. Non-nullable.
 * 
 * @throws {DaoError} 	An error occurred interacting with DynamoDB. 
 * 						Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 						or ResourceNotFoundException.
 */
ActivityAWSDao.prototype.getActivitiesForDay = function(userId, date) {
	logger.debug("getActivitiesForDay: Starting get activities for day %s", date.toString());
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
			throw new DaoError("get activities for the day", error);
		});
};

module.exports = ActivityAWSDao;
