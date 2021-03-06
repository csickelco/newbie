/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class unit-tests the FeedController module. It was written with the help
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
var FeedController = require('../../feed/feed_controller');
var FeedDao = require('../../feed/feed_aws_dao');
var Response = require('../../common/response');
var BabyDao = require('../../baby/baby_aws_dao');
var Baby = require('../../baby/baby');
var IllegalArgumentError = require('../../common/illegal_argument_error');
var IllegalStateError = require('../../common/illegal_state_error');
var ActivityLimitError = require('../../common/activity_limit_error');
var DaoError = require('../../common/dao_error');
var sinon = require('sinon');
var sinonAsPromised = require('sinon-as-promised');
var Promise = require('bluebird');

chai.use(chaiAsPromised);
chai.should();

describe('FeedController', function() {
	var feedController = new FeedController(new FeedDao(), new BabyDao());
	
	/*
	 * We want to stub out the pieces of code that make writing the tests difficult,
	 * namely the DAO code, since it would require establishing an actual connection,
	 * populating with consistent test data, and somehow figuring out how to get
	 * unlikely error conditions to trigger to fully test all paths.
	 */
	var feedDaoCreateFeedStub;
	var feedDaoCreateTableStub;
	var feedDaoGetFeedsStub;
	var feedDaoGetLastFeedStub;
	var feedDaoDeleteFeedStub;
	var babyDaoReadBabyStub;
	
	beforeEach(function() {	    	
		feedDaoCreateFeedStub = sinon.stub(feedController.feedDao, 'createFeed');
		feedDaoCreateTableStub = sinon.stub(feedController.feedDao, 'createTable');
		feedDaoGetFeedsStub = sinon.stub(feedController.feedDao, 'getFeeds');
		feedDaoGetLastFeedStub = sinon.stub(feedController.feedDao, 'getLastFeed');
		feedDaoDeleteFeedStub = sinon.stub(feedController.feedDao, 'deleteFeed');
		babyDaoReadBabyStub = sinon.stub(feedController.babyDao, 'readBaby');
	});
	
	afterEach(function() {
		feedController.feedDao.createFeed.restore();
		feedController.feedDao.createTable.restore();
		feedController.feedDao.getFeeds.restore();
		feedController.feedDao.getLastFeed.restore();
		feedController.feedDao.deleteFeed.restore();
		feedController.babyDao.readBaby.restore();
	});
	 
	//addfeed tests
	//Happy path test 1
	it('addfeed1()', function() {
		feedDaoCreateFeedStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var feedItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				}
				]
			};
		feedDaoGetFeedsStub.resolves(feedItem);
		var expectedResponseMsg = "Added 5 ounce feed for jane. " +
			"Today, she has eaten 11 ounces over 2 feeds";
		var expectedResponse = new Response(expectedResponseMsg, "Feed", expectedResponseMsg);
		return feedController.addFeed("MOCK_USER_ID", new Date(), 5)
			.should.eventually.deep.equal(expectedResponse);
	});
	
	it('addfeed1b()', function() {
		feedDaoCreateFeedStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var feedItem = {
				"Items" :
				[
				]
			};
		feedDaoGetFeedsStub.resolves(feedItem);
		var expectedResponseMsg = "Added 1 ounce feed for jane. " +
			"Today, she has eaten 1 ounce over 1 feed";
		var expectedResponse = new Response(expectedResponseMsg, "Feed", expectedResponseMsg);
		return feedController.addFeed("MOCK_USER_ID", new Date(), 1)
			.should.eventually.deep.equal(expectedResponse);
	});
	
	it('addfeed1c()', function() {
		feedDaoCreateFeedStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var feedItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				}
				]
			};
		feedDaoGetFeedsStub.resolves(feedItem);
		var expectedResponseMsg = "Added feed for jane. " +
			"Today, she's had 2 feeds, including 1 feed of 6 ounces";
		var expectedResponse = new Response(expectedResponseMsg, "Feed", expectedResponseMsg);
		return feedController.addFeed("MOCK_USER_ID", new Date())
			.should.eventually.deep.equal(expectedResponse);
	});
	
	it('addfeed1d()', function() {
		feedDaoCreateFeedStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var feedItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":5
				}
				]
			};
		feedDaoGetFeedsStub.resolves(feedItem);
		var expectedResponseMsg = "Added feed for jane. " +
			"Today, she's had 3 feeds, including 2 feeds totaling 11 ounces";
		var expectedResponse = new Response(expectedResponseMsg, "Feed", expectedResponseMsg);
		return feedController.addFeed("MOCK_USER_ID", new Date())
			.should.eventually.deep.equal(expectedResponse);
	});
	
	it('addfeed1e()', function() {
		feedDaoCreateFeedStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
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
		var expectedResponseMsg = "Added feed for jane. " +
			"Today, she's had 3 feeds";
		var expectedResponse = new Response(expectedResponseMsg, "Feed", expectedResponseMsg);
		return feedController.addFeed("MOCK_USER_ID", new Date())
			.should.eventually.deep.equal(expectedResponse);
	});
	
	it('addfeed1f()', function() {
		feedDaoCreateFeedStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var feedItem = {
				"Items" :
				[
				]
			};
		feedDaoGetFeedsStub.resolves(feedItem);
		var expectedResponseMsg = "Added 6 ounce feed for jane. " +
			"Today, she has eaten 6 ounces over 1 feed";
		var expectedResponse = new Response(expectedResponseMsg, "Feed", expectedResponseMsg);
		return feedController.addFeed("MOCK_USER_ID", new Date(), 6)
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Illegal argument tests - no user ID
	it('addfeed3()', function() {
		return feedController.addFeed(null, new Date(), 5).should.be.rejectedWith(IllegalArgumentError);
	});
	it('addfeed4()', function() {
		return feedController.addFeed('', new Date(), 5).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument tests - no datetime
	it('addfeed5()', function() {
		return feedController.addFeed("MOCK_USER_ID", null, 5).should.be.rejectedWith(IllegalArgumentError);
	});
	it('addfeed6()', function() {
		return feedController.addFeed("MOCK_USER_ID", '', 5).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument tests - invalid feedAmount
	it('addfeed10()', function() {
		return feedController.addFeed("MOCK_USER_ID", new Date(), -1).should.be.rejectedWith(RangeError);
	});
	//Invalid types
	it('addfeed11()', function() {
		feedDaoCreateFeedStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
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
		return feedController.addFeed("MOCK_USER_ID", "No Date", 5).should.be.rejectedWith(TypeError);
	});
	it('addfeed12()', function() {
		feedDaoCreateFeedStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
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
		return feedController.addFeed("MOCK_USER_ID", new Date(), "not a feed amount").should.be.rejectedWith(TypeError);
	});
	//Illegal state tests
	it('addfeed13()', function() {
		feedDaoCreateFeedStub.resolves();
		babyDaoReadBabyStub.resolves(); //No baby returned
		return feedController.addFeed('MOCK_USER_ID', new Date(), 5).should.be.rejectedWith(IllegalStateError);
	});
	//DAO Errors
	it('addfeed14()', function() {
		var daoError = new DaoError("create the feed", new Error("foo"));
		feedDaoCreateFeedStub.rejects(daoError);
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var feedItem = {
				"Items" :
				[
				]
			};
		feedDaoGetFeedsStub.resolves(feedItem);
		return feedController.addFeed('MOCK_USER_ID', new Date(), 5).should.be.rejectedWith(daoError);
	});
	it('addfeed15()', function() {
		feedDaoCreateFeedStub.resolves();
		var daoError = new DaoError("read the baby", new Error("foo"));
		babyDaoReadBabyStub.rejects(daoError);
		return feedController.addFeed('MOCK_USER_ID', new Date(), 5).should.be.rejectedWith(daoError);
	});
	
	//initfeedData tests
	//Happy path
	it('initfeedData1()', function() {
		feedDaoCreateTableStub.resolves();
		return feedController.initFeedData().should.be.fulfilled;
	});
	
	//DAO Error
	it('initfeedData2()', function() {
		var daoError = new DaoError("create the table", new Error("foo"));
		feedDaoCreateTableStub.rejects(daoError);
		return feedController.initFeedData().should.be.rejectedWith(daoError);
	});
	
	//GetLastFeed Tests
	
	//No baby registered
	it('getLastFeed1()', function() {
		babyDaoReadBabyStub.resolves(); //No baby returned
		feedDaoGetLastFeedStub.resolves();
		return feedController.getLastFeed('MOCK_USER_ID').should.be.rejectedWith(IllegalStateError);
	});
	
	//No feeds
	it('getLastFeed2()', function() {
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var feedItems = {
				"Items" : []
			};
		feedDaoGetLastFeedStub.resolves(feedItems);
		var expectedResponseMsg = "No previous feeding recorded for jane";
		var expectedResponse = new Response(expectedResponseMsg);
		return feedController.getLastFeed('MOCK_USER_ID').should.eventually.deep.equal(expectedResponse);
	});
	
	//Last feed exists
	it('getLastFeed3()', function() {
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		
		var d = new Date();
		d.setHours(d.getHours()-1);
		var feedItems = {
				"Items" :
				[
					{
						"dateTime":d.toISOString(),
						"feedAmount":5 
					}
				]
			};
		feedDaoGetLastFeedStub.resolves(feedItems);
		var expectedResponseMsg = "jane last ate 5 ounces 1 hour ago";
		var expectedResponse = new Response(expectedResponseMsg);
		return feedController.getLastFeed('MOCK_USER_ID').should.eventually.deep.equal(expectedResponse);
	});
	
	//Last feed exists
	it('getLastFeed4()', function() {
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		
		var d = new Date();
		d.setHours(d.getHours()-2);
		d.setMinutes(d.getMinutes()-1);
		var feedItems = {
				"Items" :
				[
					{
						"dateTime":d.toISOString(),
						"feedAmount":5 
					}
				]
			};
		feedDaoGetLastFeedStub.resolves(feedItems);
		var expectedResponseMsg = "jane last ate 5 ounces 2 hours and 1 minute ago";
		var expectedResponse = new Response(expectedResponseMsg);
		return feedController.getLastFeed('MOCK_USER_ID').should.eventually.deep.equal(expectedResponse);
	});
	
	it('getLastFeed4b()', function() {
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		
		var d = new Date();
		d.setHours(d.getHours()-2);
		d.setMinutes(d.getMinutes()-1);
		var feedItems = {
				"Items" :
				[
					{
						"dateTime":d.toISOString(),
						"feedAmount":1 
					}
				]
			};
		feedDaoGetLastFeedStub.resolves(feedItems);
		var expectedResponseMsg = "jane last ate 1 ounce 2 hours and 1 minute ago";
		var expectedResponse = new Response(expectedResponseMsg);
		return feedController.getLastFeed('MOCK_USER_ID').should.eventually.deep.equal(expectedResponse);
	});
	
	it('getLastFeed4c()', function() {
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		
		var d = new Date();
		d.setHours(d.getHours()-2);
		d.setMinutes(d.getMinutes()-1);
		var feedItems = {
				"Items" :
				[
					{
						"dateTime":d.toISOString()
					}
				]
			};
		feedDaoGetLastFeedStub.resolves(feedItems);
		var expectedResponseMsg = "jane last ate 2 hours and 1 minute ago";
		var expectedResponse = new Response(expectedResponseMsg);
		return feedController.getLastFeed('MOCK_USER_ID').should.eventually.deep.equal(expectedResponse);
	});
	
	//Invalid argument
	it('getLastFeed5()', function() {
		babyDaoReadBabyStub.resolves(); //No baby returned
		feedDaoGetLastFeedStub.resolves();
		return feedController.getLastFeed('').should.be.rejectedWith(IllegalArgumentError);
	});
	
	//DAO Error
	it('getLastFeed6()', function() {
		var daoError = new DaoError("get the feeds", new Error("foo"));
		babyDaoReadBabyStub.rejects(daoError);
		feedDaoGetLastFeedStub.resolves();
		return feedController.getLastFeed('MOCK_USER_ID').should.be.rejectedWith(daoError);
	});
	
	//removeLastfeed tests
	//Happy path test 1
	it('removeLastfeed1()', function() {
		feedDaoDeleteFeedStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var feedItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":5
				}
				]
			};
		feedDaoGetLastFeedStub.resolves(feedItem);
		var expectedResponseMsg = "Removed 5 ounce feed for jane.";
		var expectedResponse = new Response(expectedResponseMsg, "Feed", expectedResponseMsg);
		return feedController.removeLastFeed("MOCK_USER_ID")
			.should.eventually.deep.equal(expectedResponse);
	});
	it('removeLastfeed1b()', function() {
		feedDaoDeleteFeedStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var feedItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z"
				}
				]
			};
		feedDaoGetLastFeedStub.resolves(feedItem);
		var expectedResponseMsg = "Removed last feed for jane.";
		var expectedResponse = new Response(expectedResponseMsg, "Feed", expectedResponseMsg);
		return feedController.removeLastFeed("MOCK_USER_ID")
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Illegal argument tests - no user ID
	it('removeLastfeed4()', function() {
		return feedController.removeLastFeed(null, new Date(), true, true).should.be.rejectedWith(IllegalArgumentError);
	});
	it('removeLastfeed5()', function() {
		return feedController.removeLastFeed('').should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal state tests
	it('removeLastfeed6()', function() {
		feedDaoDeleteFeedStub.resolves();
		babyDaoReadBabyStub.resolves(); //No baby returned
		var feedItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":5
				}
				]
			};
		feedDaoGetLastFeedStub.resolves(feedItem);
		return feedController.removeLastFeed('MOCK_USER_ID').should.be.rejectedWith(IllegalStateError);
	});
	//DAO Errors
	it('removeLastfeed7()', function() {
		var daoError = new DaoError("Dao error", new Error("foo"));
		feedDaoDeleteFeedStub.rejects(daoError);
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var feedItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":5
				}
				]
			};
		feedDaoGetLastFeedStub.resolves(feedItem);
		return feedController.removeLastFeed('MOCK_USER_ID').should.be.rejectedWith(daoError);
	});
	
	//No feed entries exist
	it('removeLastfeed8()', function() {
		feedDaoDeleteFeedStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var feedItem = {
				"Items" : []
			};
		feedDaoGetLastFeedStub.resolves(feedItem);
		var expectedResponseMsg = "No previous feed entries recorded for jane";
		var expectedResponse = new Response(expectedResponseMsg, "Feed", expectedResponseMsg);
		return feedController.removeLastFeed("MOCK_USER_ID")
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Test activity limits
	it('addfeed100()', function() {
		feedDaoCreateFeedStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
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
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"feedAmount":6
				}
				]
			};
		feedDaoGetFeedsStub.resolves(feedItem);
		return feedController.addFeed("MOCK_USER_ID", new Date(), 5)
			.should.be.rejectedWith(ActivityLimitError);
	});
});

