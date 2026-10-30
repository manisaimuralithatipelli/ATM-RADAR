'use strict';

const Atm = require('../models/Atm');
const Report = require('../models/Report');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { escapeRegex } = require('../utils/geo');
const { withAvailability } = require('../services/atmService');

const DEFAULT_RADIUS_METERS = 5000;
const DEFAULT_LIMIT = 100;
const DB_FETCH_CAP = 500;

const list = asyncHandler(async (req, res) => {
  const { q, bank, pincode, status, lat, lng, radius, limit } = req.validated.query;

  const filter = {};
  if (pincode) filter.pincode = pincode;
  if (bank) filter.bank = new RegExp(escapeRegex(bank), 'i');
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { area: rx }, { address: rx }, { bank: rx }, { pincode: rx }];
  }

  const hasOrigin = lat !== undefined && lng !== undefined;
  if (hasOrigin) {
    filter.location = {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radius || DEFAULT_RADIUS_METERS,
      },
    };
  }

  let query = Atm.find(filter).limit(DB_FETCH_CAP).lean();
  if (!hasOrigin) query = query.sort({ area: 1, name: 1 });

  const atms = await query;
  let results = await withAvailability(atms, { origin: hasOrigin ? { lat, lng } : null });

  if (status) results = results.filter((a) => a.availability.status === status);
  results = results.slice(0, limit || DEFAULT_LIMIT);

  res.json({
    count: results.length,
    validityMinutes: env.REPORT_VALIDITY_MINUTES,
    atms: results,
  });
});

const getOne = asyncHandler(async (req, res) => {
  const atm = await Atm.findById(req.validated.params.id).lean();
  if (!atm) throw new ApiError(404, 'ATM_NOT_FOUND', 'ATM not found');

  const [withStatus] = await withAvailability([atm]);

  // Recent reports without any user identity
  const recent = await Report.find({
    atm: atm._id,
    reportedAt: { $gte: new Date(Date.now() - env.historyMs) },
  })
    .sort({ reportedAt: -1 })
    .limit(10)
    .select('status source reportedAt -_id')
    .lean();

  res.json({
    atm: withStatus,
    validityMinutes: env.REPORT_VALIDITY_MINUTES,
    recentReports: recent.map((r) => ({
      status: r.status,
      source: r.source,
      reportedAt: r.reportedAt.toISOString(),
    })),
  });
});

const meta = asyncHandler(async (req, res) => {
  const [banks, areas, pincodes] = await Promise.all([
    Atm.distinct('bank'),
    Atm.distinct('area'),
    Atm.distinct('pincode'),
  ]);

  res.json({
    banks: banks.sort(),
    areas: areas.sort(),
    pincodes: pincodes.sort(),
    validityMinutes: env.REPORT_VALIDITY_MINUTES,
  });
});

module.exports = { list, getOne, meta };
