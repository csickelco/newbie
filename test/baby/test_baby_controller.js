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
var BabyController = require('../../baby/baby_controller');
var BabyDao = require('../../baby/baby_aws_dao');
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

describe('BabyController', function() {
	var babyController = new BabyController();
	
	/*
	 * We want to stub out the pieces of code that make writing the tests difficult,
	 * namely the DAO code, since it would require establishing an actual connection,
	 * populating with consistent test data, and somehow figuring out how to get
	 * unlikely error conditions to trigger to fully test all paths.
	 */
	var babyDaoCreateTableStub;
	var babyDaoCreateBabyStub;
	
	//When we need a mock birthdate
	var birthdate = new Date();
	birthdate.setDate(birthdate.getDate()-1);
	
	beforeEach(function() {	    	
		babyDaoCreateTableStub = sinon.stub(babyController.babyDao, 'createTable');
		babyDaoCreateBabyStub = sinon.stub(babyController.babyDao, 'createBaby');
	});
	
	afterEach(function() {
		babyController.babyDao.createTable.restore();
		babyController.babyDao.createBaby.restore();
	});
	
	//addBaby tests
	//Happy path test 1
	it('addBaby1()', function() {
		babyDaoCreateBabyStub.resolves();
		var expectedResponseMsg = "Added baby girl jane. She is 1 day old";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		return babyController.addBaby("MOCK_USER_ID", "girl", "jane", birthdate)
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Happy path test 2
	it('addBaby2()', function() {
		babyDaoCreateBabyStub.resolves();
		var expectedResponseMsg = "Added baby boy john. He is 1 day old";
		var expectedResponse = new Response(expectedResponseMsg, "Added Baby", expectedResponseMsg);
		return babyController.addBaby("MOCK_USER_ID", "boy", "john", birthdate)
			.should.eventually.deep.equal(expectedResponse);
	});	
	
	//Illegal argument - no user id
	it('addBaby3()', function() {
		return babyController.addBaby(null, "boy", "john", birthdate).should.be.rejectedWith(IllegalArgumentError);
	});
	it('addBaby4()', function() {
		return babyController.addBaby("", "boy", "john", birthdate).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument - no sex
	it('addBaby5()', function() {
		return babyController.addBaby("MOCK_USER_ID", null, "john", birthdate).should.be.rejectedWith(IllegalArgumentError);
	});
	it('addBaby6()', function() {
		return babyController.addBaby("MOCK_USER_ID", "", "john", birthdate).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument - invalid sex
	it('addBaby7()', function() {
		return babyController.addBaby("MOCK_USER_ID", "unknown", "john", birthdate).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument - no birthdate
	it('addBaby8()', function() {
		return babyController.addBaby("MOCK_USER_ID", "boy", "john", null).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument - birthdate in future
	it('addBaby9()', function() {
		var birthdate2 = new Date();
		birthdate2.setDate(birthdate.getDate()+5);
		return babyController.addBaby("MOCK_USER_ID", "boy", "john", birthdate2).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument - no name
	it('addBaby10()', function() {
		return babyController.addBaby("MOCK_USER_ID", "boy", null, birthdate).should.be.rejectedWith(IllegalArgumentError);
	});
	it('addBaby11()', function() {
		return babyController.addBaby("MOCK_USER_ID", "boy", "", birthdate).should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal argument - birthdate is not a date
	it('addBaby12()', function() {
		return babyController.addBaby("MOCK_USER_ID", "boy", "john", "notadate").should.be.rejectedWith(TypeError);
	});
	//DAO Error
	it('addBaby13()', function() {
		var daoError = new DaoError("create the baby", new Error("foo"));
		babyDaoCreateBabyStub.rejects(daoError);
		return babyController.addBaby("MOCK_USER_ID", "boy", "john", birthdate).should.be.rejectedWith(daoError);
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
});

