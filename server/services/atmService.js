'use strict';

const Report = require('../models/Report');
const env = require('../config/env');
const { computeAtmStatus } = require('./status');
const { haversineMeters } = require('../utils/geo');

function iso(date) {
  return date ? date.toISOString() : null;
}

function serializeAvailability(a) {
  return {
    status: a.status,
    isValid: a.isValid,
    source: a.source,
    reliability: a.reliability,
    reportedAt: iso(a.reportedAt),
    expiresAt: iso(a.expiresAt),
    supportingReports: a.supportingReports,
    contradictingReports: a.contradictingReports,
    lastReport: a.lastReport
      ? {
          status: a.lastReport.status,
          source: a.lastReport.source,
          reportedAt: iso(a.lastReport.reportedAt),
        }
      : null,
  };
}

function serializeAtm(atm, availability, origin) {
  const [lng, lat] = atm.location.coordinates;
  const out = {
    id: String(atm._id),
    name: atm.name,
    bank: atm.bank,
    area: atm.area,
    address: atm.address,
    pincode: atm.pincode,
    lat,
    lng,
    isSimulated: atm.isSimulated,
    availability: serializeAvailability(availability),
  };
  if (origin) out.distanceMeters = haversineMeters(origin.lat, origin.lng, lat, lng);
  return out;
}

// Loads recent reports for the given ATMs in one query and computes each status.
// Language and theme are never inputs here.
async function withAvailability(atms, { now = new Date(), origin = null } = {}) {
  if (atms.length === 0) return [];

  const since = new Date(now.getTime() - env.historyMs);
  const reports = await Report.find({
    atm: { $in: atms.map((a) => a._id) },
    reportedAt: { $gte: since },
  })
    .select('atm status source reportedAt')
    .lean();

  const byAtm = new Map();
  for (const r of reports) {
    const key = String(r.atm);
    if (!byAtm.has(key)) byAtm.set(key, []);
    byAtm.get(key).push(r);
  }

  return atms.map((atm) => {
    const availability = computeAtmStatus(byAtm.get(String(atm._id)) || [], {
      now,
      validityMs: env.validityMs,
    });
    return serializeAtm(atm, availability, origin);
  });
}

module.exports = { withAvailability, serializeAvailability };
