/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class unit-tests the SleepController module. It was written with the help
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
var SleepController = require('../../sleep/sleep_controller');
var SleepDao = require('../../sleep/sleep_aws_dao');
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

describe('SleepController', function() {
	var sleepController = new SleepController(new SleepDao(), new BabyDao());
	
	/*
	 * We want to stub out the pieces of code that make writing the tests difficult,
	 * namely the DAO code, since it would require establishing an actual connection,
	 * populating with consistent test data, and somehow figuring out how to get
	 * unlikely error conditions to trigger to fully test all paths.
	 */
	var sleepDaoCreateSleepStub;
	var sleepDaoUpdateSleepStub;
	var sleepDaoCreateTableStub;
	var sleepDaoGetLastSleepStub;
	var sleepDaoDeleteSleepStub;
	var sleepDaoGetSleepCountForDayStub;
	var babyDaoReadBabyStub;
	
	beforeEach(function() {	    	
		sleepDaoCreateSleepStub = sinon.stub(sleepController.sleepDao, 'createSleep');
		sleepDaoCreateTableStub = sinon.stub(sleepController.sleepDao, 'createTable');
		sleepDaoUpdateSleepStub = sinon.stub(sleepController.sleepDao, 'updateSleep');
		sleepDaoGetLastSleepStub = sinon.stub(sleepController.sleepDao, 'getLastSleep');
		sleepDaoDeleteSleepStub = sinon.stub(sleepController.sleepDao, 'deleteSleep');
		sleepDaoGetSleepCountForDayStub = sinon.stub(sleepController.sleepDao, 'getSleepCountForDay');
		babyDaoReadBabyStub = sinon.stub(sleepController.babyDao, 'readBaby');
	});
	
	afterEach(function() {
		sleepController.sleepDao.createSleep.restore();
		sleepController.sleepDao.createTable.restore();
		sleepController.sleepDao.updateSleep.restore();
		sleepController.sleepDao.getLastSleep.restore();
		sleepController.sleepDao.deleteSleep.restore();
		sleepController.sleepDao.getSleepCountForDay.restore();
		sleepController.babyDao.readBaby.restore();
	});
	 
	//startSleep tests
	//Happy path test 1
	it('startSleep1()', function() {
		sleepDaoCreateSleepStub.resolves();
		sleepDaoGetSleepCountForDayStub.resolves(0);
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var expectedResponseMsg = "Recording sleep for jane.";
		var expectedResponse = new Response(expectedResponseMsg, "Started sleep", expectedResponseMsg);
		return sleepController.startSleep("MOCK_USER_ID", new Date()).should.eventually.deep.equal(expectedResponse);
	});
	
	//Illegal argument tests - no user ID
	it('startsleep2()', function() {
		return sleepController.startSleep(null, new Date()).should.be.rejectedWith(IllegalArgumentError);
	});
	it('startsleep3()', function() {
		return sleepController.startSleep('', new Date()).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument tests - no datetime
	it('startsleep4()', function() {
		return sleepController.startSleep("MOCK_USER_ID", null).should.be.rejectedWith(IllegalArgumentError);
	});
	it('startsleep5()', function() {
		return sleepController.startSleep("MOCK_USER_ID", '').should.be.rejectedWith(IllegalArgumentError);
	});
	//Invalid types
	it('startsleep6()', function() {
		sleepDaoCreateSleepStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		return sleepController.startSleep("MOCK_USER_ID", "No Date").should.be.rejectedWith(TypeError);
	});
	//Date in the future
	it('startsleep7()', function() {
		var d = new Date();
		d.setHours(d.getHours()+2);
		return sleepController.startSleep("MOCK_USER_ID", d).should.be.rejectedWith(IllegalArgumentError);
	});
	
	//Illegal state tests
	it('startsleep8()', function() {
		sleepDaoCreateSleepStub.resolves();
		babyDaoReadBabyStub.resolves(); //No baby returned
		return sleepController.startSleep('MOCK_USER_ID', new Date()).should.be.rejectedWith(IllegalStateError);
	});
	
	//DAO Errors
	it('startsleep9()', function() {
		var daoError = new DaoError("create the sleep", new Error("foo"));
		sleepDaoCreateSleepStub.rejects(daoError);
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		return sleepController.startSleep('MOCK_USER_ID', new Date()).should.be.rejectedWith(daoError);
	});
	it('startsleep10()', function() {
		sleepDaoCreateSleepStub.resolves();
		var daoError = new DaoError("read the baby", new Error("foo"));
		babyDaoReadBabyStub.rejects(daoError);
		return sleepController.startSleep('MOCK_USER_ID', new Date()).should.be.rejectedWith(daoError);
	});
	
	//initsleepData tests
	//Happy path
	it('initsleepData1()', function() {
		sleepDaoCreateTableStub.resolves();
		return sleepController.initSleepData().should.be.fulfilled;
	});
	
	//DAO Error
	it('initsleepData2()', function() {
		var daoError = new DaoError("create the table", new Error("foo"));
		sleepDaoCreateTableStub.rejects(daoError);
		return sleepController.initSleepData().should.be.rejectedWith(daoError);
	});
	
	//GetLastSleep Tests
	
	//No baby registered
	it('getAwakeTime1()', function() {
		babyDaoReadBabyStub.resolves(); //No baby returned
		sleepDaoGetLastSleepStub.resolves();
		return sleepController.getAwakeTime('MOCK_USER_ID').should.be.rejectedWith(IllegalStateError);
	});
	
	//No sleeps
	it('getAwakeTime2()', function() {
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var sleepItems = {
				"Items" : []
			};
		sleepDaoGetLastSleepStub.resolves(sleepItems);
		var expectedResponseMsg = "No sleep has been recorded for jane";
		var expectedResponse = new Response(expectedResponseMsg);
		return sleepController.getAwakeTime('MOCK_USER_ID').should.eventually.deep.equal(expectedResponse);
	});
	
	//Last sleep exists, baby is awake
	it('getAwakeTime3()', function() {
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		
		var d = new Date();
		d.setHours(d.getHours()-2);
		var d2 = new Date();
		d2.setHours(d2.getHours()-1);
		var sleepItems = {
				"Items" :
				[
					{
						"sleepDateTime":d.toISOString(),
						"wokeUpDateTime":d2.toISOString() 
					}
				]
			};
		sleepDaoGetLastSleepStub.resolves(sleepItems);
		var expectedResponseMsg = "jane has been awake for 1 hour";
		var expectedResponse = new Response(expectedResponseMsg);
		return sleepController.getAwakeTime('MOCK_USER_ID').should.eventually.deep.equal(expectedResponse);
	});
	
	//Last sleep exists, baby is still sleeping
	it('getAwakeTime4()', function() {
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		baby.timezone = "America/New_York";
		babyDaoReadBabyStub.resolves(baby);
		
		var d = new Date();
		d.setHours(d.getHours()-2);
		var d2 = new Date();
		d2.setHours(d2.getHours()-1);
		var sleepItems = {
				"Items" :
				[
					{
						"sleepDateTime":d.toISOString() 
					}
				]
			};
		sleepDaoGetLastSleepStub.resolves(sleepItems);
		var expectedResponseMsg = "jane is still sleeping";
		var expectedResponse = new Response(expectedResponseMsg);
		return sleepController.getAwakeTime('MOCK_USER_ID').should.eventually.deep.equal(expectedResponse);
	});
	
	//Invalid argument
	it('getAwakeTime5()', function() {
		babyDaoReadBabyStub.resolves(); //No baby returned
		sleepDaoGetLastSleepStub.resolves();
		return sleepController.getAwakeTime('').should.be.rejectedWith(IllegalArgumentError);
	});
	
	//DAO Error
	it('getAwakeTime6()', function() {
		var daoError = new DaoError("get the sleeps", new Error("foo"));
		babyDaoReadBabyStub.rejects(daoError);
		sleepDaoGetLastSleepStub.resolves();
		return sleepController.getAwakeTime('MOCK_USER_ID').should.be.rejectedWith(daoError);
	});
	
	//endsleep tests
	//Illegal argument tests - no user ID
	it('endSleep1()', function() {
		return sleepController.endSleep(null, new Date()).should.be.rejectedWith(IllegalArgumentError);
	});
	it('endSleep2()', function() {
		return sleepController.endSleep('', new Date()).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument tests - no datetime
	it('endSleep3()', function() {
		return sleepController.endSleep("MOCK_USER_ID", null).should.be.rejectedWith(IllegalArgumentError);
	});
	it('endSleep4()', function() {
		return sleepController.endSleep("MOCK_USER_ID", '').should.be.rejectedWith(IllegalArgumentError);
	});
	//Invalid types
	it('endSleep5()', function() {
		sleepDaoUpdateSleepStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		baby.timezone = "America/New_York";
		babyDaoReadBabyStub.resolves(baby);
		return sleepController.endSleep("MOCK_USER_ID", "No Date").should.be.rejectedWith(TypeError);
	});
	//Date in the future
	it('endSleep6()', function() {
		var d = new Date();
		d.setHours(d.getHours()+2);
		return sleepController.endSleep("MOCK_USER_ID", d).should.be.rejectedWith(IllegalArgumentError);
	});
	
	//Illegal state tests
	it('endSleep7()', function() {
		sleepDaoUpdateSleepStub.resolves();
		babyDaoReadBabyStub.resolves(); //No baby returned
		return sleepController.endSleep('MOCK_USER_ID', new Date()).should.be.rejectedWith(IllegalStateError);
	});
	
	//DAO Errors
	it('endSleep8()', function() {
		var daoError = new DaoError("update the sleep", new Error("foo"));
		sleepDaoUpdateSleepStub.rejects(daoError);
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		baby.timezone = "America/New_York";
		babyDaoReadBabyStub.resolves(baby);
		var d = new Date();
		d.setHours(d.getHours()-2);
		var sleepItem = {
				"Items" :
				[
					{
						"sleepKey":"AMZ.MOCK_ID-1",
						"sleepDateTime":d.toISOString()
					}
				]
			};
		sleepDaoGetLastSleepStub.resolves(sleepItem);
		return sleepController.endSleep('MOCK_USER_ID', new Date()).should.be.rejectedWith(daoError);
	});
	
	it('endSleep9()', function() {
		sleepDaoUpdateSleepStub.resolves();
		var d = new Date();
		d.setHours(d.getHours()-2);
		var sleepItem = {
				"Items" :
				[
					{
						"sleepDateTime":d.toISOString()
					}
				]
			};
		sleepDaoGetLastSleepStub.resolves(sleepItem);
		var daoError = new DaoError("read the baby", new Error("foo"));
		babyDaoReadBabyStub.rejects(daoError);
		return sleepController.endSleep('MOCK_USER_ID', new Date()).should.be.rejectedWith(daoError);
	});
	
	//No previous sleep time recorded
	it('endSleep10()', function() {
		sleepDaoUpdateSleepStub.resolves();
		var sleepItem = {
				"Items" :
				[
				]
			};
		sleepDaoGetLastSleepStub.resolves(sleepItem);
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		baby.timezone = "America/New_York";
		babyDaoReadBabyStub.resolves(baby);
		return sleepController.endSleep('MOCK_USER_ID', new Date()).should.be.rejectedWith(IllegalStateError);
	});
	
	//Happy path
	it('endSleep11()', function() {
		sleepDaoUpdateSleepStub.resolves();
		var sleepDate = new Date(2016, 5, 1, 6, 0, 0);
		var sleepItem = {
				"Items" :
				[
					{
						"sleepKey":"AMZ.MOCK_ID-1",
						"sleepDateTime":sleepDate.toISOString()
					}
				]
			};
		sleepDaoGetLastSleepStub.resolves(sleepItem);
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		baby.timezone = "America/New_York";
		babyDaoReadBabyStub.resolves(baby);
		var wakeDate = new Date(2016, 5, 1, 7, 0, 0);
		var expectedResponseMsg = "Recorded 1 hour of sleep from 6 oh clock AM to 7 oh clock AM for jane.";
		var expectedResponse = new Response(expectedResponseMsg, "End Sleep", expectedResponseMsg);
		return sleepController.endSleep('MOCK_USER_ID', wakeDate).should.eventually.deep.equal(expectedResponse);
	});
	
	//removeLastsleep tests
	//Happy path test 1
	it('removeLastsleep1()', function() {
		sleepDaoDeleteSleepStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		baby.timezone = "America/New_York";
		babyDaoReadBabyStub.resolves(baby);
		var sleepItem = {
				"Items" :
				[
				{
					"sleepDateTime":"2016-06-01T00:00:00.000Z"
				}
				]
			};
		sleepDaoGetLastSleepStub.resolves(sleepItem);
		var expectedResponseMsg = "Removed last sleep entry for jane.";
		var expectedResponse = new Response(expectedResponseMsg, "Sleep", expectedResponseMsg);
		return sleepController.removeLastSleep("MOCK_USER_ID")
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Illegal argument tests - no user ID
	it('removeLastsleep4()', function() {
		return sleepController.removeLastSleep(null).should.be.rejectedWith(IllegalArgumentError);
	});
	it('removeLastsleep5()', function() {
		return sleepController.removeLastSleep('').should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal state tests
	it('removeLastsleep6()', function() {
		sleepDaoDeleteSleepStub.resolves();
		babyDaoReadBabyStub.resolves(); //No baby returned
		var sleepItem = {
				"Items" :
				[
				{
					"sleepDateTime":"2016-06-01T00:00:00.000Z"
				}
				]
			};
		sleepDaoGetLastSleepStub.resolves(sleepItem);
		return sleepController.removeLastSleep('MOCK_USER_ID').should.be.rejectedWith(IllegalStateError);
	});
	//DAO Errors
	it('removeLastsleep7()', function() {
		var daoError = new DaoError("Dao error", new Error("foo"));
		sleepDaoDeleteSleepStub.rejects(daoError);
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		baby.timezone = "America/New_York";
		babyDaoReadBabyStub.resolves(baby);
		var sleepItem = {
				"Items" :
				[
				{
					"sleepDateTime":"2016-06-01T00:00:00.000Z"
				}
				]
			};
		sleepDaoGetLastSleepStub.resolves(sleepItem);
		return sleepController.removeLastSleep('MOCK_USER_ID').should.be.rejectedWith(daoError);
	});
	
	//No sleep entries exist
	it('removeLastsleep8()', function() {
		sleepDaoDeleteSleepStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		baby.timezone = "America/New_York";
		babyDaoReadBabyStub.resolves(baby);
		var sleepItem = {
				"Items" : []
			};
		sleepDaoGetLastSleepStub.resolves(sleepItem);
		var expectedResponseMsg = "No previous sleep entries recorded for jane";
		var expectedResponse = new Response(expectedResponseMsg, "Sleep", expectedResponseMsg);
		return sleepController.removeLastSleep("MOCK_USER_ID")
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Activity Limit Tests
	it('startSleep100()', function() {
		sleepDaoCreateSleepStub.resolves();
		sleepDaoGetSleepCountForDayStub.resolves(40);
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		baby.timezone = "America/New_York";
		babyDaoReadBabyStub.resolves(baby);
		return sleepController.startSleep("MOCK_USER_ID", new Date())
			.should.be.rejectedWith(ActivityLimitError);
	});
});

