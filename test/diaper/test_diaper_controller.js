/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class unit-tests the DiaperController module. It was written with the help
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
var DiaperController = require('../../diaper/diaper_controller');
var DiaperDao = require('../../diaper/diaper_aws_dao');
var Response = require('../../common/response');
var Baby = require('../../baby/baby');
var BabyDao = require('../../baby/baby_aws_dao');
var IllegalArgumentError = require('../../common/illegal_argument_error');
var IllegalStateError = require('../../common/illegal_state_error');
var ActivityLimitError = require('../../common/activity_limit_error');
var DaoError = require('../../common/dao_error');
var sinon = require('sinon');
var sinonAsPromised = require('sinon-as-promised');
var Promise = require('bluebird');

chai.use(chaiAsPromised);
chai.should();

describe('DiaperController', function() {
	var diaperController = new DiaperController();
	
	/*
	 * We want to stub out the pieces of code that make writing the tests difficult,
	 * namely the DAO code, since it would require establishing an actual connection,
	 * populating with consistent test data, and somehow figuring out how to get
	 * unlikely error conditions to trigger to fully test all paths.
	 */
	var diaperDaoCreateDiaperStub;
	var diaperDaoCreateTableStub;
	var diaperDaoGetDiapersStub;
	var diaperDaoDeleteDiaperStub;
	var diaperDaoGetLastDiaperStub;
	var babyDaoReadBabyStub;
	
	beforeEach(function() {	    	
		diaperDaoCreateDiaperStub = sinon.stub(diaperController.diaperDao, 'createDiaper');
		diaperDaoCreateTableStub = sinon.stub(diaperController.diaperDao, 'createTable');
		diaperDaoGetDiapersStub = sinon.stub(diaperController.diaperDao, 'getDiapers');
		diaperDaoDeleteDiaperStub = sinon.stub(diaperController.diaperDao, 'deleteDiaper');
		diaperDaoGetLastDiaperStub = sinon.stub(diaperController.diaperDao, 'getLastDiaper');
		babyDaoReadBabyStub = sinon.stub(diaperController.babyDao, 'readBaby');
	});
	
	afterEach(function() {
		diaperController.diaperDao.createDiaper.restore();
		diaperController.diaperDao.createTable.restore();
		diaperController.diaperDao.getDiapers.restore();
		diaperController.diaperDao.getLastDiaper.restore();
		diaperController.diaperDao.deleteDiaper.restore();
		diaperController.babyDao.readBaby.restore();
	});
	 
	//adddiaper tests
	//Happy path test 1
	it('adddiaper1()', function() {
		diaperDaoCreateDiaperStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var diaperItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":false
				}
				]
			};
		diaperDaoGetDiapersStub.resolves(diaperItem);
		var expectedResponseMsg = "Added wet and dirty diaper for jane. Today, she's had 2 wet and 1 dirty diaper";
		var expectedResponse = new Response(expectedResponseMsg, "Diaper", expectedResponseMsg);
		return diaperController.addDiaper("MOCK_USER_ID", new Date(), true, true)
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Happy path test 1
	it('adddiaper2()', function() {
		diaperDaoCreateDiaperStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var diaperItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				}
				]
			};
		diaperDaoGetDiapersStub.resolves(diaperItem);
		var expectedResponseMsg = "Added dirty diaper for jane. Today, she's had 2 wet and 3 dirty diapers";
		var expectedResponse = new Response(expectedResponseMsg, "Diaper", expectedResponseMsg);
		return diaperController.addDiaper("MOCK_USER_ID", new Date(), false, true)
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Illegal argument tests - no user ID
	it('adddiaper3()', function() {
		return diaperController.addDiaper(null, new Date(), true, true).should.be.rejectedWith(IllegalArgumentError);
	});
	it('adddiaper4()', function() {
		return diaperController.addDiaper('', new Date(), true, true).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument tests - no datetime
	it('adddiaper5()', function() {
		return diaperController.addDiaper("MOCK_USER_ID", null, true, true).should.be.rejectedWith(IllegalArgumentError);
	});
	it('adddiaper6()', function() {
		return diaperController.addDiaper("MOCK_USER_ID", '', true, true).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument tests - isWet/isDry not there
	it('adddiaper7()', function() {
		return diaperController.addDiaper("MOCK_USER_ID", new Date()).should.be.rejectedWith(IllegalArgumentError);
	});
	it('adddiaper8()', function() {
		return diaperController.addDiaper("MOCK_USER_ID", new Date(), null, true).should.be.rejectedWith(IllegalArgumentError);
	});
	it('adddiaper9()', function() {
		return diaperController.addDiaper("MOCK_USER_ID", new Date(), true, null).should.be.rejectedWith(IllegalArgumentError);
	});
	//Invalid types
	it('adddiaper10()', function() {
		diaperDaoCreateDiaperStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var diaperItem = {
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
		diaperDaoGetDiapersStub.resolves(diaperItem);
		return diaperController.addDiaper("MOCK_USER_ID", "No Date", true, true).should.be.rejectedWith(TypeError);
	});
	it('adddiaper11()', function() {
		diaperDaoCreateDiaperStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var diaperItem = {
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
		diaperDaoGetDiapersStub.resolves(diaperItem);
		return diaperController.addDiaper("MOCK_USER_ID", new Date(), "not a diaper", true).should.be.rejectedWith(TypeError);
	});
	//Illegal state tests
	it('adddiaper12()', function() {
		diaperDaoCreateDiaperStub.resolves();
		var diaperItem = {
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
		diaperDaoGetDiapersStub.resolves(diaperItem);
		babyDaoReadBabyStub.resolves(); //No baby returned
		return diaperController.addDiaper('MOCK_USER_ID', new Date(), true, true).should.be.rejectedWith(IllegalStateError);
	});
	//DAO Errors
	it('adddiaper12b()', function() {
		var daoError = new DaoError("create the diaper table", new Error("foo"));
		diaperDaoCreateDiaperStub.rejects(daoError);
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var diaperItem = {
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
		diaperDaoGetDiapersStub.resolves(diaperItem);
		return diaperController.addDiaper('MOCK_USER_ID', new Date(), true, true).should.be.rejectedWith(daoError);
	});
	it('adddiaper13()', function() {
		diaperDaoCreateDiaperStub.resolves();
		var daoError = new DaoError("read the baby", new Error("foo"));
		babyDaoReadBabyStub.rejects(daoError);
		return diaperController.addDiaper('MOCK_USER_ID', new Date(), true, true).should.be.rejectedWith(daoError);
	});
	
	//initdiaperData tests
	//Happy path
	it('initdiaperData1()', function() {
		diaperDaoCreateTableStub.resolves();
		return diaperController.initDiaperData().should.be.fulfilled;
	});
	
	//DAO Error
	it('initdiaperData2()', function() {
		var daoError = new DaoError("create the table", new Error("foo"));
		diaperDaoCreateTableStub.rejects(daoError);
		return diaperController.initDiaperData().should.be.rejectedWith(daoError);
	});
	
	//removeLastdiaper tests
	//Happy path test 1
	it('removeLastdiaper1()', function() {
		diaperDaoDeleteDiaperStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var diaperItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":false
				}
				]
			};
		diaperDaoGetLastDiaperStub.resolves(diaperItem);
		var expectedResponseMsg = "Removed wet diaper for jane.";
		var expectedResponse = new Response(expectedResponseMsg, "Diaper", expectedResponseMsg);
		return diaperController.removeLastDiaper("MOCK_USER_ID")
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Happy path test 2
	it('removeLastdiaper2()', function() {
		diaperDaoDeleteDiaperStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var diaperItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				}
				]
			};
		diaperDaoGetLastDiaperStub.resolves(diaperItem);
		var expectedResponseMsg = "Removed wet and dirty diaper for jane.";
		var expectedResponse = new Response(expectedResponseMsg, "Diaper", expectedResponseMsg);
		return diaperController.removeLastDiaper("MOCK_USER_ID")
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Happy path test 2
	it('removeLastdiaper3()', function() {
		diaperDaoDeleteDiaperStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var diaperItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":false,
					"isDirty":true
				}
				]
			};
		diaperDaoGetLastDiaperStub.resolves(diaperItem);
		var expectedResponseMsg = "Removed dirty diaper for jane.";
		var expectedResponse = new Response(expectedResponseMsg, "Diaper", expectedResponseMsg);
		return diaperController.removeLastDiaper("MOCK_USER_ID")
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Illegal argument tests - no user ID
	it('removeLastdiaper4()', function() {
		return diaperController.removeLastDiaper(null, new Date(), true, true).should.be.rejectedWith(IllegalArgumentError);
	});
	it('removeLastdiaper5()', function() {
		return diaperController.removeLastDiaper('').should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal state tests
	it('removeLastdiaper6()', function() {
		diaperDaoDeleteDiaperStub.resolves();
		babyDaoReadBabyStub.resolves(); //No baby returned
		var diaperItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":false,
					"isDirty":true
				}
				]
			};
		diaperDaoGetLastDiaperStub.resolves(diaperItem);
		return diaperController.removeLastDiaper('MOCK_USER_ID').should.be.rejectedWith(IllegalStateError);
	});
	//DAO Errors
	it('removeLastdiaper7()', function() {
		var daoError = new DaoError("Dao error", new Error("foo"));
		diaperDaoDeleteDiaperStub.rejects(daoError);
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var diaperItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":false,
					"isDirty":true
				}
				]
			};
		diaperDaoGetLastDiaperStub.resolves(diaperItem);
		return diaperController.removeLastDiaper('MOCK_USER_ID').should.be.rejectedWith(daoError);
	});
	
	//No diaper entries exist
	it('removeLastdiaper8()', function() {
		diaperDaoDeleteDiaperStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var diaperItem = {
				"Items" : []
			};
		diaperDaoGetLastDiaperStub.resolves(diaperItem);
		var expectedResponseMsg = "No previous diaper entries recorded for jane";
		var expectedResponse = new Response(expectedResponseMsg, "Diaper", expectedResponseMsg);
		return diaperController.removeLastDiaper("MOCK_USER_ID")
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Test activity limits - user has 40 diapers already
	it('adddiaper100()', function() {
		diaperDaoCreateDiaperStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		var diaperItem = {
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
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				},
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"isWet":true,
					"isDirty":true
				}
				]
			};
		diaperDaoGetDiapersStub.resolves(diaperItem);
		return diaperController.addDiaper("MOCK_USER_ID", new Date(), true, true)
			.should.be.rejectedWith(ActivityLimitError);
	});
});

