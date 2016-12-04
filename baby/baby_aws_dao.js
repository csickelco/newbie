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
var Winston = require('winston');
var AWS = require("aws-sdk");
var DaoError = require("../common/dao_error");
var SecurityUtils = require('../common/security_utils');
var clj_fuzzy = require('clj-fuzzy');
var Utils = require('../common/utils');

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

/**
 * Represents data access operations for babies.
 * @constructor
 */
function BabyAWSDao() {
	//DynamoDB access objects
	this.dynamodb = new AWS.DynamoDB();
	this.docClient = new AWS.DynamoDB.DocumentClient();
	this.securityUtils = new SecurityUtils();
}

/**
 * Asynchronous operation to create the baby table if it doesn't already exist.
 * If it does exist, does nothing.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the create succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			(if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, LimitExceededException, 
 * 			or ResourceInUseException).
 */
BabyAWSDao.prototype.createTable = function() {
	logger.debug("createTable: Starting table setup...");
	var describeParams = {
			TableName: TABLE_NAME,
	};
	var self = this;
	var request = self.dynamodb.describeTable(describeParams);
	return request.promise()
    	.catch(function(error) {
    		logger.debug("createTable: Table doesn't yet exist, attempting to create..., error: " + error.message);
    		var params = {
			    TableName : TABLE_NAME,
			    KeySchema: [       
			        { AttributeName: "userId", KeyType: "HASH"},
			        { AttributeName: "seq", KeyType: "RANGE" }  //Sort key
			    ],
			    AttributeDefinitions: [       
			        { AttributeName: "userId", AttributeType: "S" },
			        { AttributeName: "seq", AttributeType: "N" }
			    ],
			    ProvisionedThroughput: {       
			        ReadCapacityUnits: 5, 
			        WriteCapacityUnits: 2
			    }
    		};
    		return self.dynamodb.createTable(params).promise()
	    		.catch(function(error) {
	    			return Promise.reject( new DaoError("create baby table", error) );
	    		});
    	});
    	
};

/**
 * Asynchronous operation to delete the baby table
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the delete succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			(if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, LimitExceededException, 
 * 			ResourceInUseException, or ResourceNotFoundException
 */
BabyAWSDao.prototype.deleteTable = function() {
	logger.debug("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return this.dynamodb.deleteTable(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("delete baby table", error) );
	});
};

/**
 * Asynchronous operation to persist a new baby 
 * (or overwrite the existing baby if one exists for 
 * the same userId).
 * 
 * @param 	{Baby} baby the baby object to persist. Non-nullable. 
 * 			Must have all properties populated.
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the create succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			(if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException. 
 */
BabyAWSDao.prototype.createBaby = function(baby) {
	logger.log('info', "createBaby: Starting baby creation for user %s, baby %s...", baby.toString());
	var params = {
	    TableName: TABLE_NAME,
	    Item:{
	    	userId: baby.userId,
	    	sex: baby.sex,
	    	name: this.securityUtils.encrypt(baby.name),
	    	birthdate: this.securityUtils.encrypt(Utils.formatDateTimeString(baby.birthdate, baby.timezone)),
	    	timezone: baby.timezone,
	    	addedDateTime: Utils.formatDateTimeString(baby.addedDateTime, baby.timezone),
	    	seq: baby.seq
	    }
	};
	return this.docClient.put(params).promise()
	.catch(function(error) {
		return Promise.reject( new DaoError("add baby", error) );
	});
};

/**
 * Asynchronous operation to retrieve the last baby for the given user.
 * 
 * @param {string} userId 	AWS user ID whose baby to retrieve. Non-nullable.
 * @returns {Promise<Baby|DaoError} Returns a promise with a baby object if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException. 
 */
BabyAWSDao.prototype.readBaby = function(userId) {
	logger.debug("readBaby: Starting for user %s...", userId);
	var params = {
	    TableName: TABLE_NAME,
	    KeyConditionExpression: "userId = :val1",
	    ExpressionAttributeValues: {
	    	":val1":userId
	    },
	    ScanIndexForward: false,
	    Limit: 1
	};
	var self = this;
	return this.docClient.query(params).promise()
		.then( function(readBabyResult) {
			var babyResult;
			//Then put it all together in a response
			readBabyResult.Items.forEach(function(item) {
	           babyResult = item;
	        });
			
			if(babyResult) {
				babyResult.name = self.securityUtils.decrypt(babyResult.name);
				babyResult.birthdate = self.securityUtils.decrypt(babyResult.birthdate);
			}
			return Promise.resolve(babyResult);
		})
		.catch(function(error) {
			return Promise.reject( new DaoError("read baby", error) );
		});
};

