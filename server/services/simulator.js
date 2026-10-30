'use strict';

/**
 * Demo data only. Writes simulated reports for ATMs that currently have no
 * valid report. These are NOT live bank data and are labelled source=simulated.
 */

const Atm = require('../models/Atm');
const Report = require('../models/Report');
const env = require('../config/env');

const SKIP_CHANCE = 0.2; // leave some ATMs UNKNOWN so that state is visible
const AVAILABLE_CHANCE = 0.7; // of the rest
const MAX_AGE_MINUTES = 20; // keeps each simulated report valid for a good while

async function runSimulation({ now = new Date(), random = Math.random } = {}) {
  const windowStart = new Date(now.getTime() - env.validityMs);

  const [atmIds, coveredIds] = await Promise.all([
    Atm.find({ isSimulated: true }).distinct('_id'),
    Report.distinct('atm', { reportedAt: { $gt: windowStart } }),
  ]);

  const covered = new Set(coveredIds.map(String));
  const docs = [];

  for (const id of atmIds) {
    if (covered.has(String(id))) continue;
    if (random() < SKIP_CHANCE) continue;

    docs.push({
      atm: id,
      user: null,
      source: 'simulated',
      status: random() < AVAILABLE_CHANCE ? 'AVAILABLE' : 'UNAVAILABLE',
      reportedAt: new Date(now.getTime() - Math.floor(random() * MAX_AGE_MINUTES) * 60 * 1000),
    });
  }

  if (docs.length > 0) await Report.insertMany(docs);
  return { created: docs.length, atmCount: atmIds.length };
}

function startSimulator() {
  const run = () =>
    runSimulation()
      .then((r) => console.log(`[simulator] created ${r.created} simulated reports`))
      .catch((err) => console.error('[simulator] failed:', err.message));

  run();
  const timer = setInterval(run, env.SIMULATOR_INTERVAL_MINUTES * 60 * 1000);
  timer.unref();
  return timer;
}

module.exports = { runSimulation, startSimulator };
