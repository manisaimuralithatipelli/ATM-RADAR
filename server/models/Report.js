'use strict';

const mongoose = require('mongoose');

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

const reportSchema = new mongoose.Schema({
  atm: { type: mongoose.Schema.Types.ObjectId, ref: 'Atm', required: true },
  // null for simulated reports
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  source: { type: String, enum: ['simulated', 'community'], required: true },
  status: { type: String, enum: ['AVAILABLE', 'UNAVAILABLE'], required: true },
  reportedAt: { type: Date, required: true, default: Date.now },
});

reportSchema.index({ atm: 1, reportedAt: -1 });
reportSchema.index({ atm: 1, user: 1, reportedAt: -1 });
// Data minimisation: old reports are deleted automatically after 7 days
reportSchema.index({ reportedAt: 1 }, { expireAfterSeconds: SEVEN_DAYS_SECONDS });

module.exports = mongoose.model('Report', reportSchema);
