'use strict';

const mongoose = require('mongoose');

const atmSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    bank: { type: String, required: true, trim: true, maxlength: 60, index: true },
    area: { type: String, required: true, trim: true, maxlength: 60, index: true },
    address: { type: String, required: true, trim: true, maxlength: 200 },
    pincode: { type: String, required: true, match: /^\d{6}$/, index: true },
    location: {
      type: { type: String, enum: ['Point'], required: true, default: 'Point' },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (c) =>
            Array.isArray(c) &&
            c.length === 2 &&
            c[0] >= -180 &&
            c[0] <= 180 &&
            c[1] >= -90 &&
            c[1] <= 90,
          message: 'coordinates must be [longitude, latitude]',
        },
      },
    },
    // True for the sample records. Real ATM data would set this to false.
    isSimulated: { type: Boolean, default: true },
  },
  { timestamps: true }
);

atmSchema.index({ location: '2dsphere' });
atmSchema.index({ name: 1, pincode: 1 }, { unique: true });

module.exports = mongoose.model('Atm', atmSchema);
