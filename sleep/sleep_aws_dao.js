/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class handles all data persistence (create-retrieve-update-delete operations) 
 * for sleep via the AWS SDK.
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
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Sleep_Dao - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//DynamoDB table name
var TABLE_NAME = 'NEWBIE.SLEEP'; 

//DynamoDB access objects
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

/**
 * Represents data access operations for sleep.
 * @constructor
 */
function SleepAWSDao() {}

/**
 * Asynchronous operation to create the sleep table if it doesn't already exist.
 * If it does exist, does nothing.
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws {ResourceInUseException} The operation conflicts with the resource's availability. 
 */
SleepAWSDao.prototype.createTable = function() {
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

/**
 * Asynchronous operation to delete the sleep table
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws {ResourceInUseException} The operation conflicts with the resource's availability. 
 * @throws {ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
SleepAWSDao.prototype.deleteTable = function() {
	logger.debug("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return dynamodb.deleteTable(params).promise();
};

/**
 * Asynchronous operation to persist a new sleep record 
 * (or overwrite the existing sleep record if one exists for 
 * the same userId, dateTime).
 * 
 * @param 	sleep the sleep object to persist. Non-nullable. 
 * 			Must have at least userId and sleepDateTime populated.
 * 
 * @throws {ProvisionedThroughputExceededException} Request rate is too high.
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
SleepAWSDao.prototype.createSleep = function(sleep) {
	logger.debug("createSleep: Starting sleep creation for %s...", sleep.toString());
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
	logger.debug("createSleep: Params -- %s", JSON.stringify(params));
	return docClient.put(params).promise();	
};

/**
 * Asynchronous operation to retrieve the most recent sleep record for 
 * the given userId, or null if no sleep records exist.
 * 
 * @param userId 	AWS user ID whose most recent sleep record to retrieve. Non-nullable.
 * 
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {ProvisionedThroughputExceededException} Request rate is too high.
 * @throws {ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
SleepAWSDao.prototype.getLastSleep = function(userId) {
	logger.debug("getLastSleep: Starting get last sleep for user %s", userId);
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

/**
 * Asynchronous operation to retrieve all sleep records created 
 * for the specified date or later for a given user.
 * 
 * @param userId 	AWS user ID whose sleep records to retrieve. Non-nullable.
 * @param date		Date/time after which to retrieve all sleep records. Non-nullable.
 * 
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {ProvisionedThroughputExceededException} Request rate is too high.
 * @throws {ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
SleepAWSDao.prototype.getSleep = function(userId, date) {
	logger.debug("getSleep: Starting get sleeps for day %s", date.toString());
	var params = {
			TableName : TABLE_NAME,
			KeyConditionExpression: "userId = :val1 and sleepDateTime > :val2",
		    ExpressionAttributeValues: {
		    	":val1":userId,
		        ":val2":Utils.formatDateString(date) 
		    }
	};
	return docClient.query(params).promise();
};

/**
 * Asynchronous operation to update a sleep record (with the wakeDateTime).
 * 
 * @param sleep 	the sleep record to update. non-nullable. must have 
 * 					at least userId and sleepDateTime specified.
 * 
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {ProvisionedThroughputExceededException} Request rate is too high.
 * @throws {ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
SleepAWSDao.prototype.updateSleep = function(sleep) {
	logger.debug("updateLastSleep: Updating last sleep %s", sleep);
	
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

module.exports = SleepAWSDao;
