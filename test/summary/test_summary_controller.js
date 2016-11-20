/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class unit-tests the SummaryController module. It was written with the help
 * of the following resources:
 * <ul>
 * <li>code mentor tutorial: https://www.codementor.io/nodejs/tutorial/unit-testing-nodejs-tdd-mocha-sinon</li>
 * <li>Promises in JavaScript Unit Tests, the Definitive Guide: https://www.sitepoint.com/promises-in-javascript-unit-tests-the-definitive-guide/</li>
 * <li>How to use mocha with promises: https://shaiisdotcom.wordpress.com/2014/09/19/how-to-use-mocha-with-promises/</li>
 * </ul>
 * 
 * @author Christina Sickelco
 */

//Used to write more secure javascript. See http://www.w3schools.com/js/js_strict.asp. 
'use strict';

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var SummaryController = require('../../summary/summary_controller');
var Response = require('../../common/response');
var FeedDao = require('../../feed/feed_aws_dao');
var BabyDao = require('../../baby/baby_aws_dao');
var Baby = require('../../baby/baby');
var WeightDao = require('../../weight/weight_aws_dao');
var DiaperDao= require('../../diaper/diaper_aws_dao');
var ActivityDao = require('../../activity/activity_aws_dao');
var SleepDao = require('../../sleep/sleep_aws_dao');

var IllegalArgumentError = require('../../common/illegal_argument_error');
var IllegalStateError = require('../../common/illegal_state_error');
var DaoError = require('../../common/dao_error');
var sinon = require('sinon');
var sinonAsPromised = require('sinon-as-promised');
var Promise = require('bluebird');

chai.use(chaiAsPromised);
chai.should();

