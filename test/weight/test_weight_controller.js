/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class unit-tests the WeightController module. It was written with the help
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
var WeightController = require('../../weight/weight_controller');
var WeightDao = require('../../weight/weight_aws_dao');
var WeightPercentileDao = require('../../weight/weight_percentile_dao');
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

describe('WeightController', function() {
	var weightController = new WeightController();
	
	/*
	 * We want to stub out the pieces of code that make writing the tests difficult,
	 * namely the DAO code, since it would require establishing an actual connection,
	 * populating with consistent test data, and somehow figuring out how to get
	 * unlikely error conditions to trigger to fully test all paths.
	 */
	var weightPercentileGetPercentileStub;
	var weightDaoCreateWeightStub;
	var weightDaoCreateTableStub;
	var weightDaoDeleteWeightStub;
	var weightDaoGetLastWeightStub;
	var babyDaoReadBabyStub;
	
	beforeEach(function() {	    	
		weightDaoCreateWeightStub = sinon.stub(weightController.weightDao, 'createWeight');
		weightDaoCreateTableStub = sinon.stub(weightController.weightDao, 'createTable');
		weightDaoDeleteWeightStub = sinon.stub(weightController.weightDao, 'deleteWeight');
		weightDaoGetLastWeightStub = sinon.stub(weightController.weightDao, 'getLastWeight');
		weightPercentileGetPercentileStub = sinon.stub(weightController.weightPercentileDao, 'getWeightPercentile');
		babyDaoReadBabyStub = sinon.stub(weightController.babyDao, 'readBaby');
	});
	
	afterEach(function() {
		weightController.weightDao.createWeight.restore();
		weightController.weightDao.createTable.restore();
		weightController.weightDao.deleteWeight.restore();
		weightController.weightDao.getLastWeight.restore();
		weightController.weightPercentileDao.getWeightPercentile.restore();
		weightController.babyDao.readBaby.restore();
	});
	 
	//addweight tests
	//Happy path test 1
	it('addweight1()', function() {
		weightDaoCreateWeightStub.resolves();
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
		weightPercentileGetPercentileStub.resolves(22);
		
		var expectedResponseMsg = "Added weight 12 pounds, 8 ounces for jane. She is in the twenty-second percentile";
		var expectedResponse = new Response(expectedResponseMsg, "Weight", expectedResponseMsg);
		return weightController.addWeight("MOCK_USER_ID", new Date(), 12, 8)
			.should.eventually.deep.equal(expectedResponse);
	});
	
	it('addweight2()', function() {
		weightDaoCreateWeightStub.resolves();
		var item = {
			"Item" :
			{
				"birthdate":"2016-06-01T00:00:00.000Z",
				"sex":"boy",
				"userId":"MOCK_USER_ID",
				"name":"henry"  
			}
		};
		babyDaoReadBabyStub.resolves(item);
		weightPercentileGetPercentileStub.resolves(60);
		
		var expectedResponseMsg = "Added weight 6 pounds, 1 ounce for henry. He is in the sixtieth percentile";
		var expectedResponse = new Response(expectedResponseMsg, "Weight", expectedResponseMsg);
		return weightController.addWeight("MOCK_USER_ID", new Date(), 6, 1)
			.should.eventually.deep.equal(expectedResponse);
	});
	
	it('addweight3()', function() {
		weightDaoCreateWeightStub.resolves();
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
		weightPercentileGetPercentileStub.resolves(5);
		
		var expectedResponseMsg = "Added weight 1 pound, 15 ounces for jane. She is in the fifth percentile";
		var expectedResponse = new Response(expectedResponseMsg, "Weight", expectedResponseMsg);
		return weightController.addWeight("MOCK_USER_ID", new Date(), 1, 15)
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Illegal argument - no user id
	it('addweight4()', function() {
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
		return weightController.addWeight("", new Date(), 12, 8).should.be.rejectedWith(IllegalArgumentError);
	});
	
	//Illegal argument - no date
	it('addweight5()', function() {
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
		return weightController.addWeight("MOCK_USER_ID", "", 12, 8).should.be.rejectedWith(IllegalArgumentError);
	});
	
	//Illegal argument - measurement date before birthdate
	it('addweight6()', function() {
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
		return weightController.addWeight("MOCK_USER_ID", new Date(2016, 4, 31), 12, 8).should.be.rejectedWith(IllegalArgumentError);
	});
	
	//Illegal argument - no pounds
	it('addweight7()', function() {
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
		return weightController.addWeight("MOCK_USER_ID", new Date(), "", 8).should.be.rejectedWith(IllegalArgumentError);
	});
	
	//Illegal argument - pounds not an integer
	it('addweight8()', function() {
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
		return weightController.addWeight("MOCK_USER_ID", new Date(), "NaN", 8).should.be.rejectedWith(TypeError);
	});
	
	//Illegal argument - pounds not >= 0
	it('addweight9()', function() {
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
		return weightController.addWeight("MOCK_USER_ID", new Date(), -1, 8).should.be.rejectedWith(RangeError);
	});
	
	//Happy path - no ounces
	it('addweight10()', function() {
		weightDaoCreateWeightStub.resolves();
		var item = {
			"Item" :
			{
				"birthdate":"2016-06-01T00:00:00.000Z",
				"sex":"boy",
				"userId":"MOCK_USER_ID",
				"name":"henry"  
			}
		};
		babyDaoReadBabyStub.resolves(item);
		weightPercentileGetPercentileStub.resolves(60);
		
		var expectedResponseMsg = "Added weight 6 pounds, 0 ounces for henry. He is in the sixtieth percentile";
		var expectedResponse = new Response(expectedResponseMsg, "Weight", expectedResponseMsg);
		return weightController.addWeight("MOCK_USER_ID", new Date(), 6)
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Illegal argument - ounces not an integer
	it('addweight11()', function() {
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
		return weightController.addWeight("MOCK_USER_ID", new Date(), 12, "NaN").should.be.rejectedWith(TypeError);
	});
	
	//Illegal argument - ounces not >= 0
	it('addweight12()', function() {
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
		return weightController.addWeight("MOCK_USER_ID", new Date(), 12, -1).should.be.rejectedWith(RangeError);
	});
	
	//Illegal argument - ounces not > 15
	it('addweight12()', function() {
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
		return weightController.addWeight("MOCK_USER_ID", new Date(), 12, 16).should.be.rejectedWith(RangeError);
	});
	
	//initweightData tests
	//Happy path
	it('initweightData1()', function() {
		weightDaoCreateTableStub.resolves();
		return weightController.initWeightData().should.be.fulfilled;
	});
	
	//DAO Error
	it('initweightData2()', function() {
		var daoError = new DaoError("create the table", new Error("foo"));
		weightDaoCreateTableStub.rejects(daoError);
		return weightController.initWeightData().should.be.rejectedWith(daoError);
	});
	
	//removeLastweight tests
	//Happy path test 1
	it('removeLastweight1()', function() {
		weightDaoDeleteWeightStub.resolves();
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
		var weightItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"weight":184
				}
				]
			};
		weightDaoGetLastWeightStub.resolves(weightItem);
		var expectedResponseMsg = "Removed weight 11 pounds, 8 ounces for jane.";
		var expectedResponse = new Response(expectedResponseMsg, "Weight", expectedResponseMsg);
		return weightController.removeLastWeight("MOCK_USER_ID")
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Illegal argument tests - no user ID
	it('removeLastweight4()', function() {
		return weightController.removeLastWeight(null, new Date(), true, true).should.be.rejectedWith(IllegalArgumentError);
	});
	it('removeLastweight5()', function() {
		return weightController.removeLastWeight('').should.be.rejectedWith(IllegalArgumentError);
	});
	//Illegal state tests
	it('removeLastweight6()', function() {
		weightDaoDeleteWeightStub.resolves();
		babyDaoReadBabyStub.resolves(); //No baby returned
		var weightItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"weight":184
				}
				]
			};
		weightDaoGetLastWeightStub.resolves(weightItem);
		return weightController.removeLastWeight('MOCK_USER_ID').should.be.rejectedWith(IllegalStateError);
	});
	//DAO Errors
	it('removeLastweight7()', function() {
		var daoError = new DaoError("Dao error", new Error("foo"));
		weightDaoDeleteWeightStub.rejects(daoError);
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
		var weightItem = {
				"Items" :
				[
				{
					"dateTime":"2016-06-01T00:00:00.000Z",
					"weight":184
				}
				]
			};
		weightDaoGetLastWeightStub.resolves(weightItem);
		return weightController.removeLastWeight('MOCK_USER_ID').should.be.rejectedWith(daoError);
	});
	
	//No weight entries exist
	it('removeLastweight8()', function() {
		weightDaoDeleteWeightStub.resolves();
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
		var weightItem = {
				"Items" : []
			};
		weightDaoGetLastWeightStub.resolves(weightItem);
		var expectedResponseMsg = "No previous weight entries recorded for jane";
		var expectedResponse = new Response(expectedResponseMsg, "Weight", expectedResponseMsg);
		return weightController.removeLastWeight("MOCK_USER_ID")
			.should.eventually.deep.equal(expectedResponse);
	});
});

