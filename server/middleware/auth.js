'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const COOKIE_NAME = 'atmradar_token';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.isProd,
    path: '/',
    maxAge: env.JWT_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  };
}

function signToken(userId) {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(userId),
    expiresIn: `${env.JWT_EXPIRES_DAYS}d`,
  });
}

function setAuthCookie(res, userId) {
  res.cookie(COOKIE_NAME, signToken(userId), cookieOptions());
}

function clearAuthCookie(res) {
  const { maxAge, ...options } = cookieOptions();
  res.clearCookie(COOKIE_NAME, options);
}

// Returns the logged-in user, or null when there is no valid session.
// An invalid or stale cookie is cleared so it is not sent again.
async function resolveUser(req, res) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (typeof token !== 'string' || token.length === 0) return null;

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    clearAuthCookie(res);
    return null;
  }

  const user = await User.findById(payload.sub).select('name email').lean();
  if (!user) {
    clearAuthCookie(res);
    return null;
  }
  return { id: String(user._id), name: user.name, email: user.email };
}

const requireAuth = asyncHandler(async (req, res, next) => {
  const user = await resolveUser(req, res);
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Please log in');
  req.user = user;
  next();
});

// Used by GET /api/auth/me so a logged-out visitor gets 200 with user: null
// instead of a 401 that shows up as an error in the browser console.
const optionalAuth = asyncHandler(async (req, res, next) => {
  req.user = await resolveUser(req, res);
  next();
});

module.exports = { requireAuth, optionalAuth, setAuthCookie, clearAuthCookie, COOKIE_NAME };
