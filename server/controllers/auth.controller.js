'use strict';

const bcrypt = require('bcryptjs');
const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { setAuthCookie, clearAuthCookie } = require('../middleware/auth');

// Compared against when the email is unknown, so response time does not reveal it
const DUMMY_HASH = bcrypt.hashSync('atmradar-dummy-password-1', env.BCRYPT_ROUNDS);

function publicUser(user) {
  return { id: String(user._id), name: user.name, email: user.email };
}

const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.validated.body;

  const existing = await User.exists({ email });
  if (existing) throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  let user;
  try {
    user = await User.create({ name, email, passwordHash });
  } catch (err) {
    if (err && err.code === 11000) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw err;
  }

  setAuthCookie(res, user._id);
  res.status(201).json({ user: publicUser(user) });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  const hash = user ? user.passwordHash : DUMMY_HASH;
  const matches = await bcrypt.compare(password, hash);

  if (!user || !matches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  setAuthCookie(res, user._id);
  res.json({ user: publicUser(user) });
});

function logout(req, res) {
  clearAuthCookie(res);
  res.status(204).end();
}

function me(req, res) {
  res.json({ user: req.user || null });
}

module.exports = { signup, login, logout, me };
