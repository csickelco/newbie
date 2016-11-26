/**
 * @copyright
 * Copyright 2016 Christina Sickelco. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
 * http://aws.amazon.com/apache2.0/
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This class unit-tests the Utils module. It was written with the help
 * of this code mentor tutorial: https://www.codementor.io/nodejs/tutorial/unit-testing-nodejs-tdd-mocha-sinon
 * 
 * @author Christina Sickelco
 */

//Used to write more secure javascript. See http://www.w3schools.com/js/js_strict.asp. 
'use strict';

var chai = require('chai');
var expect = chai.expect; // we are using the "expect" style of Chai
var Utils = require('../../common/utils');

describe('Utils', function() {
  //getPoundsAndOuncesString
  it('getPoundsAndOuncesString1()', function() {
	  //Weight with both pounds and leftover ounces
	  expect(Utils.getPoundsAndOuncesString(194)).to.equal("12 pounds, 2 ounces");
  });
  it('getPoundsAndOuncesString2()', function() {
	  //Weight with pounds, zero ounces
	  expect(Utils.getPoundsAndOuncesString(192)).to.equal("12 pounds");
  });
  
  //formatDateString
  it('formatDateString1()', function() {
	  //Date where both month and day are two digits
	  expect(Utils.formatDateString(new Date(1995, 11, 17))).to.equal("1995-12-17");
  });
  it('formatDateString2()', function() {
	  //Date where month is single digit
	  expect(Utils.formatDateString(new Date(1995, 8, 17))).to.equal("1995-09-17");
  });
  it('formatDateString3()', function() {
	  //Date where both month and day are single digits
	  expect(Utils.formatDateString(new Date(1995, 8, 7))).to.equal("1995-09-07");
  });
  it('formatDateString4()', function() {
	  //Date and time
	  expect(Utils.formatDateString(new Date(1995, 8, 7, 3, 24, 0))).to.equal("1995-09-07");
  });
  
  //calculateAgeFromBirthdate
  it('calculateAgeFromBirthdate1()', function() {
	  //Born today
	  expect(Utils.calculateAgeFromBirthdate(new Date())).to.equal("0 days");
  });
  it('calculateAgeFromBirthdate2()', function() {
	  //Born yesterday
	  var d = new Date();
	  d.setDate(d.getDate()-1);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("1 day");
  });
  it('calculateAgeFromBirthdate3()', function() {
	  //Born less than a week ago
	  var d = new Date();
	  d.setDate(d.getDate()-5);
	  d.setHours(0);
	  d.setMinutes(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("5 days");
  });
  it('calculateAgeFromBirthdate4()', function() {
	  //Born exactly a week ago
	  var d = new Date();
	  d.setDate(d.getDate()-7);
	  d.setHours(0);
	  d.setMinutes(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("1 week");
  });
  it('calculateAgeFromBirthdate5()', function() {
	  //Born a week and one day ago
	  var d = new Date();
	  d.setDate(d.getDate()-8);
	  d.setHours(0);
	  d.setMinutes(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("1 week and 1 day");
  });
  it('calculateAgeFromBirthdate6()', function() {
	  //Born a week and two days ago
	  var d = new Date();
	  d.setDate(d.getDate()-9);
	  d.setHours(0);
	  d.setMinutes(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("1 week and 2 days");
  });
  it('calculateAgeFromBirthdate7()', function() {
	  //Born 2 weeks ago
	  var d = new Date();
	  d.setDate(d.getDate()-14);
	  d.setHours(0);
	  d.setMinutes(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("2 weeks");
  });
  it('calculateAgeFromBirthdate8()', function() {
	  //Born 2 weeks and 1 day ago
	  var d = new Date();
	  d.setDate(d.getDate()-15);
	  d.setHours(0);
	  d.setMinutes(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("2 weeks and 1 day");
  });
  it('calculateAgeFromBirthdate9()', function() {
	  //Born 2 weeks and 2 days ago
	  var d = new Date();
	  d.setDate(d.getDate()-16);
	  d.setHours(0);
	  d.setMinutes(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("2 weeks and 2 days");
  });
  it('calculateAgeFromBirthdate10()', function() {
	  //Born 12 weeks
	  var d = new Date();
	  d.setDate(d.getDate()-(7*12));
	  d.setHours(0);
	  d.setMinutes(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("12 weeks");
  });
  it('calculateAgeFromBirthdate10b()', function() {
	  //Born 20 weeks
	  var d = new Date();
	  d.setDate(d.getDate()-(7*20));
	  d.setHours(0);
	  d.setMinutes(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("20 weeks");
  });
  it('calculateAgeFromBirthdate11()', function() {
	  //Born exactly 6 months ago
	  var d = new Date();
	  d.setMonth(d.getMonth()-6);
	  d.setHours(0);
	  d.setMinutes(0);
	  d.setSeconds(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("6 months");
  });
  it('calculateAgeFromBirthdate12()', function() {
	  //Born 6 months and 2 days ago
	  var d = new Date();
	  d.setMonth(d.getMonth()-6);
	  d.setDate(d.getDate()-2);
	  d.setHours(0);
	  d.setMinutes(0);
	  d.setSeconds(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("about 6 months");
  });
  it('calculateAgeFromBirthdate13()', function() {
	  //Born 6 months and 27 days ago
	  var d = new Date();
	  d.setMonth(d.getMonth()-6);
	  d.setDate(d.getDate()-27);
	  d.setHours(0);
	  d.setMinutes(0);
	  d.setSeconds(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("about 7 months");
  });
  it('calculateAgeFromBirthdate14()', function() {
	  //Born exactly 5 months ago
	  var d = new Date();
	  d.setMonth(d.getMonth()-5);
	  d.setHours(0);
	  d.setMinutes(0);
	  d.setSeconds(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("5 months");
  });
  it('calculateAgeFromBirthdate15()', function() {
	  //Born exactly 1 year ago
	  var d = new Date();
	  d.setFullYear(d.getFullYear()-1);
	  d.setHours(0);
	  d.setMinutes(0);
	  d.setSeconds(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("1 year");
  });
  it('calculateAgeFromBirthdate16()', function() {
	  //Born exactly 1 year and 1 day ago
	  var d = new Date();
	  d.setFullYear(d.getFullYear()-1);
	  d.setDate(d.getDate()-1);
	  d.setHours(0);
	  d.setMinutes(0);
	  d.setSeconds(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("1 year");
  });
  it('calculateAgeFromBirthdate17()', function() {
	  //Born exactly 1 year ago
	  var d = new Date();
	  d.setFullYear(d.getFullYear()-2);
	  d.setHours(0);
	  d.setMinutes(0);
	  d.setSeconds(0);
	  expect(Utils.calculateAgeFromBirthdate(d)).to.equal("2 years");
  });
  
  //formatDuration
  it('formatDuration1', function() {
	  expect(Utils.formatDuration(0)).to.equal("0 minutes");
  });
  it('formatDuration2', function() {
	  expect(Utils.formatDuration(1000)).to.equal("0 minutes");
  });
  it('formatDuration3', function() {
	  expect(Utils.formatDuration(2000)).to.equal("0 minutes");
  });
  it('formatDuration4', function() {
	  expect(Utils.formatDuration(59000)).to.equal("0 minutes");
  });
  it('formatDuration5', function() {
	  expect(Utils.formatDuration(60000)).to.equal("1 minute");
  });
  it('formatDuration6', function() {
	  expect(Utils.formatDuration(60001)).to.equal("1 minute");
  });
  it('formatDuration7', function() {
	  expect(Utils.formatDuration(120000)).to.equal("2 minutes");
  });
  it('formatDuration8', function() {
	  expect(Utils.formatDuration(59*60*1000)).to.equal("59 minutes");
  });
  it('formatDuration9', function() {
	  expect(Utils.formatDuration(60*60*1000)).to.equal("1 hour");
  });
  it('formatDuration10', function() {
	  expect(Utils.formatDuration((60*60*1000)+1)).to.equal("1 hour");
  });
  it('formatDuration11', function() {
	  expect(Utils.formatDuration((60*60*1000)+(60*1000))).to.equal("1 hour and 1 minute");
  });
  it('formatDuration12', function() {
	  expect(Utils.formatDuration((60*60*1000)+(120*1000))).to.equal("1 hour and 2 minutes");
  });
  it('formatDuration13', function() {
	  expect(Utils.formatDuration((120*60*1000)+(120*1000))).to.equal("2 hours and 2 minutes");
  });
  it('formatDuration14', function() {
	  expect(Utils.formatDuration((24*60*60*1000))).to.equal("1 day");
  });
  it('formatDuration15', function() {
	  expect(Utils.formatDuration((24*60*60*1000)+(60*1000))).to.equal("1 day and 1 minute");
  });
  it('formatDuration16', function() {
	  expect(Utils.formatDuration((24*60*60*1000)+(2*60*1000))).to.equal("1 day and 2 minutes");
  });
  it('formatDuration17', function() {
	  expect(Utils.formatDuration((2*24*60*60*1000)+(2*60*1000))).to.equal("2 days and 2 minutes");
  });
  it('formatDuration18', function() {
	  expect(Utils.formatDuration((24*60*60*1000)+(60*60*1000))).to.equal("1 day and 1 hour");
  });
  it('formatDuration19', function() {
	  expect(Utils.formatDuration((24*60*60*1000)+(2*60*60*1000))).to.equal("1 day and 2 hours");
  });
  it('formatDuration20', function() {
	  expect(Utils.formatDuration((24*60*60*1000)+(60*60*1000)+(60*1000))).to.equal("1 day, 1 hour, and 1 minute");
  });
  it('formatDuration21', function() {
	  expect(Utils.formatDuration((24*60*60*1000)+(2*60*60*1000)+(2*60*1000))).to.equal("1 day, 2 hours, and 2 minutes");
  });
  
  //getTime
  it('getTime1', function() {
	  expect(Utils.getTime(new Date(2016, 8, 20, 0, 0, 0), "America/New_York")).to.equal("12 oh clock AM");
  });
  it('getTime2', function() {
	  expect(Utils.getTime(new Date(2016, 8, 20, 0, 1, 0), "America/New_York")).to.equal("12 oh 1 AM");
  });
  it('getTime3', function() {
	  expect(Utils.getTime(new Date(2016, 8, 20, 1, 0, 0), "America/New_York")).to.equal("1 oh clock AM");
  });
  it('getTime4', function() {
	  expect(Utils.getTime(new Date(2016, 8, 20, 1, 1, 0), "America/New_York")).to.equal("1 oh 1 AM");
  });
  it('getTime5', function() {
	  expect(Utils.getTime(new Date(2016, 8, 20, 12, 0, 0), "America/New_York")).to.equal("12 oh clock PM");
  });
  it('getTime6', function() {
	  expect(Utils.getTime(new Date(2016, 8, 20, 12, 1, 0), "America/New_York")).to.equal("12 oh 1 PM");
  });
  it('getTime7', function() {
	  expect(Utils.getTime(new Date(2016, 8, 20, 13, 0, 0), "America/New_York")).to.equal("1 oh clock PM");
  });
  it('getTime8', function() {
	  expect(Utils.getTime(new Date(2016, 8, 20, 13, 1, 0), "America/New_York")).to.equal("1 oh 1 PM");
  });
  it('getTime9', function() {
	  expect(Utils.getTime(new Date(2016, 8, 20, 13, 10, 0), "America/New_York")).to.equal("1 10 PM");
  });
  
  //pluralizeIfNeeded
  it('pluralizeIfNeeded1', function() {
	  expect(Utils.pluralizeIfNeeded(0)).to.equal("s");
  });
  it('pluralizeIfNeeded2', function() {
	  expect(Utils.pluralizeIfNeeded(1)).to.equal("");
  });
  it('pluralizeIfNeeded3', function() {
	  expect(Utils.pluralizeIfNeeded(2)).to.equal("s");
  });
  it('pluralizeIfNeeded4', function() {
	  expect(Utils.pluralizeIfNeeded(1000)).to.equal("s");
  });
  
  //heShe
  it('heShe1', function() {
	  expect(Utils.heShe("boy", false)).to.equal("he");
  });
  it('heShe2', function() {
	  expect(Utils.heShe("boy", true)).to.equal("He");
  });
  it('heShe3', function() {
	  expect(Utils.heShe("girl", false)).to.equal("she");
  });
  it('heShe4', function() {
	  expect(Utils.heShe("girl", true)).to.equal("She");
  });
  it('heShe5', function() {
	  expect(Utils.heShe("boy")).to.equal("he");
  });
  it('heShe6', function() {
	  expect(Utils.heShe("girl")).to.equal("she");
  });
  
  //formatDateTimeString
  it('formatDateTimeString1', function() {
	 expect(Utils.formatDateTimeString(new Date('1995-09-07T14:24:00Z'), "America/New_York")
	 	).to.equal("1995-09-07T10:24:00-04:00"); 
  });
});

