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

/**
 * Represents data access operations for weight.
 * @constructor
 * @param {DynamoDb} DynamoDB object used to work with the database. Non-nullable. 
 * @param {DocClient} DocClient object used to work with objects in the database. Non-nullable. 
 * @param {DaoUtils} Utilies to perform common operations against the database. Non-nullable.
 */
function WeightAWSDao(dynamodb, docClient, daoUtils) {
	this.dynamodb = dynamodb;
	this.docClient = docClient;
	this.daoUtils = daoUtils;
}

/**
 * Asynchronous operation to create the weight table if it doesn't already exist.
 * If it does exist, does nothing.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, LimitExceededException, 
 * 			or ResourceInUseException.
 */
WeightAWSDao.prototype.createTable = function() {
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
			        { AttributeName: "weightKey", KeyType: "HASH"},  //Partition key
			        { AttributeName: "date", KeyType: "RANGE" }  //Sort key
			    ],
			    AttributeDefinitions: [       
			        { AttributeName: "weightKey", AttributeType: "S" },
			        { AttributeName: "date", AttributeType: "S" }
			    ],
			    ProvisionedThroughput: {       
			        ReadCapacityUnits: 2, 
			        WriteCapacityUnits: 2
			    }
			};
			return self.dynamodb.createTable(params).promise()
			.catch(function(error) {
				return Promise.reject( new DaoError("create weight table", error) );
			});
		});
		
};

/**
 * Asynchronous operation to delete the weight table
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, LimitExceededException, 
 * 			ResourceInUseException, or ResourceNotFoundException.
 */
WeightAWSDao.prototype.deleteTable = function() {
	logger.debug("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return this.dynamodb.deleteTable(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("delete weight table", error) );
	});
};

/**
 * Asynchronous operation to persist a new weight record 
 * (or overwrite the existing weight record if one exists for 
 * the same userId, date).
 * 
 * @param 	weight {Weight} the weight object to persist. Non-nullable. 
 * 			Must have all properties populated.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException.
 */
WeightAWSDao.prototype.createWeight = function(weight) {
	var dateString = Utils.formatDateTimeString(weight.date, weight.timezone);
	logger.debug("createWeight: Starting weight creation for %s...", weight.toString());
	var params = {
	    TableName: TABLE_NAME,
	    Item:{
	    	weightKey: weight.userId + "-" + weight.seq,
			date: dateString,
			weight: weight.weight
	    }
	};
	return this.docClient.put(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("add weight", error) );
	});
};

/**
 * Asynchronous operation to retrieve all weight records created 
 * for the specified date or later for a given user.
 * 
 * @param userId {string}	AWS user ID whose weight records to retrieve. Non-nullable.
 * @param {number} seq		the sequence number of the baby whose weight to retrieve. Non-nullable.
 * @param date	{Date}		Date after which to retrieve all weight records. Non-nullable.
 * @param {String} timezone The timezone identifier for the user. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException.
 */
WeightAWSDao.prototype.getWeight = function(userId, seq, date, timezone) {
	logger.debug("getWeight: Starting get weight for day %s", date.toString());
	var params = {
			TableName : TABLE_NAME,
			KeyConditionExpression: "weightKey = :val1 and #dt > :val2",
			ExpressionAttributeNames: {
				"#dt": "date" //This is needed because date is a reserved word
			},
		    ExpressionAttributeValues: {
		    	":val1":userId + "-" + seq,
		        ":val2":Utils.formatDateString(date, timezone) 
		    }
	};
	return this.docClient.query(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("get weight", error) );
	});
};

/**
 * Asynchronous operation to retrieve the most recent weight for 
 * the given userId, or null if no weights exist.
 * 
 * @param userId {string} 	AWS user ID whose most recent weight to retrieve. Non-nullable.
 * @param {number} seq		the sequence number of the baby whose weight to retrieve. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException.
 */
WeightAWSDao.prototype.getLastWeight = function(userId, seq) {
	logger.debug("getLastWeight: Starting get last weight for user %s", userId);
	var params = {
			TableName : TABLE_NAME,
			KeyConditionExpression: "weightKey = :val1",
		    ExpressionAttributeValues: {
		    	":val1":userId+"-"+seq
		    },
		    ScanIndexForward: false,
		    Limit: 1
	};
	return this.docClient.query(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("get last weight", error) );
	});
};

/**
 * Asynchronous operation to delete the specified weight entry 
 * from the datastore.
 * 
 * @param userId {string}	AWS user ID whose weight to delete. Non-nullable.
 * @param {number} seq		the sequence number of the baby whose weight to delete. Non-nullable.
 * @param date {Date}		The date/time of the weight entry to delete. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 						or ResourceNotFoundException.   
 */
WeightAWSDao.prototype.deleteWeight = function(userId, seq, date, timezone) {
	var dateTimeString = Utils.formatDateTimeString(date, timezone);
	logger.debug("deleteWeight: Starting delete weight for %s %s", userId, dateTimeString );
	var params = {
	    TableName: TABLE_NAME,
	    Key:{
	        "weightKey":userId + "-" + seq,
	        "date":dateTimeString
	    }
	};
	return this.docClient.delete(params).promise()
		.catch(function(error) {
			return Promise.reject( new DaoError("remove weight", error) );
		});
};

/**
 * Asynchronous operation to to get a count of all weight entries created 
 * for the specified date or later for a given user.
 * 
 * @param {string} userId 	AWS user ID whose weight count to retrieve. Non-nullable.
 * @param {number} seq		the sequence number of the baby whose weight to retrieve. Non-nullable.
 * @param {Date} date		Date/time after which to count weight. Non-nullable.
 * @param {String} timezone The timezone identifier for the user. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the get succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			(if an error occurred interacting with DynamoDB.
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException).
 */
WeightAWSDao.prototype.getWeightCountForDay = function(userId, seq, date, timezone) {
	logger.debug("getWeightCountForDay: Starting get weight count for day %s", date.toString());
	var params = {
			TableName : TABLE_NAME,
			KeyConditionExpression: "weightKey = :val1 and #dt > :val2",
			ExpressionAttributeNames: {
				"#dt": "date" //This is needed because date is a reserved word
			},
		    ExpressionAttributeValues: {
		    	":val1":userId + "-" + seq,
		        ":val2":Utils.formatDateString(date, timezone) 
		    },
		    ProjectionExpression: "noattribute"
	};
	return this.docClient.query(params).promise()
		.then( function(queryResult)  {
			logger.debug("getWeightCountForDay: query result %s", JSON.stringify(queryResult));
			return Promise.resolve(queryResult.Count);
		})
		.catch(function(error) {
			return Promise.reject(new DaoError("get weight count for the day", error));
		});
};

/**
 * Asynchronous operation to delete all weight records for the given baby
 * param userId {string} 	AWS user ID whose records to delete. Non-nullable.
 * @param {number} seq		the sequence number of the baby whose records to delete. Non-nullable.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException.
 */
WeightAWSDao.prototype.deleteWeightsForBaby = function(userId, seq) {
	return this.daoUtils.deleteRecordsForBaby(TABLE_NAME, "weightKey", "date", userId, seq);
};

module.exports = WeightAWSDao;
