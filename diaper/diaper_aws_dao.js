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
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Diaper_Dao - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//DynamoDB table name
var TABLE_NAME = 'NEWBIE.DIAPER'; 

//DynamoDB access objects
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

/**
 * Represents data access operations for diapers.
 * @constructor
 */
function DiaperAWSDao() {}

/**
 * Asynchronous operation to create the diaper table if it doesn't already exist.
 * If it does exist, does nothing.
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws {ResourceInUseException} The operation conflicts with the resource's availability. 
 */
DiaperAWSDao.prototype.createTable = function() {
	logger.debug("createTable: Starting diaper setup...");
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
			return dynamodb.createTable(params).promise();
	});
};

/**
 * Asynchronous operation to delete the diaper table
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws {ResourceInUseException} The operation conflicts with the resource's availability. 
 * @throws {ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
DiaperAWSDao.prototype.deleteTable = function() {
	logger.debug("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return dynamodb.deleteTable(params).promise();
};

/**
 * Asynchronous operation to persist a new diaper 
 * (or overwrite the existing diaper if one exists for 
 * the same userId, dateTime).
 * 
 * @param 	diaper {Diaper} the diaper object to persist. Non-nullable. 
 * 			Must have all properties populated.
 * 
 * @throws {ProvisionedThroughputExceededException} Request rate is too high.
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
DiaperAWSDao.prototype.createDiaper = function(diaper) {
	var dateTimeString = diaper.dateTime.toISOString();
	logger.debug("createDiaper: Starting diaper creation for %s...", diaper.toString());
	var params = {
	    TableName: TABLE_NAME,
	    Item:{
	    	userId: diaper.userId,
	    	dateTime: dateTimeString,
			isWet: diaper.isWet,
			isDirty: diaper.isDirty
	    }
	};
	return docClient.put(params).promise();	
};

/**
 * Asynchronous operation to retrieve all diapers created 
 * for the specified date or later for a given user.
 * 
 * @param userId {string}	AWS user ID whose diapers to retrieve. Non-nullable.
 * @param date {Date}		Date/time after which to retrieve all diapers. Non-nullable.
 * 
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {ProvisionedThroughputExceededException} Request rate is too high.
 * @throws {ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
DiaperAWSDao.prototype.getDiapers = function(userId, date) {
	logger.debug("getDiapers: Starting get diapers for day %s", date.toString());
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
	return docClient.query(params).promise();
};

module.exports = DiaperAWSDao;
