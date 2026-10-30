'use strict';

const ApiError = require('../utils/ApiError');

// Cross-site HTML forms cannot send application/json without a CORS preflight,
// so requiring it on writes is a cheap extra defence on top of SameSite cookies.
module.exports = function requireJson(req, res, next) {
  if (!req.is('application/json')) {
    return next(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json'));
  }
  return next();
};
