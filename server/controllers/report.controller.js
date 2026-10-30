'use strict';

const Atm = require('../models/Atm');
const Report = require('../models/Report');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { withAvailability } = require('../services/atmService');

const create = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const { status } = req.validated.body;
  const now = new Date();

  const atm = await Atm.findById(id).lean();
  if (!atm) throw new ApiError(404, 'ATM_NOT_FOUND', 'ATM not found');

  if (env.REPORT_COOLDOWN_MINUTES > 0) {
    const cutoff = new Date(now.getTime() - env.REPORT_COOLDOWN_MINUTES * 60 * 1000);
    const recent = await Report.findOne({
      atm: atm._id,
      user: req.user.id,
      reportedAt: { $gt: cutoff },
    })
      .sort({ reportedAt: -1 })
      .select('reportedAt')
      .lean();

    if (recent) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((recent.reportedAt.getTime() + env.REPORT_COOLDOWN_MINUTES * 60 * 1000 - now.getTime()) / 1000)
      );
      throw new ApiError(429, 'REPORT_COOLDOWN', 'You already reported this ATM recently', {
        retryAfterSeconds,
      });
    }
  }

  await Report.create({
    atm: atm._id,
    user: req.user.id,
    source: 'community',
    status,
    reportedAt: now,
  });

  const [updated] = await withAvailability([atm], { now });
  res.status(201).json({ atm: updated });
});

module.exports = { create };
