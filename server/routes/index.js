'use strict';

const router = require('express').Router();
const mongoose = require('mongoose');

router.get('/health', (req, res) => {
  res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

router.use('/auth', require('./auth.routes'));
router.use('/atms', require('./atm.routes'));

module.exports = router;
