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

/**
 * Represents data access operations for sleep.
 * @constructor
 */
function SleepAWSDao() {
	//DynamoDB access objects
	this.dynamodb = new AWS.DynamoDB();
	this.docClient = new AWS.DynamoDB.DocumentClient();
}

/**
 * Asynchronous operation to create the sleep table if it doesn't already exist.
 * If it does exist, does nothing.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, LimitExceededException, 
 * 			or ResourceInUseException. 
 */
SleepAWSDao.prototype.createTable = function() {
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
			        { AttributeName: "userId", KeyType: "HASH"},  //Partition key
			        { AttributeName: "sleepDateTime", KeyType: "RANGE" }  //Sort key
			    ],
			    AttributeDefinitions: [       
			        { AttributeName: "userId", AttributeType: "S" },
			        { AttributeName: "sleepDateTime", AttributeType: "S" }
			    ],
			    ProvisionedThroughput: {       
			        ReadCapacityUnits: 3, 
			        WriteCapacityUnits: 3
			    }
			};
			return self.dynamodb.createTable(params).promise()
			.catch(function(error) {
				return Promise.reject( new DaoError("create sleep table", error) );
			});
	});
};

/**
 * Asynchronous operation to delete the sleep table
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, LimitExceededException, 
 * 			ResourceInUseException, or ResourceNotFoundException.
 */
SleepAWSDao.prototype.deleteTable = function() {
	logger.debug("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return this.dynamodb.deleteTable(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("delete sleep table", error) );
	});
};

/**
 * Asynchronous operation to persist a new sleep record 
 * (or overwrite the existing sleep record if one exists for 
 * the same userId, dateTime).
 * 
 * @param 	sleep {Sleep} the sleep object to persist. Non-nullable. 
 * 			Must have at least userId and sleepDateTime populated.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, PrivisionedThroughputExceededException, 
 * 			or ResourceNotFoundException. 
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
	return this.docClient.put(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("add sleep", error) );
	});
};

/**
 * Asynchronous operation to retrieve the most recent sleep record for 
 * the given userId, or null if no sleep records exist.
 * 
 * @param userId {string}	AWS user ID whose most recent sleep record to retrieve. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException. 
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
	return this.docClient.query(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("get last sleep", error) );
	});
};

/**
 * Asynchronous operation to retrieve all sleep records created 
 * for the specified date or later for a given user.
 * 
 * @param userId {string} 	AWS user ID whose sleep records to retrieve. Non-nullable.
 * @param date {Date}		Date/time after which to retrieve all sleep records. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException. 
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
	return this.docClient.query(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("get sleep", error) );
	});
};

/**
 * Asynchronous operation to update a sleep record (with the wakeDateTime).
 * 
 * @param sleep {Sleep}	the sleep record to update. non-nullable. must have 
 * 						at least userId and sleepDateTime specified.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException. 
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
	
	return this.docClient.update(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("update sleep", error) );
	});
};

module.exports = SleepAWSDao;
