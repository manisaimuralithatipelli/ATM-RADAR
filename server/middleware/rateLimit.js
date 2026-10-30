'use strict';

const rateLimit = require('express-rate-limit');

function limiter({ windowMs, limit }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
      });
    },
  });
}

module.exports = {
  apiLimiter: limiter({ windowMs: 15 * 60 * 1000, limit: 300 }),
  authLimiter: limiter({ windowMs: 15 * 60 * 1000, limit: 20 }),
  reportLimiter: limiter({ windowMs: 60 * 60 * 1000, limit: 30 }),
};
