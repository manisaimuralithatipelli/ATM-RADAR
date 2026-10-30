'use strict';

const mongoose = require('mongoose');
const env = require('./config/env');
const { connectDb } = require('./config/db');
const { createApp } = require('./app');
const { startSimulator } = require('./services/simulator');

async function main() {
  await connectDb();
  console.log('MongoDB connected');

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`ATM RADAR running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  if (env.SIMULATOR_ENABLED) startSimulator();

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