describe('SummaryController', function() {
	var summaryController = new SummaryController();
	
	/*
	 * We want to stub out the pieces of code that make writing the tests difficult,
	 * namely the DAO code, since it would require establishing an actual connection,
	 * populating with consistent test data, and somehow figuring out how to get
	 * unlikely error conditions to trigger to fully test all paths.
	 */
	var diaperDaoGetDiapersStub;
	var sleepDaoGetSleepStub;
	var weightDaoGetWeightStub;
	var feedDaoGetFeedsStub;
	var babyDaoReadBabyStub;
	
	beforeEach(function() {	
		diaperDaoGetDiapersStub = sinon.stub(summaryController.diaperDao, 'getDiapers');
		sleepDaoGetSleepStub = sinon.stub(summaryController.sleepDao, 'getSleep');
		weightDaoGetWeightStub = sinon.stub(summaryController.weightDao, 'getWeight');
		feedDaoGetFeedsStub = sinon.stub(summaryController.feedDao, 'getFeeds');
		babyDaoReadBabyStub = sinon.stub(summaryController.babyDao, 'readBaby');
	});
	
	afterEach(function() {
		summaryController.diaperDao.getDiapers.restore();
		summaryController.sleepDao.getSleep.restore();
		summaryController.weightDao.getWeight.restore();
		summaryController.feedDao.getFeeds.restore();
		summaryController.babyDao.readBaby.restore();
	});
	
	//Weekly summary tests...
	
	//Invalid argument
	it('getWeeklySummary1()', function() {
		return summaryController.getWeeklySummary("").should.be.rejectedWith(IllegalArgumentError);
	});
	
	//No baby registered - Illegal state 
	it('getWeeklySummary2()', function() {
		babyDaoReadBabyStub.resolves(); //No baby returned
		return summaryController.getWeeklySummary('MOCK_USER_ID').should.be.rejectedWith(IllegalStateError);
	});
	
	//DAO Error
	it('getWeeklySummary3()', function() {
		var daoError = new DaoError("dao error", new Error("foo"));
		babyDaoReadBabyStub.rejects(daoError);
		return summaryController.getWeeklySummary('MOCK_USER_ID').should.be.rejectedWith(daoError);
	});
	 
	//Happy path
	it('getWeeklySummary4()', function() {
		//Stub baby return
		var d = new Date();
		  d.setDate(d.getDate()-(7*12));
		  d.setHours(0);
		  d.setMinutes(0);
		//Stub baby return
		  var baby = new Baby();
			baby.birthdate = d.toISOString();
			baby.sex = "girl";
			baby.userId = "MOCK_USER_ID";
			baby.name = "jane";
			baby.timezone = "America/New_York";
		babyDaoReadBabyStub.resolves(baby);
		
		//Stub feed return
		var feedItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":5
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-02T00:00:00.000Z",
					"feedAmount":5
				},
				{
					"dateTime":"2016-06-02T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-03T00:00:00.000Z",
					"feedAmount":5
				},
				{
					"dateTime":"2016-06-03T00:00:00.000Z",
					"feedAmount":6
				},
				]
			};
		feedDaoGetFeedsStub.resolves(feedItem);
		
		//Stub diaper return
		var diaperItems = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":false
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-02T00:00:00.000Z",
					"isWet":true,
					"isDirty":false
				},
				{
					"dateTime":"2016-06-02T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-03T00:00:00.000Z",
					"isWet":true,
					"isDirty":false
				},
				{
					"dateTime":"2016-06-03T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				]
			};
		diaperDaoGetDiapersStub.resolves(diaperItems);
		
		//Stub sleep
		var sleepItems = {
				"Items" :
				[
					{
						"sleepDateTime":"2016-06-01T00:00:00.000Z",
						"wokeUpDateTime":"2016-06-01T02:00:00.000Z"
					},
					{
						"sleepDateTime":"2016-06-01T05:00:00.000Z",
						"wokeUpDateTime":"2016-06-01T07:00:00.000Z"
					},
					{
						"sleepDateTime":"2016-06-02T00:00:00.000Z",
						"wokeUpDateTime":"2016-06-02T02:00:00.000Z"
					},
					{
						"sleepDateTime":"2016-06-02T05:00:00.000Z",
						"wokeUpDateTime":"2016-06-02T07:00:00.000Z"
					},
					{
						"sleepDateTime":"2016-06-03T00:00:00.000Z",
						"wokeUpDateTime":"2016-06-03T02:00:00.000Z"
					},
					{
						"sleepDateTime":"2016-06-03T05:00:00.000Z",
						"wokeUpDateTime":"2016-06-03T07:00:00.000Z"
					}
				]
			};
		sleepDaoGetSleepStub.resolves(sleepItems);
		
		//Stub weight
		var weightItems = {
				"Items" :
				[
					{
						"date":"2016-06-01T00:00:00.000Z",
						"weight": 200
					}
				]
			};
		weightDaoGetWeightStub.resolves(weightItems);
		
		var expectedResponseMsg = "jane is now 12 weeks old and weighs 12 pounds, 8 ounces. On average, she ate " +
			"2 times for a total of 11 ounces and had 2 wet and 1 dirty diaper per day. Each day, she generally slept about 4 hours";
		var expectedCardBody = "Age: 12 weeks\nWeight: 12 pounds, 8 ounces\nAverage number of feedings per day: 2\n" +
			"Average feeding amount per day: 11 ounces\nAverage number of wet diapers per day: 2\nAverage number of dirty diapers per day: 1\n" +
			"Average amount of sleep per day: 4 hours\n";
		var expectedResponse = new Response(expectedResponseMsg, "Weekly Summary", expectedCardBody);
		return summaryController.getWeeklySummary('MOCK_USER_ID')
			.should.eventually.deep.equal(expectedResponse);
	});
	
	it('getWeeklySummary4b()', function() {
		//Stub baby return
		var d = new Date();
		  d.setDate(d.getDate()-(7*12));
		  d.setHours(0);
		  d.setMinutes(0);
		//Stub baby return
		  var baby = new Baby();
			baby.birthdate = d.toISOString();
			baby.sex = "girl";
			baby.userId = "MOCK_USER_ID";
			baby.name = "jane";
			baby.timezone = "America/New_York";
		babyDaoReadBabyStub.resolves(baby);
		
		//Stub feed return
		var feedItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z"
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z"
				},
				{
					"dateTime":"2016-06-02T00:00:00.000Z"
				},
				{
					"dateTime":"2016-06-02T00:00:00.000Z"
				},
				{
					"dateTime":"2016-06-03T00:00:00.000Z"
				},
				{
					"dateTime":"2016-06-03T00:00:00.000Z"
				},
				]
			};
		feedDaoGetFeedsStub.resolves(feedItem);
		
		//Stub diaper return
		var diaperItems = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":false
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-02T00:00:00.000Z",
					"isWet":true,
					"isDirty":false
				},
				{
					"dateTime":"2016-06-02T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-03T00:00:00.000Z",
					"isWet":true,
					"isDirty":false
				},
				{
					"dateTime":"2016-06-03T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				]
			};
		diaperDaoGetDiapersStub.resolves(diaperItems);
		
		//Stub sleep
		var sleepItems = {
				"Items" :
				[
					{
						"sleepDateTime":"2016-06-01T00:00:00.000Z",
						"wokeUpDateTime":"2016-06-01T02:00:00.000Z"
					},
					{
						"sleepDateTime":"2016-06-01T05:00:00.000Z",
						"wokeUpDateTime":"2016-06-01T07:00:00.000Z"
					},
					{
						"sleepDateTime":"2016-06-02T00:00:00.000Z",
						"wokeUpDateTime":"2016-06-02T02:00:00.000Z"
					},
					{
						"sleepDateTime":"2016-06-02T05:00:00.000Z",
						"wokeUpDateTime":"2016-06-02T07:00:00.000Z"
					},
					{
						"sleepDateTime":"2016-06-03T00:00:00.000Z",
						"wokeUpDateTime":"2016-06-03T02:00:00.000Z"
					},
					{
						"sleepDateTime":"2016-06-03T05:00:00.000Z",
						"wokeUpDateTime":"2016-06-03T07:00:00.000Z"
					}
				]
			};
		sleepDaoGetSleepStub.resolves(sleepItems);
		
		//Stub weight
		var weightItems = {
				"Items" :
				[
					{
						"date":"2016-06-01T00:00:00.000Z",
						"weight": 200
					}
				]  
			};
		weightDaoGetWeightStub.resolves(weightItems);
		
		var expectedResponseMsg = "jane is now 12 weeks old and weighs 12 pounds, 8 ounces. On average, she ate " +
			"2 times and had 2 wet and 1 dirty diaper per day. Each day, she generally slept about 4 hours";
		var expectedCardBody = "Age: 12 weeks\nWeight: 12 pounds, 8 ounces\nAverage number of feedings per day: 2\n" +
			"Average number of wet diapers per day: 2\nAverage number of dirty diapers per day: 1\n" +
			"Average amount of sleep per day: 4 hours\n";
		var expectedResponse = new Response(expectedResponseMsg, "Weekly Summary", expectedCardBody);
		return summaryController.getWeeklySummary('MOCK_USER_ID')
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Daily summary tests...
	
	//Invalid argument
	it('getDailySummary1()', function() {
		return summaryController.getDailySummary("").should.be.rejectedWith(IllegalArgumentError);
	});
	
	//No baby registered
	it('getDailySummary2()', function() {
		babyDaoReadBabyStub.resolves(); //No baby returned
		return summaryController.getDailySummary('MOCK_USER_ID').should.be.rejectedWith(IllegalStateError);
	});

	//DAO Error
	it('getDailySummary3()', function() {
		var daoError = new DaoError("dao error", new Error("foo"));
		babyDaoReadBabyStub.rejects(daoError);
		return summaryController.getDailySummary('MOCK_USER_ID').should.be.rejectedWith(daoError);
	});
	
	//Happy path
	it('getDailySummary4()', function() {
		  var d = new Date();
		  d.setDate(d.getDate()-(7*12));
		  d.setHours(0);
		  d.setMinutes(0);
		//Stub baby return
		  var baby = new Baby();
			baby.birthdate = d.toISOString();
			baby.sex = "girl";
			baby.userId = "MOCK_USER_ID";
			baby.name = "jane";
			baby.timezone = "America/New_York";
		babyDaoReadBabyStub.resolves(baby);
		
		//Stub feed return
		var feedItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":5
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				}
				]
			};
		feedDaoGetFeedsStub.resolves(feedItem);
		
		//Stub diaper return
		var diaperItems = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":false
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				}
				]
			};
		diaperDaoGetDiapersStub.resolves(diaperItems);
		
		//Stub sleep
		var sleepItems = {
				"Items" :
				[
					{
						"sleepDateTime":"2016-06-01T00:00:00.000Z",
						"wokeUpDateTime":"2016-06-01T02:00:00.000Z"
					},
					{
						"sleepDateTime":"2016-06-01T05:00:00.000Z",
						"wokeUpDateTime":"2016-06-01T07:00:00.000Z"
					}
				]
			};
		sleepDaoGetSleepStub.resolves(sleepItems);
		
		//Stub weight
		var weightItems = {
				"Items" :
				[
					{
						"date":"2016-06-01T00:00:00.000Z",
						"weight": 200
					}
				]
			};
		weightDaoGetWeightStub.resolves(weightItems);
		
		var expectedResponseMsg = "Today, jane is 12 weeks old and weighs 12 pounds, 8 ounces. She ate " +
			"2 times for a total of 11 ounces and had 2 wet diapers and 1 dirty diaper. She slept 4 hours. ";
		var expectedCardBody = "Age: 12 weeks\nWeight: 12 pounds, 8 ounces\nNumber of feedings: 2\n" +
			"Total feeding amount: 11 ounces\nNumber of wet diapers: 2\nNumber of dirty diapers: 1\n" +
			"Sleep: 4 hours\n";
		var expectedResponse = new Response(expectedResponseMsg, "Daily Summary", expectedCardBody);
		return summaryController.getDailySummary('MOCK_USER_ID')
			.should.eventually.deep.equal(expectedResponse);
	});
	
	it('getDailySummary4b()', function() {
		  var d = new Date();
		  d.setDate(d.getDate()-(7*12));
		  d.setHours(0);
		  d.setMinutes(0);
		//Stub baby return
		  var baby = new Baby();
			baby.birthdate = d.toISOString();
			baby.sex = "girl";
			baby.userId = "MOCK_USER_ID";
			baby.name = "jane";
			baby.timezone = "America/New_York";
		babyDaoReadBabyStub.resolves(baby);
		
		//Stub feed return - no specified feed amounts
		var feedItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z"
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z"
				}
				]
			};
		feedDaoGetFeedsStub.resolves(feedItem);
		
		//Stub diaper return
		var diaperItems = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":false
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				}
				]
			};
		diaperDaoGetDiapersStub.resolves(diaperItems);
		
		//Stub sleep
		var sleepItems = {
				"Items" :
				[
					{
						"sleepDateTime":"2016-06-01T00:00:00.000Z",
						"wokeUpDateTime":"2016-06-01T02:00:00.000Z"
					},
					{
						"sleepDateTime":"2016-06-01T05:00:00.000Z",
						"wokeUpDateTime":"2016-06-01T07:00:00.000Z"
					}
				]
			};
		sleepDaoGetSleepStub.resolves(sleepItems);
		
		//Stub weight
		var weightItems = {
				"Items" :
				[
					{
						"date":"2016-06-01T00:00:00.000Z",
						"weight": 200
					}
				]
			};
		weightDaoGetWeightStub.resolves(weightItems);
		
		var expectedResponseMsg = "Today, jane is 12 weeks old and weighs 12 pounds, 8 ounces. She ate " +
			"2 times and had 2 wet diapers and 1 dirty diaper. She slept 4 hours. ";
		var expectedCardBody = "Age: 12 weeks\nWeight: 12 pounds, 8 ounces\nNumber of feedings: 2\n" +
			"Number of wet diapers: 2\nNumber of dirty diapers: 1\n" +
			"Sleep: 4 hours\n";
		var expectedResponse = new Response(expectedResponseMsg, "Daily Summary", expectedCardBody);
		return summaryController.getDailySummary('MOCK_USER_ID')
			.should.eventually.deep.equal(expectedResponse);
	});
	
	it('getDailySummary4c()', function() {
		  var d = new Date();
		  d.setDate(d.getDate()-(7*12));
		  d.setHours(0);
		  d.setMinutes(0);
		//Stub baby return
		  var baby = new Baby();
			baby.birthdate = d.toISOString();
			baby.sex = "girl";
			baby.userId = "MOCK_USER_ID";
			baby.name = "jane";
			baby.timezone = "America/New_York";
		babyDaoReadBabyStub.resolves(baby);
		
		//Stub feed return
		var feedItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":5
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z"
				}
				]
			};
		feedDaoGetFeedsStub.resolves(feedItem);
		
		//Stub diaper return
		var diaperItems = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":false
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				}
				]
			};
		diaperDaoGetDiapersStub.resolves(diaperItems);
		
		//Stub sleep
		var sleepItems = {
				"Items" :
				[
					{
						"sleepDateTime":"2016-06-01T00:00:00.000Z",
						"wokeUpDateTime":"2016-06-01T02:00:00.000Z"
					},
					{
						"sleepDateTime":"2016-06-01T05:00:00.000Z",
						"wokeUpDateTime":"2016-06-01T07:00:00.000Z"
					}
				]
			};
		sleepDaoGetSleepStub.resolves(sleepItems);
		
		//Stub weight
		var weightItems = {
				"Items" :
				[
					{
						"date":"2016-06-01T00:00:00.000Z",
						"weight": 200
					}
				]
			};
		weightDaoGetWeightStub.resolves(weightItems);
		
		var expectedResponseMsg = "Today, jane is 12 weeks old and weighs 12 pounds, 8 ounces. She ate " +
			"2 times, including 1 feed totaling 5 ounces, and had 2 wet diapers and 1 dirty diaper. She slept 4 hours. ";
		var expectedCardBody = "Age: 12 weeks\nWeight: 12 pounds, 8 ounces\nNumber of feedings: 2\n" +
			"Total (specified) feeding amount: 5 ounces\nNumber of wet diapers: 2\nNumber of dirty diapers: 1\n" +
			"Sleep: 4 hours\n";
		var expectedResponse = new Response(expectedResponseMsg, "Daily Summary", expectedCardBody);
		return summaryController.getDailySummary('MOCK_USER_ID')
			.should.eventually.deep.equal(expectedResponse);
	});
});

