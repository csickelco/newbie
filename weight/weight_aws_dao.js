/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class handles all data persistence (create-retrieve-update-delete operations) 
 * for weight records via the AWS SDK.
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
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Weight_Dao - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//DynamoDB table name
var TABLE_NAME = 'NEWBIE.WEIGHT'; 

//DynamoDB access objects
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

/**
 * Represents data access operations for weight.
 * @constructor
 */
function WeightAWSDao() {}

/**
 * Asynchronous operation to create the weight table if it doesn't already exist.
 * If it does exist, does nothing.
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws {ResourceInUseException} The operation conflicts with the resource's availability. 
 */
WeightAWSDao.prototype.createTable = function() {
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
			        { AttributeName: "date", KeyType: "RANGE" }  //Sort key
			    ],
			    AttributeDefinitions: [       
			        { AttributeName: "userId", AttributeType: "S" },
			        { AttributeName: "date", AttributeType: "S" }
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
 * Asynchronous operation to delete the weight table
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws {ResourceInUseException} The operation conflicts with the resource's availability. 
 * @throws {ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
WeightAWSDao.prototype.deleteTable = function() {
	logger.debug("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return dynamodb.deleteTable(params).promise();
};

/**
 * Asynchronous operation to persist a new weight record 
 * (or overwrite the existing weight record if one exists for 
 * the same userId, date).
 * 
 * @param 	weight {Weight} the weight object to persist. Non-nullable. 
 * 			Must have all properties populated.
 * 
 * @throws {ProvisionedThroughputExceededException} Request rate is too high.
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
WeightAWSDao.prototype.createWeight = function(weight) {
	var dateString = weight.date.toISOString();
	logger.debug("createWeight: Starting weight creation for %s...", weight.toString());
	var params = {
	    TableName: TABLE_NAME,
	    Item:{
	    	userId: weight.userId,
			date: dateString,
			weight: weight.weight
	    }
	};
	return docClient.put(params).promise();
};

/**
 * Asynchronous operation to retrieve all weight records created 
 * for the specified date or later for a given user.
 * 
 * @param userId {string}	AWS user ID whose weight records to retrieve. Non-nullable.
 * @param date	{Date}		Date after which to retrieve all weight records. Non-nullable.
 * 
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {ProvisionedThroughputExceededException} Request rate is too high.
 * @throws {ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
WeightAWSDao.prototype.getWeight = function(userId, date) {
	logger.debug("getWeight: Starting get weight for day %s", date.toString());
	var params = {
			TableName : TABLE_NAME,
			KeyConditionExpression: "userId = :val1 and #dt > :val2",
			ExpressionAttributeNames: {
				"#dt": "date" //This is needed because date is a reserved word
			},
		    ExpressionAttributeValues: {
		    	":val1":userId,
		        ":val2":Utils.formatDateString(date) 
		    }
	};
	return docClient.query(params).promise();
};

module.exports = WeightAWSDao;