/**
 * Asynchronous operation to retrieve the baby with the given name for the given user.
 * 
 * @param {string} userId 	AWS user ID whose baby to retrieve. Non-nullable.
 * @param {string} babyName the name of the baby to retrieve. Non-nullable. 
 * @returns {Promise<Baby|DaoError} Returns a promise with a Baby object if the operation succeeded,
 * 			(or an empty promise if no baby exists for the given userId/name combo)
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException. 
 */
BabyAWSDao.prototype.readBabyByName = function(userId, babyName) {
	logger.debug("readBabyByName: Starting for user %s, babyName %s...", userId, babyName);
	var params = {
	    TableName: TABLE_NAME,
	    KeyConditionExpression: "userId = :val1",
	    ExpressionAttributeValues: {
	    	":val1":userId
	    }
	};
	var highScore = 1;
	var babyWithHighestScore;
	var self = this;
	return this.docClient.query(params).promise()
		.then( function(readBabyResult) {
			var babyResult;
			//Then put it all together in a response
			readBabyResult.Items.forEach(function(item) {
				logger.debug("readBabyByName: item.name '%s', babyName '%s'", item.name, babyName);
				item.name = self.securityUtils.decrypt(item.name);
				if( item.name.toLowerCase() === babyName.toLowerCase() ) {
					logger.debug("Found baby %s", babyName);
					babyResult = item;
				} else if( !babyResult ) {
					/*
					 * Exact matches on name are tricky as there can be several alternate spellings
					 * (e.g. Nathalie vs Natalie) and it's unclear which Amazon will pick.
					 * Therefore, if there is no exact match, look for one that is close. 
					 */
					var similarityScore = clj_fuzzy.metrics.jaccard(
							item.name.toLowerCase(), babyName.toLowerCase());
					logger.debug("name %s, score %s", item.name, similarityScore);
					if( similarityScore < highScore ) {
						highScore = similarityScore;
						babyWithHighestScore = item;
					}
				} 
	        });
			logger.debug("readBabyByName: babyName %s, babyWithHighestScore %s, highScore %d", 
					babyName, JSON.stringify(babyWithHighestScore), highScore);
			if(!babyResult && highScore < 0.2) {
				babyResult = babyWithHighestScore;
			}
			
			if(babyResult) {
				babyResult.birthdate = self.securityUtils.decrypt(babyResult.birthdate);
			}
			return Promise.resolve(babyResult);
		})
		.catch(function(error) {
			return Promise.reject( new DaoError("read baby", error) );
		});
};

/**
 * Asynchronous operation to to get a count of all babies for a given user.
 * 
 * @param {string} userId 	AWS user ID whose baby count to retrieve. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the get succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			(if an error occurred interacting with DynamoDB.
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 			or ResourceNotFoundException).
 */
BabyAWSDao.prototype.getBabyCount = function(userId) {
	logger.debug("getBabyCount: Starting get baby count for user %s",userId);
	var params = {
			TableName : TABLE_NAME,
			KeyConditionExpression: "userId = :val1",
		    ExpressionAttributeValues: {
		    	":val1":userId
		    },
		    ProjectionExpression: "noattribute"
	};
	return this.docClient.query(params).promise()
		.then( function(queryResult)  {
			logger.debug("getBabyCount: query result %s", JSON.stringify(queryResult));
			return Promise.resolve(queryResult.Count);
		})
		.catch(function(error) {
			return Promise.reject(new DaoError("get baby count", error));
		});
};

/**
 * Asynchronous operation to delete the specified baby
 * 
 * @param userId {string}	AWS user ID whose baby to delete. Non-nullable.
 * @param {number} seq		the sequence number of the baby to delete. Non-nullable.
 * 
 * @returns {Promise<Empty|DaoError} Returns an empty promise if the operation succeeded,
 * 			else returns a rejected promise with a DaoError 
 * 			if an error occurred interacting with DynamoDB. 
 * 			Could be caused by an InternalServerError, ProvisionedThroughputExceededException, 
 * 						or ResourceNotFoundException.   
 */
BabyAWSDao.prototype.deleteBaby = function(userId, seq) {
	logger.debug("deleteActivitiesForBaby: Starting delete baby for %s %d", userId, seq );
	var params = {
	    TableName: TABLE_NAME,
	    Key:{
	    	userId: userId,
	    	seq: seq
	    }
	};
	return this.docClient.delete(params).promise()
		.catch(function(error) {
			return Promise.reject( new DaoError("remove baby", error) );
		});
};

module.exports = BabyAWSDao;
