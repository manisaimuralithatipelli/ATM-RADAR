'use strict';

const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

async function connectDb() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}

module.exports = { connectDb };
