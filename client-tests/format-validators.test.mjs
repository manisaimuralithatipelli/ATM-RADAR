import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClientModule, installBrowserStubs } from './load-modules.mjs';

test('distance and relative time formatting', async () => {
  installBrowserStubs();
  const i18n = await loadClientModule('i18n.js');
  const format = await loadClientModule('format.js');
  await i18n.initI18n();

  assert.match(format.formatDistance(450), /450/);
  assert.match(format.formatDistance(2400), /2\.4/);

  const now = Date.parse('2026-10-26T10:00:00Z');
  assert.match(format.formatRelativeTime('2026-10-26T09:48:00Z', now), /12 minutes ago/);
  assert.match(format.formatRelativeTime('2026-10-26T09:59:50Z', now), /now/);
  assert.match(format.formatRelativeTime('2026-10-26T07:00:00Z', now), /3 hours ago/);
  assert.ok(format.formatDateTime('2026-10-26T10:00:00Z').length > 5);
});

test('client validators return the same codes as the server', async () => {
  const v = await loadClientModule('validators.js');

  assert.equal(v.validateEmail(''), 'EMAIL_REQUIRED');
  assert.equal(v.validateEmail('nope'), 'INVALID_EMAIL');
  assert.equal(v.validateEmail('a@b.co'), null);
  assert.equal(v.validateEmail('a'.repeat(250) + '@b.co'), 'EMAIL_TOO_LONG');

  assert.equal(v.validateName(' '), 'NAME_REQUIRED');
  assert.equal(v.validateName('A'), 'NAME_TOO_SHORT');
  assert.equal(v.validateName('Murali'), null);
  assert.equal(v.validateName('x'.repeat(61)), 'NAME_TOO_LONG');

  assert.equal(v.validateNewPassword(''), 'PASSWORD_REQUIRED');
  assert.equal(v.validateNewPassword('abc12'), 'PASSWORD_TOO_SHORT');
  assert.equal(v.validateNewPassword('12345678'), 'PASSWORD_NEEDS_LETTER');
  assert.equal(v.validateNewPassword('abcdefgh'), 'PASSWORD_NEEDS_NUMBER');
  assert.equal(v.validateNewPassword('abcdefg1'), null);
  assert.equal(v.validateNewPassword('a1' + 'x'.repeat(80)), 'PASSWORD_TOO_LONG');

  assert.equal(v.validateExistingPassword(''), 'PASSWORD_REQUIRED');
  assert.equal(v.validateExistingPassword('x'), null);

  assert.equal(v.validatePincode(''), null);
  assert.equal(v.validatePincode('50600'), 'INVALID_PINCODE');
  assert.equal(v.validatePincode('5060011'), 'INVALID_PINCODE');
  assert.equal(v.validatePincode('50600a'), 'INVALID_PINCODE');
  assert.equal(v.validatePincode('506001'), null);
});
