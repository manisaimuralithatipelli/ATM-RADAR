'use strict';

class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message || code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

module.exports = ApiError;
