/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class unit-tests the WeightPercentilDao module. It was written with the help
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
var WeightPercentileDao = require('../../weight/weight_percentile_dao');
var DaoError = require('../../common/dao_error');
var Promise = require('bluebird');

chai.use(chaiAsPromised);
chai.should();

describe('WeightPercentilDao', function() {
	var weightPercentilDao = new WeightPercentileDao();
	 
	//Happy path test 1 - girl
	it('getWeightPercentile1()', function() {
		return weightPercentilDao.getWeightPercentile(12, 4, 
				new Date(2016, 5, 1), new Date(2016, 8, 29), "girl")
				.should.eventually.equal(22);
	});
	
	//Happy path test 2 - boy
	it('getWeightPercentile2()', function() {
		return weightPercentilDao.getWeightPercentile(12, 4, 
				new Date(2016, 5, 1), new Date(2016, 8, 29), "boy")
				.should.eventually.equal(7);
	});
});

