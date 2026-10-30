import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClientModule, installBrowserStubs } from './load-modules.mjs';

const teDictionary = {
  nav: { home: 'హోమ్' },
  status: { AVAILABLE: 'అందుబాటులో ఉంది' },
  results: { count_one: '{count} ఏటీఎం', count_other: '{count} ఏటీఎంలు' },
};

test('English text, parameters, and plurals', async () => {
  installBrowserStubs();
  const i18n = await loadClientModule('i18n.js');
  await i18n.initI18n();

  assert.equal(i18n.getLanguage(), 'en');
  assert.equal(i18n.t('nav.home'), 'Home');
  assert.equal(i18n.t('auth.welcome', { name: 'Murali' }), 'Welcome, Murali.');
  assert.equal(i18n.t('results.count', { count: 1 }), '1 ATM found');
  assert.equal(i18n.t('results.count', { count: 5 }), '5 ATMs found');
  assert.equal(i18n.t('results.count', { count: 0 }), '0 ATMs found');
  assert.equal(i18n.t('does.not.exist'), 'does.not.exist');
  assert.equal(document.documentElement.lang, 'en');
});

test('a missing placeholder value is left visible rather than hidden', async () => {
  installBrowserStubs();
  const i18n = await loadClientModule('i18n.js');
  await i18n.initI18n();
  assert.equal(i18n.t('auth.welcome', {}), 'Welcome, {name}.');
});

test('switching language updates text, falls back to English for gaps, and notifies listeners', async () => {
  const { store } = installBrowserStubs({ extraDictionaries: { te: teDictionary } });
  const i18n = await loadClientModule('i18n.js');
  await i18n.initI18n();

  let notified = null;
  i18n.onLanguageChange((lang) => (notified = lang));

  await i18n.setLanguage('te');
  assert.equal(i18n.getLanguage(), 'te');
  assert.equal(notified, 'te');
  assert.equal(document.documentElement.lang, 'te');
  assert.equal(i18n.t('nav.home'), 'హోమ్');
  assert.equal(i18n.t('results.count', { count: 3 }), '3 ఏటీఎంలు');
  // Not translated yet in the test dictionary: English is used instead of a blank
  assert.equal(i18n.t('nav.login'), 'Log in');
  assert.equal(store['atmradar.lang'], 'te');
});

test('the saved language is restored after a refresh', async () => {
  installBrowserStubs({ extraDictionaries: { te: teDictionary }, storage: { 'atmradar.lang': 'te' } });
  const i18n = await loadClientModule('i18n.js');
  await i18n.initI18n();
  assert.equal(i18n.getLanguage(), 'te');
  assert.equal(i18n.t('nav.home'), 'హోమ్');
});

test('an unknown saved language falls back to English', async () => {
  installBrowserStubs({ storage: { 'atmradar.lang': 'fr' } });
  const i18n = await loadClientModule('i18n.js');
  await i18n.initI18n();
  assert.equal(i18n.getLanguage(), 'en');
});

test('a saved language whose file cannot load falls back to English', async () => {
  installBrowserStubs({ storage: { 'atmradar.lang': 'hi' } });
  const i18n = await loadClientModule('i18n.js');
  await i18n.initI18n();
  assert.equal(i18n.getLanguage(), 'en');
  assert.equal(i18n.t('nav.home'), 'Home');
});

test('blocked localStorage does not break the language switch', async () => {
  installBrowserStubs({ extraDictionaries: { te: teDictionary } });
  globalThis.localStorage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  const i18n = await loadClientModule('i18n.js');
  await i18n.initI18n();
  await i18n.setLanguage('te');
  assert.equal(i18n.getLanguage(), 'te');
});

test('setting an unsupported language is ignored', async () => {
  installBrowserStubs();
  const i18n = await loadClientModule('i18n.js');
  await i18n.initI18n();
  await i18n.setLanguage('xx');
  assert.equal(i18n.getLanguage(), 'en');
});
