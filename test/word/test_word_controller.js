/**
 * @copyright
 * Copyright 2017 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class unit-tests the WordController module. It was written with the help
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
var WordController = require('../../word/word_controller');
var WordDao = require('../../word/word_aws_dao');
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

describe('WordController', function() {
	var wordController = new WordController();
	
	/*
	 * We want to stub out the pieces of code that make writing the tests difficult,
	 * namely the DAO code, since it would require establishing an actual connection,
	 * populating with consistent test data, and somehow figuring out how to get
	 * unlikely error conditions to trigger to fully test all paths.
	 */
	var wordDaoCreateWordStub;
	var wordDaoCreateTableStub;
	var wordDaoGetWordCountStub;
	var babyDaoReadBabyStub;
	var babyDaoReadBabyByNameStub;
	
	beforeEach(function() {	    	
		wordDaoCreateWordStub = sinon.stub(wordController.wordDao, 'createWord');
		wordDaoCreateTableStub = sinon.stub(wordController.wordDao, 'createTable');
		wordDaoGetWordCountStub = sinon.stub(wordController.wordDao, 'getWordCount');
		babyDaoReadBabyStub = sinon.stub(wordController.babyDao, 'readBaby');
		babyDaoReadBabyByNameStub = sinon.stub(wordController.babyDao, 'readBabyByName');
	});
	
	afterEach(function() {
		wordController.wordDao.createWord.restore();
		wordController.wordDao.createTable.restore();
		wordController.wordDao.getWordCount.restore();
		wordController.babyDao.readBaby.restore();
		wordController.babyDao.readBabyByName.restore();
	});
	 
	//addWord tests
	//Happy path test 1
	it('addWord1()', function() {
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		wordDaoCreateWordStub.resolves();
		babyDaoReadBabyStub.resolves(baby);
		var expectedResponseMsg = "Added word unit testing for jane";
		var expectedResponse = new Response(expectedResponseMsg, "Word", expectedResponseMsg);
		return wordController.addWord("MOCK_USER_ID", "unit testing", new Date())
			.should.eventually.deep.equal(expectedResponse);
	});
	
	//Happy path test 2
	it('addWord2()', function() {
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jill";
		wordDaoCreateWordStub.resolves();
		babyDaoReadBabyByNameStub.resolves(baby);
		var expectedResponseMsg = "Added word unit testing for jill";
		var expectedResponse = new Response(expectedResponseMsg, "Word", expectedResponseMsg);
		return wordController.addWord("MOCK_USER_ID", "unit testing", new Date(), "jill")
			.should.eventually.deep.equal(expectedResponse);
	});
		
	//Illegal argument tests
	it('addWord3()', function() {
		return wordController.addWord(null, "unit testing").should.be.rejectedWith(IllegalArgumentError);
	});
	it('addWord4()', function() {
		return wordController.addWord('', "unit testing").should.be.rejectedWith(IllegalArgumentError);
	});
	it('addWord5()', function() {
		return wordController.addWord('MOCK_USER_ID', "", new Date()).should.be.rejectedWith(IllegalArgumentError);
	});
	it('addWord6()', function() {
		return wordController.addWord('MOCK_USER_ID', null, new Date()).should.be.rejectedWith(IllegalArgumentError);
	});
	
	//Illegal state tests
	it('addWord7()', function() {
		wordDaoCreateWordStub.resolves();
		babyDaoReadBabyStub.resolves(); //No baby returned
		return wordController.addWord('MOCK_USER_ID', 'unit testing', new Date()).should.be.rejectedWith(IllegalStateError);
	});
	
	//DAO Errors
	it('addWord7()', function() {
		var daoError = new DaoError("create the word table", new Error("foo"));
		wordDaoCreateWordStub.rejects(daoError);
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		return wordController.addWord('MOCK_USER_ID', 'unit testing', new Date()).should.be.rejectedWith(daoError);
	});
	it('addWord8()', function() {
		wordDaoCreateWordStub.resolves();
		var daoError = new DaoError("read the baby", new Error("foo"));
		babyDaoReadBabyStub.rejects(daoError);
		return wordController.addWord('MOCK_USER_ID', 'unit testing', new Date()).should.be.rejectedWith(daoError);
	});
	
	//initWordData tests
	//Happy path
	it('initWordData1()', function() {
		wordDaoCreateTableStub.resolves();
		return wordController.initWordData().should.be.fulfilled;
	});
	
	//DAO Error
	it('initWordData2()', function() {
		var daoError = new DaoError("create the table", new Error("foo"));
		wordDaoCreateTableStub.rejects(daoError);
		return wordController.initWordData().should.be.rejectedWith(daoError);
	});
	
	//Word Limit Errors
	it('addWord100()', function() {
		wordDaoCreateWordStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		wordDaoGetWordCountStub.resolves(1002);
		return wordController.addWord("MOCK_USER_ID", "unit testing", new Date())
			.should.be.rejectedWith(ActivityLimitError);
	});
	
	//Get word count -- happy path
	it('getWordCount1()', function() {
		wordDaoCreateWordStub.resolves();
		var baby = new Baby();
		baby.birthdate = "2016-06-01T00:00:00.000Z";
		baby.sex = "girl";
		baby.userId = "MOCK_USER_ID";
		baby.name = "jane";
		babyDaoReadBabyStub.resolves(baby);
		wordDaoGetWordCountStub.resolves(20);
		var expectedResponseMsg = "jane knows 20 words.";
		var expectedResponse = new Response(expectedResponseMsg, "Word Count", expectedResponseMsg);
		return wordController.getWordCount("MOCK_USER_ID").should.eventually.deep.equal(expectedResponse);
	});
	
	//Get word count -- baby not registered
	it('getWordCount2()', function() {
		wordDaoGetWordCountStub.resolves(20);
		babyDaoReadBabyStub.resolves(); //No baby returned
		return wordController.getWordCount('MOCK_USER_ID').should.be.rejectedWith(IllegalStateError);
	});
	
	//Illegal argument tests
	it('getWordCount3()', function() {
		return wordController.getWordCount(null).should.be.rejectedWith(IllegalArgumentError);
	});
	it('getWordCount4()', function() {
		return wordController.addWord('').should.be.rejectedWith(IllegalArgumentError);
	});
});

