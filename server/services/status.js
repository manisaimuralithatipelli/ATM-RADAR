'use strict';

/**
 * Availability status calculation.
 *
 * This module is pure: it has no database, clock, or language dependency.
 * The interface language and theme never reach this code, so they cannot
 * change a computed status.
 *
 * Rules:
 *  - The newest valid report decides AVAILABLE or UNAVAILABLE.
 *  - A report is valid while (now - reportedAt) < validityMs.
 *  - With no valid report the status is UNKNOWN.
 *  - Reports dated more than one minute in the future are ignored.
 */

const STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  UNAVAILABLE: 'UNAVAILABLE',
  UNKNOWN: 'UNKNOWN',
});

const SOURCE = Object.freeze({
  SIMULATED: 'simulated',
  COMMUNITY: 'community',
});

const RELIABILITY = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  SIMULATED: 'SIMULATED',
  NONE: 'NONE',
});

const REPORTABLE_STATUSES = Object.freeze([STATUS.AVAILABLE, STATUS.UNAVAILABLE]);
const CLOCK_SKEW_MS = 60 * 1000;

function normalise(report, nowMs) {
  if (!report || report.reportedAt === null || report.reportedAt === undefined) return null;
  if (!REPORTABLE_STATUSES.includes(report.status)) return null;
  if (report.source !== SOURCE.SIMULATED && report.source !== SOURCE.COMMUNITY) return null;

  const time = new Date(report.reportedAt).getTime();
  if (!Number.isFinite(time)) return null;
  if (time > nowMs + CLOCK_SKEW_MS) return null;

  return { status: report.status, source: report.source, time };
}

// Newest first. Ties: community before simulated, then UNAVAILABLE before AVAILABLE.
function compareReports(a, b) {
  if (b.time !== a.time) return b.time - a.time;
  if (a.source !== b.source) return a.source === SOURCE.COMMUNITY ? -1 : 1;
  if (a.status !== b.status) return a.status === STATUS.UNAVAILABLE ? -1 : 1;
  return 0;
}

function emptyResult(lastReport = null) {
  return {
    status: STATUS.UNKNOWN,
    isValid: false,
    source: null,
    reliability: RELIABILITY.NONE,
    reportedAt: null,
    expiresAt: null,
    supportingReports: 0,
    contradictingReports: 0,
    lastReport,
  };
}

function computeAtmStatus(reports, { now = new Date(), validityMs } = {}) {
  if (!Number.isFinite(validityMs) || validityMs <= 0) {
    throw new TypeError('validityMs must be a positive number');
  }

  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) {
    throw new TypeError('now must be a valid date');
  }

  const cleaned = (Array.isArray(reports) ? reports : [])
    .map((r) => normalise(r, nowMs))
    .filter(Boolean)
    .sort(compareReports);

  if (cleaned.length === 0) return emptyResult();

  const latest = cleaned[0];
  const lastReport = {
    status: latest.status,
    source: latest.source,
    reportedAt: new Date(latest.time),
  };

  const expiresAtMs = latest.time + validityMs;
  if (nowMs >= expiresAtMs) return emptyResult(lastReport);

  const windowStartMs = nowMs - validityMs;
  const validCommunity = cleaned.filter(
    (r) => r.source === SOURCE.COMMUNITY && r.time > windowStartMs
  );
  const supportingReports = validCommunity.filter((r) => r.status === latest.status).length;
  const contradictingReports = validCommunity.length - supportingReports;

  let reliability;
  if (latest.source === SOURCE.SIMULATED) {
    reliability = RELIABILITY.SIMULATED;
  } else if (supportingReports >= 3 && contradictingReports === 0) {
    reliability = RELIABILITY.HIGH;
  } else if (supportingReports >= 2 && supportingReports > contradictingReports) {
    reliability = RELIABILITY.MEDIUM;
  } else {
    reliability = RELIABILITY.LOW;
  }

  return {
    status: latest.status,
    isValid: true,
    source: latest.source,
    reliability,
    reportedAt: new Date(latest.time),
    expiresAt: new Date(expiresAtMs),
    supportingReports,
    contradictingReports,
    lastReport,
  };
}

module.exports = {
  STATUS,
  SOURCE,
  RELIABILITY,
  REPORTABLE_STATUSES,
  computeAtmStatus,
};
