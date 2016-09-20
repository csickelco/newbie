/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class handles all data persistence (create-retrieve-update-delete operations) 
 * for babies via the AWS SDK.
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
var Winston = require('winston');
var AWS = require("aws-sdk");

//Check if environment supports native promises
if (typeof Promise === 'undefined') {
	AWS.config.setPromisesDependency(require('bluebird'));
}

//Configure DynamoDB access
AWS.config.update({
	region: "us-east-1",
	//endpoint: "http://localhost:4000"
	endpoint: "https://dynamodb.us-east-1.amazonaws.com"
});

////Configure the logger with basic logging template
var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Baby_Dao - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//DynamoDB table name
var TABLE_NAME = 'NEWBIE.BABY'; 

//DynamoDB access objects
var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

/**
 * Represents data access operations for babies.
 * @constructor
 */
function BabyAWSDao() {}

/**
 * Asynchronous operation to create the baby table if it doesn't already exist.
 * If it does exist, does nothing.
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws {ResourceInUseException} The operation conflicts with the resource's availability. 
 */
BabyAWSDao.prototype.createTable = function() {
	logger.debug("createTable: Starting table setup...");
	var describeParams = {
			TableName: TABLE_NAME,
	};
	var request = dynamodb.describeTable(describeParams);
	return request.promise()
    	.catch(function(error) {
    		logger.debug("createTable: Table doesn't yet exist, attempting to create..., error: " + error.message);
    		var params = {
			    TableName : TABLE_NAME,
			    KeySchema: [       
			        { AttributeName: "userId", KeyType: "HASH"}
			    ],
			    AttributeDefinitions: [       
			        { AttributeName: "userId", AttributeType: "S" }
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
 * Asynchronous operation to delete the baby table
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {LimitExceededException} The number of concurrent table requests exceeds the maximum allowed.
 * @throws {ResourceInUseException} The operation conflicts with the resource's availability. 
 * @throws {ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
BabyAWSDao.prototype.deleteTable = function() {
	logger.debug("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return dynamodb.deleteTable(params).promise();
};

/**
 * Asynchronous operation to persist a new baby 
 * (or overwrite the existing baby if one exists for 
 * the same userId).
 * 
 * @param 	{Baby} baby the baby object to persist. Non-nullable. 
 * 			Must have all properties populated.
 * 
 * @throws {ProvisionedThroughputExceededException} Request rate is too high.
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
BabyAWSDao.prototype.createBaby = function(baby) {
	logger.log('info', "createBaby: Starting baby creation for user %s, baby %s...", baby.toString());
	var params = {
	    TableName: TABLE_NAME,
	    Item:{
	    	userId: baby.userId,
	    	sex: baby.sex,
	    	name: baby.name,
	    	birthdate: baby.birthdate.toISOString()
	    }
	};
	return docClient.put(params).promise();
};

/**
 * Asynchronous operation to retrieve the baby for the given user.
 * 
 * @param {string} userId 	AWS user ID whose baby to retrieve. Non-nullable.
 * 
 * @throws {InternalServerError} An error occurred on the server side.
 * @throws {ProvisionedThroughputExceededException} Request rate is too high.
 * @throws {ResourceNotFoundException} 	The operation tried to access a nonexistent table or index. 
 * 										The resource might not be specified correctly, or its status 
 * 										might not be ACTIVE.
 */
BabyAWSDao.prototype.readBaby = function(userId) {
	logger.debug("readBaby: Starting for user %s...", userId);
	var params = {
	    TableName: TABLE_NAME,
	    Key:{
	        "userId": userId
	    }
	};
	return docClient.get(params).promise();
};

module.exports = BabyAWSDao;
