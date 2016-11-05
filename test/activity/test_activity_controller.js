/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class unit-tests the ActivityController module. It was written with the help
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
var ActivityController = require('../../activity/activity_controller');
var ActivityDao = require('../../activity/activity_aws_dao');
var Response = require('../../common/response');
var BabyDao = require('../../baby/baby_aws_dao');
var IllegalArgumentError = require('../../common/illegal_argument_error');
var IllegalStateError = require('../../common/illegal_state_error');
var DaoError = require('../../common/dao_error');
var sinon = require('sinon');
var sinonAsPromised = require('sinon-as-promised');
var Promise = require('bluebird');

chai.use(chaiAsPromised);
chai.should();

describe('ActivityController', function() {
	var activityController = new ActivityController();
	
	/*
	 * We want to stub out the pieces of code that make writing the tests difficult,
	 * namely the DAO code, since it would require establishing an actual connection,
	 * populating with consistent test data, and somehow figuring out how to get
	 * unlikely error conditions to trigger to fully test all paths.
	 */
	var activityDaoCreateActivityStub;
	var activityDaoCreateTableStub;
	var activityDaoDeleteActivityStub;
	var activityDaoGetLastActivityStub;
	var babyDaoReadBabyStub;
	
	beforeEach(function() {	    	
		activityDaoCreateActivityStub = sinon.stub(activityController.activityDao, 'createActivity');
		activityDaoCreateTableStub = sinon.stub(activityController.activityDao, 'createTable');
		activityDaoDeleteActivityStub = sinon.stub(activityController.activityDao, 'deleteActivity');
		activityDaoGetLastActivityStub = sinon.stub(activityController.activityDao, 'getLastActivity');
		babyDaoReadBabyStub = sinon.stub(activityController.babyDao, 'readBaby');
	});
	
	afterEach(function() {
		activityController.activityDao.createActivity.restore();
		activityController.activityDao.createTable.restore();
		activityController.activityDao.getLastActivity.restore();
		activityController.activityDao.deleteActivity.restore();
		activityController.babyDao.readBaby.restore();
	});
	 
	//addActivity tests
	//Happy path test 1
	it('addActivity1()', function() {
		activityDaoCreateActivityStub.resolves();
		var item = {
			"Item" :
			{
				"birthdate":"2016-06-01T00:00:00.000Z",
				"sex":"girl",
				"userId":"MOCK_USER_ID",
				"name":"jane"  
			}
		};
		babyDaoReadBabyStub.resolves(item);
		var expectedResponseMsg = "Added activity unit testing for jane";
		var expectedResponse = new Response(expectedResponseMsg, "Activity", expectedResponseMsg);
		return activityController.addActivity("MOCK_USER_ID", "unit testing", new Date())
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Happy path test 2 - no date
	it('addActivity2()', function() {
		activityDaoCreateActivityStub.resolves();
		var item = {
			"Item" :
			{
				"birthdate":"2016-06-01T00:00:00.000Z",
				"sex":"girl",
				"userId":"MOCK_USER_ID",
				"name":"jane"  
			}
		};
		babyDaoReadBabyStub.resolves(item);
		var expectedResponseMsg = "Added activity unit testing for jane";
		var expectedResponse = new Response(expectedResponseMsg, "Activity", expectedResponseMsg);
		return activityController.addActivity("MOCK_USER_ID", "unit testing")
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Illegal argument tests
	it('addActivity3()', function() {
		return activityController.addActivity(null, "unit testing").should.be.rejectedWith(IllegalArgumentError);
	});
	it('addActivity4()', function() {
		return activityController.addActivity('', "unit testing").should.be.rejectedWith(IllegalArgumentError);
	});
	it('addActivity5()', function() {
		return activityController.addActivity('MOCK_USER_ID', "", new Date()).should.be.rejectedWith(IllegalArgumentError);
	});
	it('addActivity6()', function() {
		return activityController.addActivity('MOCK_USER_ID', null, new Date()).should.be.rejectedWith(IllegalArgumentError);
	});
	
	//Illegal state tests
	it('addActivity7()', function() {
		activityDaoCreateActivityStub.resolves();
		babyDaoReadBabyStub.resolves(); //No baby returned
		return activityController.addActivity('MOCK_USER_ID', 'unit testing', new Date()).should.be.rejectedWith(IllegalStateError);
	});
	
	//DAO Errors
	it('addActivity7()', function() {
		var daoError = new DaoError("create the activity table", new Error("foo"));
		activityDaoCreateActivityStub.rejects(daoError);
		var item = {
				"Item" :
				{
					"birthdate":"2016-06-01T00:00:00.000Z",
					"sex":"girl",
					"userId":"MOCK_USER_ID",
					"name":"jane"  
				}
			};
		babyDaoReadBabyStub.resolves(item);
		return activityController.addActivity('MOCK_USER_ID', 'unit testing', new Date()).should.be.rejectedWith(daoError);
	});
	it('addActivity8()', function() {
		activityDaoCreateActivityStub.resolves();
		var daoError = new DaoError("read the baby", new Error("foo"));
		babyDaoReadBabyStub.rejects(daoError);
		return activityController.addActivity('MOCK_USER_ID', 'unit testing', new Date()).should.be.rejectedWith(daoError);
	});
	
	//initActivityData tests
	//Happy path
	it('initActivityData1()', function() {
		activityDaoCreateTableStub.resolves();
		return activityController.initActivityData().should.be.fulfilled;
	});
	
	//DAO Error
	it('initActivityData2()', function() {
		var daoError = new DaoError("create the table", new Error("foo"));
		activityDaoCreateTableStub.rejects(daoError);
		return activityController.initActivityData().should.be.rejectedWith(daoError);
	});
	
	//removeLastactivity tests
	//Happy path test 1
	it('removeLastactivity1()', function() {
		activityDaoDeleteActivityStub.resolves();
		var item = {
			"Item" :
			{
				"birthdate":"2016-06-01T00:00:00.000Z",
				"sex":"girl",
				"userId":"MOCK_USER_ID",
				"name":"jane"  
			}
		};
		babyDaoReadBabyStub.resolves(item);
		var activityItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"activity":"reading"
				}
				]
			};
		activityDaoGetLastActivityStub.resolves(activityItem);
		var expectedResponseMsg = "Removed activity reading for jane.";
		var expectedResponse = new Response(expectedResponseMsg, "Activity", expectedResponseMsg);
		return activityController.removeLastActivity("MOCK_USER_ID")
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Illegal argument tests - no user ID
	it('removeLastactivity4()', function() {
		return activityController.removeLastActivity(null, new Date(), true, true).should.be.rejectedWith(IllegalArgumentError);
	});
	it('removeLastactivity5()', function() {
		return activityController.removeLastActivity('').should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal state tests
	it('removeLastactivity6()', function() {
		activityDaoDeleteActivityStub.resolves();
		babyDaoReadBabyStub.resolves(); //No baby returned
		var activityItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"activity":"reading"
				}
				]
			};
		activityDaoGetLastActivityStub.resolves(activityItem);
		return activityController.removeLastActivity('MOCK_USER_ID').should.be.rejectedWith(IllegalStateError);
	});
	//DAO Errors
	it('removeLastactivity7()', function() {
		var daoError = new DaoError("Dao error", new Error("foo"));
		activityDaoDeleteActivityStub.rejects(daoError);
		var item = {
				"Item" :
				{
					"birthdate":"2016-06-01T00:00:00.000Z",
					"sex":"girl",
					"userId":"MOCK_USER_ID",
					"name":"jane"  
				}
			};
		babyDaoReadBabyStub.resolves(item);
		var activityItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"activity":"reading"
				}
				]
			};
		activityDaoGetLastActivityStub.resolves(activityItem);
		return activityController.removeLastActivity('MOCK_USER_ID').should.be.rejectedWith(daoError);
	});
	
	//No activity entries exist
	it('removeLastactivity8()', function() {
		activityDaoDeleteActivityStub.resolves();
		var item = {
			"Item" :
			{
				"birthdate":"2016-06-01T00:00:00.000Z",
				"sex":"girl",
				"userId":"MOCK_USER_ID",
				"name":"jane"  
			}
		};
		babyDaoReadBabyStub.resolves(item);
		var activityItem = {
				"Items" : []
			};
		activityDaoGetLastActivityStub.resolves(activityItem);
		var expectedResponseMsg = "No previous activity entries recorded for jane";
		var expectedResponse = new Response(expectedResponseMsg, "Activity", expectedResponseMsg);
		return activityController.removeLastActivity("MOCK_USER_ID")
			.should.eventually.deep.equal(expectedResponse);
	});
});

