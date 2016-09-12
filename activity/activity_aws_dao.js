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

var ACTIVITY_TABLE_NAME = 'activity'; //TODO: Is there an equivalent of a schema name? e.g. NEWBIE.baby

var logger = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)({
    	  timestamp: function() {
    		  return new Date();
    	  },
    	  formatter: function(options) {
    		  return '[' + options.level.toUpperCase() + '] '+ options.timestamp() +' Activity_Dao - '+ (undefined !== options.message ? options.message : '') +
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

function ActivityAWSDao() {}

ActivityAWSDao.prototype.setupActivityTable = function() {
	logger.info("setupActivityTable: Starting table setup...");
	var describeParams = {
			TableName: ACTIVITY_TABLE_NAME,
	};
	return dynamodb.describeTable(describeParams).promise()
		.catch(function(error) {
			logger.info("setupActivityTable: Table doesn't yet exist, attempting to create..., error: " + error.message);
			var params = {
			    TableName : ACTIVITY_TABLE_NAME,
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

//TODO: Activity table should really be specific to a baby
ActivityAWSDao.prototype.createActivity = function(userId, dateTime, activity) {
	var dateTimeString = dateTime.toISOString();
	logger.info("createActivity: Starting activity creation for user %s, dateTimeString %s, activity %s...", userId, dateTimeString, activity);
	var params = {
	    TableName: ACTIVITY_TABLE_NAME,
	    Item:{
	    	userId: userId,
	    	dateTime: dateTimeString,
			activity: activity
	    }
	};
	return docClient.put(params).promise();	
};

ActivityAWSDao.prototype.getActivitiesForDay = function(userId, date) {
	//TODO: probably need to take into account timezones
	logger.info("getActivitiesForDay: Starting get activities for day %s", date.toString());
	var params = {
			TableName : ACTIVITY_TABLE_NAME,
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

module.exports = ActivityAWSDao;