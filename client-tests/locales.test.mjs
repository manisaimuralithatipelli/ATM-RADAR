import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { localesDir } from './load-modules.mjs';

const LANGS = ['en', 'te', 'hi'];
const SCRIPT = { te: /[\u0C00-\u0C7F]/, hi: /[\u0900-\u097F]/ };
// These strings are allowed to have no native-script letters (brand name, template, example data)
const SCRIPT_EXEMPT = new Set(['brand.name', 'results.reportedAgo', 'footer.github', 'footer.linkedin']);

function flatten(object, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(object)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') Object.assign(out, flatten(value, full));
    else out[full] = value;
  }
  return out;
}

const dictionaries = Object.fromEntries(
  LANGS.map((lang) => [lang, flatten(JSON.parse(fs.readFileSync(path.join(localesDir, `${lang}.json`), 'utf8')))])
);

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

for (const lang of ['te', 'hi']) {
  test(`${lang}: has exactly the same keys as English`, () => {
    assert.deepEqual(Object.keys(dictionaries[lang]).sort(), Object.keys(dictionaries.en).sort());
  });

  test(`${lang}: every value is a non-empty string with the same placeholders as English`, () => {
    for (const [key, value] of Object.entries(dictionaries[lang])) {
      assert.equal(typeof value, 'string', key);
      assert.ok(value.trim().length > 0, `${key} is empty`);
      assert.equal(placeholders(value), placeholders(dictionaries.en[key]), `${key} placeholders differ`);
    }
  });

  test(`${lang}: translated text uses the native script (nothing left in English)`, () => {
    for (const [key, value] of Object.entries(dictionaries[lang])) {
      if (SCRIPT_EXEMPT.has(key)) continue;
      assert.match(value, SCRIPT[lang], `${key} has no ${lang} script: ${value}`);
    }
  });

  test(`${lang}: the three statuses are distinct and consistent`, () => {
    const values = ['AVAILABLE', 'UNAVAILABLE', 'UNKNOWN'].map((s) => dictionaries[lang][`status.${s}`]);
    assert.equal(new Set(values).size, 3);
  });
}

test('all languages: plural keys come in one and other pairs', () => {
  for (const lang of LANGS) {
    const keys = Object.keys(dictionaries[lang]);
    for (const key of keys.filter((k) => k.endsWith('_one'))) {
      assert.ok(keys.includes(key.replace(/_one$/, '_other')), `${lang}: ${key} has no _other`);
    }
    for (const key of keys.filter((k) => k.endsWith('_other'))) {
      assert.ok(keys.includes(key.replace(/_other$/, '_one')), `${lang}: ${key} has no _one`);
    }
  }
});

test('all languages: no em dashes or en dashes', () => {
  for (const lang of LANGS) {
    for (const [key, value] of Object.entries(dictionaries[lang])) {
      assert.doesNotMatch(value, /[\u2013\u2014]/, `${lang}.${key}`);
    }
  }
});

test('the brand name is identical in every language', () => {
  assert.equal(dictionaries.te['brand.name'], 'ATM RADAR');
  assert.equal(dictionaries.hi['brand.name'], 'ATM RADAR');
  assert.equal(dictionaries.en['brand.name'], 'ATM RADAR');
});

test('every error code the server can send has a translation in every language', () => {
  const codes = [
    'VALIDATION_ERROR', 'AUTH_REQUIRED', 'INVALID_CREDENTIALS', 'EMAIL_TAKEN', 'REPORT_COOLDOWN',
    'RATE_LIMITED', 'NETWORK_ERROR', 'INTERNAL_ERROR', 'ATM_NOT_FOUND', 'NOT_FOUND',
  ];
  for (const lang of LANGS) for (const code of codes) assert.ok(dictionaries[lang][`errors.${code}`], `${lang} ${code}`);
});
