'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeAtmStatus, STATUS, SOURCE, RELIABILITY } = require('../services/status');

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const NOW = new Date('2026-10-26T10:00:00.000Z');
const opts = { now: NOW, validityMs: HOUR };

function ago(minutes) {
  return new Date(NOW.getTime() - minutes * MIN);
}

function report(status, minutesAgo, source = SOURCE.COMMUNITY) {
  return { status, source, reportedAt: ago(minutesAgo) };
}

test('no reports gives UNKNOWN with nothing to show', () => {
  const r = computeAtmStatus([], opts);
  assert.equal(r.status, STATUS.UNKNOWN);
  assert.equal(r.isValid, false);
  assert.equal(r.reliability, RELIABILITY.NONE);
  assert.equal(r.reportedAt, null);
  assert.equal(r.lastReport, null);
});

test('non-array input is treated as no reports', () => {
  assert.equal(computeAtmStatus(undefined, opts).status, STATUS.UNKNOWN);
  assert.equal(computeAtmStatus(null, opts).status, STATUS.UNKNOWN);
});

test('a recent report decides the status', () => {
  const r = computeAtmStatus([report(STATUS.AVAILABLE, 10)], opts);
  assert.equal(r.status, STATUS.AVAILABLE);
  assert.equal(r.isValid, true);
  assert.equal(r.source, SOURCE.COMMUNITY);
  assert.equal(r.expiresAt.getTime(), ago(10).getTime() + HOUR);
});

test('59 minutes old is still valid', () => {
  const r = computeAtmStatus([report(STATUS.UNAVAILABLE, 59)], opts);
  assert.equal(r.status, STATUS.UNAVAILABLE);
  assert.equal(r.isValid, true);
});

test('exactly 60 minutes old has expired', () => {
  const r = computeAtmStatus([report(STATUS.AVAILABLE, 60)], opts);
  assert.equal(r.status, STATUS.UNKNOWN);
  assert.equal(r.isValid, false);
});

test('expired report keeps lastReport for display but status is UNKNOWN', () => {
  const r = computeAtmStatus([report(STATUS.AVAILABLE, 180)], opts);
  assert.equal(r.status, STATUS.UNKNOWN);
  assert.equal(r.reportedAt, null);
  assert.equal(r.source, null);
  assert.equal(r.lastReport.status, STATUS.AVAILABLE);
  assert.equal(r.lastReport.reportedAt.getTime(), ago(180).getTime());
});

test('the newest report wins regardless of input order', () => {
  const a = report(STATUS.AVAILABLE, 30);
  const b = report(STATUS.UNAVAILABLE, 5);
  assert.equal(computeAtmStatus([a, b], opts).status, STATUS.UNAVAILABLE);
  assert.equal(computeAtmStatus([b, a], opts).status, STATUS.UNAVAILABLE);
});

test('simulated reports are labelled SIMULATED', () => {
  const r = computeAtmStatus([report(STATUS.AVAILABLE, 5, SOURCE.SIMULATED)], opts);
  assert.equal(r.source, SOURCE.SIMULATED);
  assert.equal(r.reliability, RELIABILITY.SIMULATED);
});

test('a newer community report overrides an older simulated one', () => {
  const r = computeAtmStatus(
    [report(STATUS.AVAILABLE, 40, SOURCE.SIMULATED), report(STATUS.UNAVAILABLE, 3)],
    opts
  );
  assert.equal(r.status, STATUS.UNAVAILABLE);
  assert.equal(r.source, SOURCE.COMMUNITY);
});

test('one community report is LOW reliability', () => {
  const r = computeAtmStatus([report(STATUS.AVAILABLE, 5)], opts);
  assert.equal(r.reliability, RELIABILITY.LOW);
  assert.equal(r.supportingReports, 1);
});

test('two agreeing community reports are MEDIUM reliability', () => {
  const r = computeAtmStatus([report(STATUS.AVAILABLE, 5), report(STATUS.AVAILABLE, 20)], opts);
  assert.equal(r.reliability, RELIABILITY.MEDIUM);
  assert.equal(r.supportingReports, 2);
});

test('three agreeing community reports are HIGH reliability', () => {
  const r = computeAtmStatus(
    [report(STATUS.UNAVAILABLE, 5), report(STATUS.UNAVAILABLE, 15), report(STATUS.UNAVAILABLE, 25)],
    opts
  );
  assert.equal(r.reliability, RELIABILITY.HIGH);
  assert.equal(r.supportingReports, 3);
  assert.equal(r.contradictingReports, 0);
});

