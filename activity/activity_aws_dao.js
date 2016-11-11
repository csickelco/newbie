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
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Activity_Dao - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//DynamoDB table name
var TABLE_NAME = 'NEWBIE.ACTIVITY'; 

/**
 * Represents data access operations for activities.
 * @constructor
 */
function ActivityAWSDao() {
	//DynamoDB access objects
	this.dynamodb = new AWS.DynamoDB();
	this.docClient = new AWS.DynamoDB.DocumentClient();
}

/**
 * Asynchronous operation to create the activity table if it doesn't already exist.
 * If it does exist, does nothing.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the create succeeded,
 * 			else returns a rejected promise with a DaoError.
 */
ActivityAWSDao.prototype.createTable = function() {
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
			        { AttributeName: "dateTime", KeyType: "RANGE" }  //Sort key
			    ],
			    AttributeDefinitions: [       
			        { AttributeName: "userId", AttributeType: "S" },
			        { AttributeName: "dateTime", AttributeType: "S" }
			    ],
			    ProvisionedThroughput: {       
			        ReadCapacityUnits: 3, 
			        WriteCapacityUnits: 3
			    }
			};
			return self.dynamodb.createTable(params).promise()
				.catch(function(error) {
					return Promise.reject( new DaoError("create the activity table", error));
				});
	});
};

/**
 * Asynchronous operation to delete the activity table
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the delete succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			(if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, LimitExceededException, 
 * 			ResourceInUseException, or ResourceNotFoundException).
 */
ActivityAWSDao.prototype.deleteTable = function() {
	logger.debug("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return this.dynamodb.deleteTable(params).promise()
		.catch(function(error) {
			return Promise.reject(new DaoError("delete the activity table", error));
		});
};

/**
 * Asynchronous operation to persist a new activity 
 * (or overwrite the existing activity if one exists for 
 * the same userId, dateTime).
 * 
 * @param 	{Activity} activity the activity object to persist. Non-nullable. 
 * 			Must have all properties populated.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the create succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			(if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException).
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
	return this.docClient.put(params).promise()
		.catch(function(error) {
			return Promise.reject(new DaoError("create an activity", error));
		});
};

/**
 * Asynchronous operation to retrieve all activities created 
 * for the specified date or later for a given user.
 * 
 * @param {string} userId 	AWS user ID whose activities to retrieve. Non-nullable.
 * @param {Date} date		Date/time after which to retrieve all activities. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the get succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			(if an error occurred interacting with DynamoDB.
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException).
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
	return this.docClient.query(params).promise()
		.catch(function(error) {
			return Promise.reject(new DaoError("get activities for the day", error));
		});
};

/**
 * Asynchronous operation to to get a count of all activities created 
 * for the specified date or later for a given user.
 * 
 * @param {string} userId 	AWS user ID whose activity count to retrieve. Non-nullable.
 * @param {Date} date		Date/time after which to count activities. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the get succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			(if an error occurred interacting with DynamoDB.
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException).
 */
ActivityAWSDao.prototype.getActivityCountForDay = function(userId, date) {
	logger.debug("getActivityCountForDay: Starting get activity count for day %s", date.toString());
	var params = {
			TableName : TABLE_NAME,
			KeyConditionExpression: "userId = :val1 and #dt > :val2",
			ExpressionAttributeNames: {
				"#dt": "dateTime" //This is needed because dateTime is a reserved word
			},
		    ExpressionAttributeValues: {
		    	":val1":userId,
		        ":val2":Utils.formatDateString(date) 
		    },
		    ProjectionExpression: "noattribute"
	};
	return this.docClient.query(params).promise()
		.then( function(queryResult)  {
			logger.debug("getActivityCountForDay: query result %s", JSON.stringify(queryResult));
			return Promise.resolve(queryResult.Count);
		})
		.catch(function(error) {
			return Promise.reject(new DaoError("get activity count for the day", error));
		});
};

/**
 * Asynchronous operation to retrieve the most recent activity for 
 * the given userId, or null if no activitys exist.
 * 
 * @param userId {string} 	AWS user ID whose most recent activity to retrieve. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException.
 */
ActivityAWSDao.prototype.getLastActivity = function(userId) {
	logger.debug("getLastActivity: Starting get last activity for user %s", userId);
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
		return Promise.reject( new DaoError("get last activity", error) );
	});
};

/**
 * Asynchronous operation to delete the specified activity entry 
 * from the datastore.
 * 
 * @param userId {string}	AWS user ID whose activity to delete. Non-nullable.
 * @param date {Date}		The date/time of the activity entry to delete. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 						or ResourceNotFoundException.   
 */
ActivityAWSDao.prototype.deleteActivity = function(userId, dateTime) {
	logger.debug("deleteActivity: Starting delete activity for %s %s", userId, dateTime.toISOString() );
	var params = {
	    TableName: TABLE_NAME,
	    Key:{
	        "userId":userId,
	        "dateTime":dateTime.toISOString() 
	    }
	};
	return this.docClient.delete(params).promise()
		.catch(function(error) {
			return Promise.reject( new DaoError("remove activity", error) );
		});
};

module.exports = ActivityAWSDao;
