/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;
var Utils = require('../common/utils');
var Winston = require('winston');
var AWS = require("aws-sdk");

//Check if environment supports native promises
if (typeof Promise === 'undefined') {
	AWS.config.setPromisesDependency(require('bluebird'));
}

var WEIGHT_TABLE_NAME = 'weight'; //TODO: Is there an equivalent of a schema name? e.g. NEWBIE.baby

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

AWS.config.update({
	region: "us-east-1",
	//endpoint: "http://localhost:4000"
	endpoint: "https://dynamodb.us-east-1.amazonaws.com"
});
//Use bluebird implementation of Promise
//AWS.config.setPromisesDependency(require('bluebird'));

var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

function WeightAWSDao() {}

WeightAWSDao.prototype.setupWeightTable = function() {
	logger.info("setupWeightTable: Starting table setup...");
	var describeParams = {
			TableName: WEIGHT_TABLE_NAME,
	};
	return dynamodb.describeTable(describeParams).promise()
		.catch(function(error) {
			logger.info("setupWeightTable: Table doesn't yet exist, attempting to create..., error: " + error.message);
			var params = {
			    TableName : WEIGHT_TABLE_NAME,
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

//TODO: Weight table should really be specific to a baby
WeightAWSDao.prototype.createWeight = function(userId, weight, date) {
	var dateString = date.toISOString();
	logger.info("createWeight: Starting weight creation for user %s, dateString %s, weight %s...", userId, dateString, weight);
	var params = {
	    TableName: WEIGHT_TABLE_NAME,
	    Item:{
	    	userId: userId,
			date: dateString,
			weight: weight
	    }
	};
	return docClient.put(params).promise();
};

WeightAWSDao.prototype.getWeight = function(userId, date) {
	//TODO: probably need to take into account timezones
	logger.info("getWeight: Starting get weight for day %s", date.toString());
	var params = {
			TableName : WEIGHT_TABLE_NAME,
			//TODO: use begins_with instead?
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
