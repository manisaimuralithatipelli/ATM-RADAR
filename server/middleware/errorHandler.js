'use strict';

const { ZodError } = require('zod');
const ApiError = require('../utils/ApiError');

const CODE_PATTERN = /^[A-Z][A-Z0-9_]+$/;

function notFoundApi(req, res, next) {
  next(new ApiError(404, 'NOT_FOUND', 'Resource not found'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...err.extra },
    });
  }

  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = CODE_PATTERN.test(issue.message) ? issue.message : 'INVALID_VALUE';
    }
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields },
    });
  }

  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }

  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
  }

  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}

module.exports = { errorHandler, notFoundApi };
