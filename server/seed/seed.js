'use strict';

const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDb } = require('../config/db');
const Atm = require('../models/Atm');
const atms = require('./atms');
const { runSimulation } = require('../services/simulator');

async function main() {
  await connectDb();

  const operations = atms.map((atm) => ({
    updateOne: {
      filter: { name: atm.name, pincode: atm.pincode },
      update: { $set: atm },
      upsert: true,
    },
  }));

  const result = await Atm.bulkWrite(operations);
  console.log(`ATMs: ${result.upsertedCount} added, ${result.modifiedCount} updated`);

  await Atm.syncIndexes();

  const sim = await runSimulation();
  console.log(`Simulated reports created: ${sim.created} (ATMs: ${sim.atmCount})`);
  console.log(`Statuses stay valid for ${env.REPORT_VALIDITY_MINUTES} minutes.`);
}

main()
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
