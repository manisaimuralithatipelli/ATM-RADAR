'use strict';

/**
 * SIMULATED sample ATM records for the Warangal area.
 * These are NOT real ATM listings and the coordinates and PIN codes are
 * approximate placeholders. Verify or replace them before any real use.
 *
 * Coordinates are [longitude, latitude].
 */

const AREAS = {
  Hanamkonda: { pincode: '506001', lat: 17.999, lng: 79.553 },
  Subedari: { pincode: '506001', lat: 17.9935, lng: 79.5615 },
  'Station Road': { pincode: '506002', lat: 17.9784, lng: 79.6006 },
  'Mulugu Road': { pincode: '506002', lat: 17.989, lng: 79.606 },
  Kazipet: { pincode: '506003', lat: 17.9748, lng: 79.5107 },
  'Kakatiya University': { pincode: '506009', lat: 18.017, lng: 79.556 },
};

// [bank, area, latitude offset, longitude offset]
const ROWS = [
  ['State Bank of India', 'Hanamkonda', 0.0, 0.0],
  ['HDFC Bank', 'Hanamkonda', 0.0021, 0.0034],
  ['Canara Bank', 'Subedari', 0.0004, -0.0012],
  ['Union Bank of India', 'Subedari', -0.0018, 0.0021],
  ['ICICI Bank', 'Station Road', 0.001, -0.0015],
  ['Axis Bank', 'Station Road', -0.0013, 0.0019],
  ['Bank of Baroda', 'Mulugu Road', 0.0006, 0.001],
  ['Indian Bank', 'Mulugu Road', -0.0016, -0.0008],
  ['State Bank of India', 'Kazipet', 0.0008, 0.0006],
  ['Punjab National Bank', 'Kazipet', -0.0014, 0.0017],
  ['HDFC Bank', 'Kazipet', 0.0019, -0.0013],
  ['State Bank of India', 'Kakatiya University', 0.0003, 0.0004],
  ['Canara Bank', 'Kakatiya University', -0.0012, 0.0016],
  ['Axis Bank', 'Hanamkonda', -0.0017, -0.0021],
  ['ICICI Bank', 'Subedari', 0.0015, 0.0007],
  ['Union Bank of India', 'Station Road', 0.0022, 0.0011],
];

const atms = ROWS.map(([bank, area, dLat, dLng], index) => {
  const base = AREAS[area];
  const number = String(index + 1).padStart(2, '0');
  return {
    name: `${bank} ATM, ${area} (Sample ${number})`,
    bank,
    area,
    address: `Sample location in the ${area} area, Warangal`,
    pincode: base.pincode,
    location: {
      type: 'Point',
      coordinates: [Number((base.lng + dLng).toFixed(5)), Number((base.lat + dLat).toFixed(5))],
    },
    isSimulated: true,
  };
});

module.exports = atms;
