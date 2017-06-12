/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class handles all data persistence (create-retrieve-update-delete operations) 
 * for words via the AWS SDK.
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
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Word_Dao - '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
    	  }
      })
    ]
  });

//Constants
//DynamoDB table name
var TABLE_NAME = 'NEWBIE.WORD'; 

/**
 * Represents data access operations for words.
 * @constructor
 */
function WordAWSDao() {
	//DynamoDB access objects
	this.dynamodb = new AWS.DynamoDB();
	this.docClient = new AWS.DynamoDB.DocumentClient();
	this.daoUtils = new DaoUtils(this.dynamodb, this.docClient);
}

/**
 * Asynchronous operation to create the word table if it doesn't already exist.
 * If it does exist, does nothing.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the create succeeded,
 * 			else returns a rejected promise with a DaoError.
 */
WordAWSDao.prototype.createTable = function() {
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
			        { AttributeName: "wordKey", KeyType: "HASH"},  //Partition key
			        { AttributeName: "word", KeyType: "RANGE" }  //Sort key
			    ],
			    AttributeDefinitions: [       
			        { AttributeName: "wordKey", AttributeType: "S" },
			        { AttributeName: "word", AttributeType: "S" }
			    ],
			    ProvisionedThroughput: {       
			        ReadCapacityUnits: 3, 
			        WriteCapacityUnits: 3
			    }
			};
			return self.dynamodb.createTable(params).promise()
				.catch(function(error) {
					return Promise.reject( new DaoError("create the word table", error));
				});
	});
};

/**
 * Asynchronous operation to delete the word table
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the delete succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			(if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, LimitExceededException, 
 * 			ResourceInUseException, or ResourceNotFoundException).
 */
WordAWSDao.prototype.deleteTable = function() {
	logger.debug("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return this.dynamodb.deleteTable(params).promise()
		.catch(function(error) {
			return Promise.reject(new DaoError("delete the word table", error));
		});
};

/**
 * Asynchronous operation to persist a new word 
 * (or overwrite the existing word if one exists for 
 * the same userId, seq, dateTime).
 * 
 * @param 	{Word} word the word object to persist. Non-nullable. 
 * 			Must have all properties populated.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the create succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			(if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException).
 */
WordAWSDao.prototype.createWord = function(word) {
	var dateTimeString = Utils.formatDateTimeString(word.dateTime, word.timezone);
	logger.debug("createWord: Starting word creation for user %s, dateTimeString %s, word %s...", word.userId, dateTimeString, word.word);
	var params = {
	    TableName: TABLE_NAME,
	    Item:{
	    	wordKey: word.userId + "-" + word.seq,
	    	word: word.word,
	    	dateTime: dateTimeString
	    }
	};
	return this.docClient.put(params).promise()
		.catch(function(error) {
			return Promise.reject(new DaoError("create an word", error));
		});
};

/**
 * Asynchronous operation to to get a count of all words created 
 * for a given user/baby.
 * 
 * @param {string} userId 	AWS user ID whose word count to retrieve. Non-nullable.
 * @param {number} seq		the sequence number of the baby whose words to retrieve. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the get succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			(if an error occurred interacting with DynamoDB.
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException).
 */
WordAWSDao.prototype.getWordCount = function(userId, seq) {
	logger.debug("getWordCountForDay: Starting get word count");
	var params = {
			TableName : TABLE_NAME,
			KeyConditionExpression: "wordKey = :val1",
		    ExpressionAttributeValues: {
		    	":val1":userId + "-" + seq
		    },
		    ProjectionExpression: "noattribute"
	};
	return this.docClient.query(params).promise()
		.then( function(queryResult)  {
			logger.debug("getWordCountForDay: query result %s", JSON.stringify(queryResult));
			return Promise.resolve(queryResult.Count);
		})
		.catch(function(error) {
			return Promise.reject(new DaoError("get word count for the day", error));
		});
};

/**
 * Asynchronous operation to delete all word records for the given baby
 * param userId {string} 	AWS user ID whose records to delete. Non-nullable.
 * @param {number} seq		the sequence number of the baby whose records to delete. Non-nullable.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException.
 */
WordAWSDao.prototype.deleteWordsForBaby = function(userId, seq) {
	return this.daoUtils.deleteRecordsForBaby(TABLE_NAME, "wordKey", "dateTime", userId, seq);
};

module.exports = WordAWSDao;
