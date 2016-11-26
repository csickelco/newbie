/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class handles all data persistence (create-retrieve-update-delete operations) 
 * for diapers via the AWS SDK.
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
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Diaper_Dao - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//DynamoDB table name
var TABLE_NAME = 'NEWBIE.DIAPER'; 

/**
 * Represents data access operations for diapers.
 * @constructor
 */
function DiaperAWSDao() {
	//DynamoDB access objects
	this.dynamodb = new AWS.DynamoDB();
	this.docClient = new AWS.DynamoDB.DocumentClient();
}

/**
 * Asynchronous operation to create the diaper table if it doesn't already exist.
 * If it does exist, does nothing.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, LimitExceededException, or ResourceInUseException.
 */
DiaperAWSDao.prototype.createTable = function() {
	logger.debug("createTable: Starting diaper setup...");
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
			        { AttributeName: "diaperKey", KeyType: "HASH"},  //Partition key
			        { AttributeName: "dateTime", KeyType: "RANGE" }  //Sort key
			    ],
			    AttributeDefinitions: [       
			        { AttributeName: "diaperKey", AttributeType: "S" },
			        { AttributeName: "dateTime", AttributeType: "S" }
			    ],
			    ProvisionedThroughput: {       
			        ReadCapacityUnits: 3, 
			        WriteCapacityUnits: 3
			    }
			};
			return self.dynamodb.createTable(params).promise()
			.catch(function(error) {
				return Promise.reject( new DaoError("create diaper table", error) );
			});
	});
};

/**
 * Asynchronous operation to delete the diaper table
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, LimitExceededException, 
 * 			ResourceInUseException or ResourceNotFoundException. 
 */
DiaperAWSDao.prototype.deleteTable = function() {
	logger.debug("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return this.dynamodb.deleteTable(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("delete diaper table", error) );
	});
};

/**
 * Asynchronous operation to persist a new diaper 
 * (or overwrite the existing diaper if one exists for 
 * the same userId, dateTime).
 * 
 * @param 	diaper {Diaper} the diaper object to persist. Non-nullable. 
 * 			Must have all properties populated.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceInUseException. 
 */
DiaperAWSDao.prototype.createDiaper = function(diaper) {
	var dateTimeString = Utils.formatDateTimeString(diaper.dateTime, diaper.timezone);
	logger.debug("createDiaper: Starting diaper creation for %s...", diaper.toString());
	var params = {
	    TableName: TABLE_NAME,
	    Item:{
	    	diaperKey: diaper.userId + "-" + diaper.seq,
	    	dateTime: dateTimeString,
			isWet: diaper.isWet,
			isDirty: diaper.isDirty
	    }
	};
	return this.docClient.put(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("add diaper", error) );
	});
};

/**
 * Asynchronous operation to retrieve all diapers created 
 * for the specified date or later for a given user.
 * 
 * @param userId {string}	AWS user ID whose diapers to retrieve. Non-nullable.
 * @param {number} seq		the sequence number of the baby whose diapers to retrieve. Non-nullable.
 * @param date {Date}		Date/time after which to retrieve all diapers. Non-nullable.
 * @param {String} timezone The timezone identifier for the user. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 						or ResourceNotFoundException.   
 */
DiaperAWSDao.prototype.getDiapers = function(userId, seq, date, timezone) {
	logger.debug("getDiapers: Starting get diapers for day %s", date.toString());
	var params = {
			TableName : TABLE_NAME,
			KeyConditionExpression: "diaperKey = :val1 and #dt > :val2",
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
		return Promise.reject( new DaoError("get diapers", error) );
	});
};

/**
 * Asynchronous operation to delete the specified diaper entry 
 * from the datastore.
 * 
 * @param userId {string}	AWS user ID whose diaper to delete. Non-nullable.
 * @param {number} seq		the sequence number of the baby whose diapers to retrieve. Non-nullable.
 * @param date {Date}		The date/time of the diaper entry to delete. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 						or ResourceNotFoundException.   
 */
DiaperAWSDao.prototype.deleteDiaper = function(userId, seq, dateTime, timezone) {
	logger.info("deleteDiaper: Starting delete diaper for %s %s", userId, dateTime );
	var params = {
	    TableName: TABLE_NAME,
	    Key:{
	        "diaperKey":userId + "-" + seq,
	        "dateTime": Utils.formatDateTimeString(dateTime, timezone) 
	    }
	};
	return this.docClient.delete(params).promise()
		.catch(function(error) {
			return Promise.reject( new DaoError("remove diaper", error) );
		});
};

/**
 * Asynchronous operation to retrieve the most recent diaper entry for 
 * the given userId, or null if no feeds exist.
 * 
 * @param userId {string} 	AWS user ID whose most recent diaper entry to retrieve. Non-nullable.
 * @param {number} seq		the sequence number of the baby whose diapers to retrieve. Non-nullable.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException.
 */
DiaperAWSDao.prototype.getLastDiaper = function(userId, seq) {
	logger.debug("getLastDiaper: Starting get last diaper for user %s", userId);
	var params = {
			TableName : TABLE_NAME,
			KeyConditionExpression: "diaperKey = :val1",
		    ExpressionAttributeValues: {
		    	":val1":userId + "-" + seq
		    },
		    ScanIndexForward: false,
		    Limit: 1
	};
	return this.docClient.query(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("get last diaper", error) );
	});
};

module.exports = DiaperAWSDao;
