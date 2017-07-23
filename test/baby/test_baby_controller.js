/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class unit-tests the BabyController module. It was written with the help
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
var Baby = require('../../baby/baby');
var BabyController = require('../../baby/baby_controller');
var BabyDao = require('../../baby/baby_aws_dao');
var Response = require('../../common/response');
var BabyDao = require('../../baby/baby_aws_dao');
var FeedDao = require('../../feed/feed_aws_dao');
var WeightDao = require('../../weight/weight_aws_dao');
var DiaperDao = require('../../diaper/diaper_aws_dao');
var ActivityDao = require('../../activity/activity_aws_dao');
var SleepDao = require('../../sleep/sleep_aws_dao');
var WordDao = require('../../word/word_aws_dao');
var IllegalArgumentError = require('../../common/illegal_argument_error');
var IllegalStateError = require('../../common/illegal_state_error');
var ActivityLimitError = require('../../common/activity_limit_error');
var DaoError = require('../../common/dao_error');
var sinon = require('sinon');
var sinonAsPromised = require('sinon-as-promised');
var Promise = require('bluebird');

chai.use(chaiAsPromised);
chai.should();

describe('BabyController', function() {
	var babyController = new BabyController(new BabyDao(), new FeedDao(), 
			new WeightDao(), new DiaperDao(), new ActivityDao(), new SleepDao(), new WordDao());
	var addedDateTime = new Date();
	
	/*
	 * We want to stub out the pieces of code that make writing the tests difficult,
	 * namely the DAO code, since it would require establishing an actual connection,
	 * populating with consistent test data, and somehow figuring out how to get
	 * unlikely error conditions to trigger to fully test all paths.
	 */
	var babyDaoCreateTableStub;
	var babyDaoCreateBabyStub;
	var babyDaoGetBabyCountStub;
	
	//When we need a mock birthdate
	var birthdate = new Date();
	birthdate.setDate(birthdate.getDate()-1);
	
	beforeEach(function() {	    	
		babyDaoCreateTableStub = sinon.stub(babyController.babyDao, 'createTable');
		babyDaoCreateBabyStub = sinon.stub(babyController.babyDao, 'createBaby');
		babyDaoGetBabyCountStub = sinon.stub(babyController.babyDao, 'getBabyCount');
	});
	
	afterEach(function() {
		babyController.babyDao.createTable.restore();
		babyController.babyDao.createBaby.restore();
		babyController.babyDao.getBabyCount.restore();
	});
	
	//addBaby tests
	//Happy path test 1
	it('addBaby1()', function() {
		babyDaoCreateBabyStub.resolves();
		babyDaoGetBabyCountStub.resolves({count: 0, maxSeq: 0});
		var expectedResponseMsg = "Added baby girl jane. You can now begin adding her feeds, diapers, activities, sleep, and weight.";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		return babyController.addBaby("MOCK_USER_ID", "girl", "jane", birthdate, "eastern", true)
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Happy path test 2
	it('addBaby2()', function() {
		babyDaoCreateBabyStub.resolves();
		babyDaoGetBabyCountStub.resolves({count: 0, maxSeq: 0});
		var expectedResponseMsg = "Added baby boy john. You can now begin adding his feeds, diapers, activities, sleep, and weight.";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		return babyController.addBaby("MOCK_USER_ID", "boy", "john", birthdate, "eastern", true)
			.should.eventually.deep.equal(expectedResponse);
	});	
	
	//Happy path test 3 - no birthdate
	it('addBaby2b()', function() {
		babyDaoCreateBabyStub.resolves();
		babyDaoGetBabyCountStub.resolves({count: 0, maxSeq: 0});
		var expectedResponseMsg = "Added baby boy john. You can now begin adding his feeds, diapers, activities, sleep, and weight.";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		return babyController.addBaby("MOCK_USER_ID", "boy", "john", null, "eastern", true)
			.should.eventually.deep.equal(expectedResponse);
	});	
	
	//Illegal argument - no user id
	it('addBaby3()', function() {
		return babyController.addBaby(null, "boy", "john", birthdate, "eastern", true).should.be.rejectedWith(IllegalArgumentError);
	});
	it('addBaby4()', function() {
		return babyController.addBaby("", "boy", "john", birthdate, "eastern", true).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument - no sex
	it('addBaby5()', function() {
		return babyController.addBaby("MOCK_USER_ID", null, "john", birthdate, "eastern", true).should.be.rejectedWith(IllegalArgumentError);
	});
	it('addBaby6()', function() {
		return babyController.addBaby("MOCK_USER_ID", "", "john", birthdate, "eastern", true).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument - invalid sex
	it('addBaby7()', function() {
		return babyController.addBaby("MOCK_USER_ID", "unknown", "john", birthdate, "eastern", true).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument - birthdate in future
	it('addBaby9()', function() {
		var birthdate2 = new Date();
		birthdate2.setDate(birthdate.getDate()+5);
		return babyController.addBaby("MOCK_USER_ID", "boy", "john", birthdate2, "eastern", true).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument - no name
	it('addBaby10()', function() {
		return babyController.addBaby("MOCK_USER_ID", "boy", null, birthdate, "eastern", true).should.be.rejectedWith(IllegalArgumentError);
	});
	it('addBaby11()', function() {
		return babyController.addBaby("MOCK_USER_ID", "boy", "", birthdate, "eastern", true).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument - birthdate is not a date
	it('addBaby12()', function() {
		return babyController.addBaby("MOCK_USER_ID", "boy", "john", "notadate", "eastern", true).should.be.rejectedWith(TypeError);
	});
	//Illegal argument - no timezone
	it('addBaby12b()', function() {
		return babyController.addBaby("MOCK_USER_ID", "boy", "john", birthdate, "", true).should.be.rejectedWith(IllegalArgumentError);
	});
	//DAO Error
	it('addBaby13()', function() {
		babyDaoGetBabyCountStub.resolves({count: 0, maxSeq: 0});
		var daoError = new DaoError("create the baby", new Error("foo"));
		babyDaoCreateBabyStub.rejects(daoError);
		return babyController.addBaby("MOCK_USER_ID", "boy", "john", birthdate, "eastern", true).should.be.rejectedWith(daoError);
	});
	
	//Timezone test 1
	it('addBaby14()', function() {
		babyDaoCreateBabyStub.resolves();
		babyDaoGetBabyCountStub.resolves({count: 0, maxSeq: 0});
		var expectedResponseMsg = "Added baby girl jane. She is 1 day old";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		
		var expectedBaby = new Baby();
		expectedBaby.name = "jane";
		expectedBaby.userId = "MOCK_USER_ID";
		expectedBaby.sex = "girl";
		expectedBaby.birthdate = birthdate;
		expectedBaby.timezone = "America/New_York";
		expectedBaby.addedDateTime = addedDateTime;
		expectedBaby.seq = 1;
		return babyController.addBaby("MOCK_USER_ID", "girl", "jane", birthdate, "eastern", true, addedDateTime).then(function () {
			sinon.assert.calledWith(babyDaoCreateBabyStub, expectedBaby);
		});
	});
	it('addBaby15()', function() {
		babyDaoCreateBabyStub.resolves();
		babyDaoGetBabyCountStub.resolves({count: 0, maxSeq: 0});
		var expectedResponseMsg = "Added baby girl jane. She is 1 day old";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		
		var expectedBaby = new Baby();
		expectedBaby.name = "jane";
		expectedBaby.userId = "MOCK_USER_ID";
		expectedBaby.sex = "girl";
		expectedBaby.birthdate = birthdate;
		expectedBaby.timezone = "America/Chicago";
		expectedBaby.addedDateTime = addedDateTime;
		expectedBaby.seq = 1;
		
		return babyController.addBaby("MOCK_USER_ID", "girl", "jane", birthdate, "central", true, addedDateTime).then(function () {
			sinon.assert.calledWith(babyDaoCreateBabyStub, expectedBaby);
		});
	});
	it('addBaby16()', function() {
		babyDaoCreateBabyStub.resolves();
		babyDaoGetBabyCountStub.resolves({count: 0, maxSeq: 0});
		var expectedResponseMsg = "Added baby girl jane. She is 1 day old";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		
		var expectedBaby = new Baby();
		expectedBaby.name = "jane";
		expectedBaby.userId = "MOCK_USER_ID";
		expectedBaby.sex = "girl";
		expectedBaby.birthdate = birthdate;
		expectedBaby.timezone = "America/Puerto_Rico";
		expectedBaby.addedDateTime = addedDateTime;
		expectedBaby.seq = 1;
		
		return babyController.addBaby("MOCK_USER_ID", "girl", "jane", birthdate, "atlantic", true, addedDateTime).then(function () {
			sinon.assert.calledWith(babyDaoCreateBabyStub, expectedBaby);
		});
	});
	it('addBaby16()', function() {
		babyDaoCreateBabyStub.resolves();
		babyDaoGetBabyCountStub.resolves({count: 0, maxSeq: 0});
		var expectedResponseMsg = "Added baby girl jane. She is 1 day old";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		
		var expectedBaby = new Baby();
		expectedBaby.name = "jane";
		expectedBaby.userId = "MOCK_USER_ID";
		expectedBaby.sex = "girl";
		expectedBaby.birthdate = birthdate;
		expectedBaby.timezone = "America/Denver";
		expectedBaby.addedDateTime = addedDateTime;
		expectedBaby.seq = 1;
		
		return babyController.addBaby("MOCK_USER_ID", "girl", "jane", birthdate, "mountain", true, addedDateTime).then(function () {
			sinon.assert.calledWith(babyDaoCreateBabyStub, expectedBaby);
		});
	});
	it('addBaby17()', function() {
		babyDaoCreateBabyStub.resolves();
		babyDaoGetBabyCountStub.resolves({count: 0, maxSeq: 0});
		var expectedResponseMsg = "Added baby girl jane. She is 1 day old";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		
		var expectedBaby = new Baby();
		expectedBaby.name = "jane";
		expectedBaby.userId = "MOCK_USER_ID";
		expectedBaby.sex = "girl";
		expectedBaby.birthdate = birthdate;
		expectedBaby.timezone = "America/Phoenix";
		expectedBaby.addedDateTime = addedDateTime;
		expectedBaby.seq = 1;
		
		return babyController.addBaby("MOCK_USER_ID", "girl", "jane", birthdate, "mountain", false, addedDateTime).then(function () {
			sinon.assert.calledWith(babyDaoCreateBabyStub, expectedBaby);
		});
	});
	it('addBaby18()', function() {
		babyDaoCreateBabyStub.resolves();
		babyDaoGetBabyCountStub.resolves({count: 0, maxSeq: 0});
		var expectedResponseMsg = "Added baby girl jane. She is 1 day old";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		
		var expectedBaby = new Baby();
		expectedBaby.name = "jane";
		expectedBaby.userId = "MOCK_USER_ID";
		expectedBaby.sex = "girl";
		expectedBaby.birthdate = birthdate;
		expectedBaby.timezone = "America/Los_Angeles";
		expectedBaby.addedDateTime = addedDateTime;
		expectedBaby.seq = 1;
		
		return babyController.addBaby("MOCK_USER_ID", "girl", "jane", birthdate, "pacific", true, addedDateTime).then(function () {
			sinon.assert.calledWith(babyDaoCreateBabyStub, expectedBaby);
		});
	});
	it('addBaby19()', function() {
		babyDaoCreateBabyStub.resolves();
		babyDaoGetBabyCountStub.resolves({count: 0, maxSeq: 0});
		var expectedResponseMsg = "Added baby girl jane. She is 1 day old";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		
		var expectedBaby = new Baby();
		expectedBaby.name = "jane";
		expectedBaby.userId = "MOCK_USER_ID";
		expectedBaby.sex = "girl";
		expectedBaby.birthdate = birthdate;
		expectedBaby.timezone = "America/Juneau";
		expectedBaby.addedDateTime = addedDateTime;
		expectedBaby.seq = 1;
		
		return babyController.addBaby("MOCK_USER_ID", "girl", "jane", birthdate, "alaska", true, addedDateTime).then(function () {
			sinon.assert.calledWith(babyDaoCreateBabyStub, expectedBaby);
		});
	});
	it('addBaby20()', function() {
		babyDaoCreateBabyStub.resolves();
		babyDaoGetBabyCountStub.resolves({count: 0, maxSeq: 0});
		var expectedResponseMsg = "Added baby girl jane. She is 1 day old";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		
		var expectedBaby = new Baby();
		expectedBaby.name = "jane";
		expectedBaby.userId = "MOCK_USER_ID";
		expectedBaby.sex = "girl";
		expectedBaby.birthdate = birthdate;
		expectedBaby.timezone = "Pacific/Honolulu";
		expectedBaby.addedDateTime = addedDateTime;
		expectedBaby.seq = 1;
		
		return babyController.addBaby("MOCK_USER_ID", "girl", "jane", birthdate, "hawaii", true, addedDateTime).then(function () {
			sinon.assert.calledWith(babyDaoCreateBabyStub, expectedBaby);
		});
	});
	it('addBaby21()', function() {
		babyDaoCreateBabyStub.resolves();
		babyDaoGetBabyCountStub.resolves({count: 0, maxSeq: 0});
		var expectedResponseMsg = "Added baby girl jane. She is 1 day old";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		
		var expectedBaby = new Baby();
		expectedBaby.name = "jane";
		expectedBaby.userId = "MOCK_USER_ID";
		expectedBaby.sex = "girl";
		expectedBaby.birthdate = birthdate;
		expectedBaby.timezone = "Pacific/Samoa";
		expectedBaby.addedDateTime = addedDateTime;
		expectedBaby.seq = 1;
		
		return babyController.addBaby("MOCK_USER_ID", "girl", "jane", birthdate, "samoa", true, addedDateTime).then(function () {
			sinon.assert.calledWith(babyDaoCreateBabyStub, expectedBaby);
		});
	});
	it('addBaby22()', function() {
		babyDaoCreateBabyStub.resolves();
		babyDaoGetBabyCountStub.resolves({count: 0, maxSeq: 0});
		var expectedResponseMsg = "Added baby girl jane. She is 1 day old";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		
		var expectedBaby = new Baby();
		expectedBaby.name = "jane";
		expectedBaby.userId = "MOCK_USER_ID";
		expectedBaby.sex = "girl";
		expectedBaby.birthdate = birthdate;
		expectedBaby.timezone = "Pacific/Guam";
		expectedBaby.addedDateTime = addedDateTime;
		expectedBaby.seq = 1;
		
		return babyController.addBaby("MOCK_USER_ID", "girl", "jane", birthdate, "chamorro", true, addedDateTime).then(function () {
			sinon.assert.calledWith(babyDaoCreateBabyStub, expectedBaby);
		});
	});
	
	//initActivityData tests
	//Happy path
	it('initBabyData1()', function() {
		babyDaoCreateTableStub.resolves();
		return babyController.initBabyData().should.be.fulfilled;
	});
	
	//DAO Error
	it('initBabyData1()', function() {
		var daoError = new DaoError("create the table", new Error("foo"));
		babyDaoCreateTableStub.rejects(daoError);
		return babyController.initBabyData().should.be.rejectedWith(daoError);
	});
	
	//ADD Limits
	it('addBaby100()', function() {
		babyDaoCreateBabyStub.resolves();
		babyDaoGetBabyCountStub.resolves({count: 20});
		var expectedResponseMsg = "Added baby girl jane. She is 1 day old";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		return babyController.addBaby("MOCK_USER_ID", "girl", "jane", birthdate, "eastern", true)
			.should.be.rejectedWith(ActivityLimitError);
	});
});

