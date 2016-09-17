/**
 * http://usejsdoc.org/
 */
'use strict';
module.change_code = 1;

function Baby (obj) {
	this.userId = undefined;
	this.sex = undefined;
	this.name = undefined;
	this.birthdate = undefined;
	
	if( obj !== undefined ) {
		for (var prop in obj) { //TODO: eliminate warning
			this[prop] = obj[prop];
		}
	}
}


Baby.prototype.toString = function babyToString() {
	  var ret = 'Baby, userId: ' + this.userId + ', sex: ' + this.sex + ", name: " + this.name + ", birthdate: " + this.birthdate;
	  return ret;
};

module.exports = Baby;