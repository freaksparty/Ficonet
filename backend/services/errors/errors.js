var Error = require('sequelize').Error,
	errors = {},
	makeError;

makeError = function (name) {
	errors[name] = function () {};
	errors[name].prototype = Object.create(Error.prototype);
};

makeError("ElementNotFoundError");
makeError("ForbiddenActionError");


module.exports = errors;