test('a contradicting report blocks HIGH and is counted', () => {
  const r = computeAtmStatus(
    [
      report(STATUS.AVAILABLE, 5),
      report(STATUS.AVAILABLE, 15),
      report(STATUS.AVAILABLE, 25),
      report(STATUS.UNAVAILABLE, 35),
    ],
    opts
  );
  assert.equal(r.status, STATUS.AVAILABLE);
  assert.equal(r.reliability, RELIABILITY.MEDIUM);
  assert.equal(r.contradictingReports, 1);
});

test('latest report outnumbered by older contradicting ones is LOW', () => {
  const r = computeAtmStatus(
    [report(STATUS.UNAVAILABLE, 2), report(STATUS.AVAILABLE, 10), report(STATUS.AVAILABLE, 20)],
    opts
  );
  assert.equal(r.status, STATUS.UNAVAILABLE);
  assert.equal(r.reliability, RELIABILITY.LOW);
  assert.equal(r.supportingReports, 1);
  assert.equal(r.contradictingReports, 2);
});

test('expired community reports do not count towards reliability', () => {
  const r = computeAtmStatus(
    [report(STATUS.AVAILABLE, 5), report(STATUS.AVAILABLE, 90), report(STATUS.AVAILABLE, 120)],
    opts
  );
  assert.equal(r.supportingReports, 1);
  assert.equal(r.reliability, RELIABILITY.LOW);
});

test('reports dated far in the future are ignored', () => {
  const future = { status: STATUS.AVAILABLE, source: SOURCE.COMMUNITY, reportedAt: ago(-30) };
  const r = computeAtmStatus([future], opts);
  assert.equal(r.status, STATUS.UNKNOWN);
});

test('small clock skew into the future is tolerated', () => {
  const skewed = { status: STATUS.AVAILABLE, source: SOURCE.COMMUNITY, reportedAt: ago(-0.5) };
  const r = computeAtmStatus([skewed], opts);
  assert.equal(r.status, STATUS.AVAILABLE);
});

test('malformed reports are ignored without throwing', () => {
  const bad = [
    null,
    undefined,
    {},
    { status: 'MAYBE', source: SOURCE.COMMUNITY, reportedAt: ago(1) },
    { status: STATUS.AVAILABLE, source: 'rumour', reportedAt: ago(1) },
    { status: STATUS.AVAILABLE, source: SOURCE.COMMUNITY, reportedAt: 'not a date' },
    { status: STATUS.AVAILABLE, source: SOURCE.COMMUNITY, reportedAt: null },
    { status: STATUS.UNKNOWN, source: SOURCE.COMMUNITY, reportedAt: ago(1) },
  ];
  const r = computeAtmStatus(bad, opts);
  assert.equal(r.status, STATUS.UNKNOWN);
});

test('identical timestamps resolve deterministically (community, then UNAVAILABLE)', () => {
  const sim = report(STATUS.AVAILABLE, 5, SOURCE.SIMULATED);
  const comm = report(STATUS.UNAVAILABLE, 5, SOURCE.COMMUNITY);
  assert.equal(computeAtmStatus([sim, comm], opts).status, STATUS.UNAVAILABLE);
  assert.equal(computeAtmStatus([comm, sim], opts).status, STATUS.UNAVAILABLE);

  const a = report(STATUS.AVAILABLE, 5);
  const u = report(STATUS.UNAVAILABLE, 5);
  assert.equal(computeAtmStatus([a, u], opts).status, STATUS.UNAVAILABLE);
  assert.equal(computeAtmStatus([u, a], opts).status, STATUS.UNAVAILABLE);
});

test('does not mutate its input', () => {
  const input = [report(STATUS.AVAILABLE, 30), report(STATUS.UNAVAILABLE, 5)];
  const snapshot = JSON.stringify(input);
  computeAtmStatus(input, opts);
  assert.equal(JSON.stringify(input), snapshot);
});

test('same inputs always give the same result (no hidden state, language or theme input)', () => {
  const input = [report(STATUS.AVAILABLE, 12), report(STATUS.AVAILABLE, 30)];
  const first = computeAtmStatus(input, opts);
  const second = computeAtmStatus(input, opts);
  assert.deepEqual(first, second);
});

test('invalid validity or date arguments throw', () => {
  assert.throws(() => computeAtmStatus([], { now: NOW }), TypeError);
  assert.throws(() => computeAtmStatus([], { now: NOW, validityMs: 0 }), TypeError);
  assert.throws(() => computeAtmStatus([], { now: NOW, validityMs: -5 }), TypeError);
  assert.throws(() => computeAtmStatus([], { now: 'nope', validityMs: HOUR }), TypeError);
});
