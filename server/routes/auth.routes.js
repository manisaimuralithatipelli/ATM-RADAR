'use strict';

const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const requireJson = require('../middleware/requireJson');
const { optionalAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { signupBody, loginBody } = require('../validation/schemas');

router.post('/signup', authLimiter, requireJson, validate(signupBody), controller.signup);
router.post('/login', authLimiter, requireJson, validate(loginBody), controller.login);
router.post('/logout', controller.logout);
router.get('/me', optionalAuth, controller.me);

module.exports = router;
