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

var DIAPER_TABLE_NAME = 'diaper'; //TODO: Is there an equivalent of a schema name? e.g. NEWBIE.baby

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

AWS.config.update({
	region: "us-east-1",
	//endpoint: "http://localhost:4000"
	endpoint: "https://dynamodb.us-east-1.amazonaws.com"
});
//Use bluebird implementation of Promise
//AWS.config.setPromisesDependency(require('bluebird'));

var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

function DiaperAWSDao() {}

DiaperAWSDao.prototype.setupDiaperTable = function() {
	logger.info("setupFeedTable: Starting diaper setup...");
	var describeParams = {
			TableName: DIAPER_TABLE_NAME,
	};
	return dynamodb.describeTable(describeParams).promise()
		.catch(function(error) {
			logger.info("setupDiaperTable: Table doesn't yet exist, attempting to create..., error: " + error.message);
			var params = {
			    TableName : DIAPER_TABLE_NAME,
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

//TODO: Diaper table should really be specific to a baby
//TODO: Make a diaper object?
DiaperAWSDao.prototype.createDiaper = function(userId, dateTime, isWet, isDirty) {
	var dateTimeString = dateTime.toISOString();
	logger.info("createDiaper: Starting diaper creation for user %s, dateTimeString %s, isWet %s, isDirty %s...", userId, dateTimeString, isWet, isDirty);
	var params = {
	    TableName: DIAPER_TABLE_NAME,
	    Item:{
	    	userId: userId,
	    	dateTime: dateTimeString,
			isWet: isWet,
			isDirty: isDirty
	    }
	};
	return docClient.put(params).promise();	
};

DiaperAWSDao.prototype.getDiapers = function(userId, date) {
	//TODO: probably need to take into account timezones
	logger.info("getDiapers: Starting get diapers for day %s", date.toString());
	var params = {
			TableName : DIAPER_TABLE_NAME,
			//TODO: use begins_with instead?
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
