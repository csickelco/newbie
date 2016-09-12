/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;
var Winston = require('winston');
var AWS = require("aws-sdk");

//Check if environment supports native promises
if (typeof Promise === 'undefined') {
	AWS.config.setPromisesDependency(require('bluebird'));
}

var BABY_TABLE_NAME = 'baby'; //TODO: Is there an equivalent of a schema name? e.g. NEWBIE.baby

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

AWS.config.update({
	region: "us-east-1",
	//endpoint: "http://localhost:4000"
	endpoint: "https://dynamodb.us-east-1.amazonaws.com"
});
//Use bluebird implementation of Promise
//AWS.config.setPromisesDependency(require('bluebird'));

var dynamodb = new AWS.DynamoDB();
var docClient = new AWS.DynamoDB.DocumentClient();

function BabyAWSDao() {}

BabyAWSDao.prototype.setupBabyTable = function() {
	logger.info("setupBabyTable: Starting table setup...");
	/*
	var params = {
		    TableName : BABY_TABLE_NAME,
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
	return dynamodb.createTable(params).send();
	*/
	
	var describeParams = {
			TableName: BABY_TABLE_NAME,
	};
	var request = dynamodb.describeTable(describeParams);
	return request.promise()
    	.catch(function(error) {
    		logger.info("setupBabyTable: Table doesn't yet exist, attempting to create..., error: " + error.message);
    		var params = {
			    TableName : BABY_TABLE_NAME,
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

BabyAWSDao.prototype.createBaby = function(userId, baby) {
	logger.log('info', "createBaby: Starting baby creation for user %s, baby %s...", userId, JSON.stringify(baby));
	var params = {
	    TableName: BABY_TABLE_NAME,
	    Item:{
	    	userId: userId,
	    	data: baby
	    }
	};
	return docClient.put(params).promise();
};

BabyAWSDao.prototype.readBaby = function(userId) {
	logger.info("readBaby: Starting for user %s...", userId);
	var params = {
	    TableName: BABY_TABLE_NAME,
	    Key:{
	        "userId": userId
	    }
	};
	return docClient.get(params).promise();
};

module.exports = BabyAWSDao;
