/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * This class contains a number of frequently used helper methods
 * for accessing a data store.
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
  		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Dao_Utils - '+ (undefined !== options.message ? options.message : '') +
            (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
  	  }
    })
  ]
});

//Constants
//DynamoDB table name
var BATCH_LIMIT = 25;

/**
 * @constructor
 */
function DaoUtils(dynamodb, docClient) {
	//DynamoDB access objects
	this.dynamodb = dynamodb;
	this.docClient = docClient;
}

/**
 * Asynchronous operation to delete all records, for a given baby,
 * from the specified table, from the datastore.
 * 
 * @param tableName {string} the table to delete records from. Non-nullable. Must already exist.
 * @param userId {string}	AWS user ID whose records to delete. Non-nullable.
 * @param {number} seq		the sequence number of the baby whose records to delete. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 						or ResourceNotFoundException.   
 */
DaoUtils.prototype.deleteRecordsForBaby = function(tableName, keyName, sortKeyName, userId, seq) {
	logger.debug("deleteRecordsForBaby: Starting delete records for %s - %s, %d", 
			tableName, userId, seq );
	var self = this;
	var params = {
	    TableName: tableName,
	    KeyConditionExpression: keyName + " = :keyValue",
	    ExpressionAttributeValues: {
	        ":keyValue": userId + "-" + seq
	    }
	};
	return this.docClient.query(params).promise()
		.then( function(queryResult)  {
			var batchCounter = 0;
			var fullDeleteRequest = "";
			var promises = [];
			queryResult.Items.forEach(function(item) {
	            logger.debug("deleteRecordsForBaby: Record %s", JSON.stringify(item));
	            batchCounter++;
	            if( batchCounter <= BATCH_LIMIT ) {
	            	if( batchCounter > 1 ) {
	            		fullDeleteRequest += ", ";
	            	}
	            	fullDeleteRequest += "{ \"DeleteRequest\": { \"Key\": { \"" + 
	            		keyName + "\": \"" + userId + "-" + seq +"\", \"" + 
            			sortKeyName + "\" : \"";
	            	if( sortKeyName === "dateTime" ) {
	            		fullDeleteRequest += item.dateTime;
	            	} else if( sortKeyName === "date" ) {
	            		fullDeleteRequest += item.date;
	            	} else if( sortKeyName === "sleepDateTime" ) {
	            		fullDeleteRequest += item.sleepDateTime;
	            	} else {
	            		throw "sortKeyName '" + sortKeyName + "' unknown";
	            	}
	            	fullDeleteRequest += "\" }	} }";
	            } else {
	            	var promise = self.submitDeleteRequest(tableName, fullDeleteRequest);
	            	promises.push(promise);
	            	fullDeleteRequest = "";
	            	batchCounter = 0;
	            }
	        });
			
			if( batchCounter > 0 ) {
				var promise = self.submitDeleteRequest(tableName, fullDeleteRequest);
				promises.push(promise);
			}
			
			return Promise.all(promises);
		});
};

/**
 */
DaoUtils.prototype.submitDeleteRequest = function(tableName, deleteRequestString) {
	var paramsString = "{ \"RequestItems\": { \"" + tableName + "\": [ " + deleteRequestString + "]}, " +
		"\"ReturnConsumedCapacity\": \"NONE\", " + " \"ReturnItemCollectionMetrics\": \"NONE\" }";
	logger.debug("submitDeleteRequest: Starting request... " + paramsString);
	var params = JSON.parse(paramsString);
	return this.docClient.batchWrite(params).promise()
		.catch(function(error) {
			return Promise.reject( new DaoError("remove records", error) );
		});
};

module.exports = DaoUtils;