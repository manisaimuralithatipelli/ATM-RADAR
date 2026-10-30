'use strict';

require('dotenv').config();
const { z } = require('zod');

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  REPORT_VALIDITY_MINUTES: z.coerce.number().int().min(1).max(1440).default(60),
  HISTORY_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  REPORT_COOLDOWN_MINUTES: z.coerce.number().int().min(0).max(120).default(10),
  SIMULATOR_ENABLED: bool,
  SIMULATOR_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(240).default(15),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;
env.isProd = env.NODE_ENV === 'production';
env.validityMs = env.REPORT_VALIDITY_MINUTES * 60 * 1000;
env.historyMs = Math.max(env.HISTORY_HOURS * 3600 * 1000, env.validityMs);

module.exports = Object.freeze(env);
