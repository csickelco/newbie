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

var TABLE_NAME = 'activity'; //TODO: Is there an equivalent of a schema name? e.g. NEWBIE.baby

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

ActivityAWSDao.prototype.createTable = function() {
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

ActivityAWSDao.prototype.deleteTable = function() {
	logger.debug("deleteTable: Starting table delete");
	var params = {
	    TableName : TABLE_NAME
	};
	return dynamodb.deleteTable(params).promise();
};

//TODO: Activity table should really be specific to a baby
ActivityAWSDao.prototype.createActivity = function(activity) {
	var dateTimeString = activity.dateTime.toISOString();
	logger.debug("createActivity: Starting activity creation for user %s, dateTimeString %s, activity %s...", activity.userId, dateTimeString, activity.activity);
	var params = {
	    TableName: TABLE_NAME,
	    Item:{
	    	userId: activity.userId,
	    	dateTime: dateTimeString,
			activity: activity.activity
	    }
	};
	return docClient.put(params).promise();	
};

ActivityAWSDao.prototype.getActivitiesForDay = function(userId, date) {
	//TODO: probably need to take into account timezones
	logger.debug("getActivitiesForDay: Starting get activities for day %s", date.toString());
	var params = {
			TableName : TABLE_NAME,
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
