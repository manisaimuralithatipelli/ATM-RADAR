import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { loadClientModule } from './load-modules.mjs';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

function setup({ systemDark = false, stored = null, storageBlocked = false } = {}) {
  const attrs = {};
  const metaAttrs = { content: '' };
  const store = stored ? { 'atmradar.theme': stored } : {};
  const mediaListeners = [];
  const media = {
    matches: systemDark,
    addEventListener: (type, fn) => mediaListeners.push(fn),
  };

  globalThis.localStorage = storageBlocked
    ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }
    : { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };

  globalThis.window = { matchMedia: () => media };
  globalThis.document = {
    documentElement: {
      getAttribute: (k) => (k in attrs ? attrs[k] : null),
      setAttribute: (k, v) => { attrs[k] = v; },
    },
    querySelector: (sel) => (sel === 'meta[name="theme-color"]' ? { setAttribute: (k, v) => { metaAttrs[k] = v; } } : null),
  };

  return {
    attrs, store, metaAttrs,
    systemChange(dark) { media.matches = dark; mediaListeners.forEach((fn) => fn({ matches: dark })); },
  };
}

function runInitScript(env) {
  const code = fs.readFileSync(path.join(publicDir, 'js', 'theme-init.js'), 'utf8');
  vm.runInNewContext(code, { document: globalThis.document, window: globalThis.window, localStorage: globalThis.localStorage });
  return env.attrs['data-theme'];
}

test('init script: first visit follows the operating system', () => {
  assert.equal(runInitScript(setup({ systemDark: true })), 'dark');
  assert.equal(runInitScript(setup({ systemDark: false })), 'light');
});

test('init script: a saved choice beats the operating system', () => {
  assert.equal(runInitScript(setup({ systemDark: true, stored: 'light' })), 'light');
  assert.equal(runInitScript(setup({ systemDark: false, stored: 'dark' })), 'dark');
});

test('init script: an invalid saved value is ignored', () => {
  assert.equal(runInitScript(setup({ systemDark: true, stored: 'purple' })), 'dark');
});

test('init script: blocked storage falls back to the system preference', () => {
  assert.equal(runInitScript(setup({ systemDark: true, storageBlocked: true })), 'dark');
  assert.equal(runInitScript(setup({ systemDark: false, storageBlocked: true })), 'light');
});

test('init script: works when matchMedia does not exist', () => {
  const env = setup();
  delete globalThis.window.matchMedia;
  assert.equal(runInitScript(env), 'light');
});

test('toggle switches theme, saves the choice, and notifies listeners', async () => {
  const env = setup({ systemDark: false });
  const theme = await loadClientModule('theme.js');
  runInitScript(env);
  theme.initTheme();

  const seen = [];
  theme.onThemeChange((t) => seen.push(t));

  assert.equal(theme.getTheme(), 'light');
  theme.toggleTheme();
  assert.equal(theme.getTheme(), 'dark');
  assert.equal(env.store['atmradar.theme'], 'dark');
  assert.equal(env.metaAttrs.content, '#151d27');
  theme.toggleTheme();
  assert.equal(theme.getTheme(), 'light');
  assert.equal(env.store['atmradar.theme'], 'light');
  assert.equal(env.metaAttrs.content, '#ffffff');
  assert.deepEqual(seen, ['dark', 'light']);
});

test('follows system changes only until the user makes a choice', async () => {
  const env = setup({ systemDark: false });
  const theme = await loadClientModule('theme.js');
  runInitScript(env);
  theme.initTheme();

  env.systemChange(true);
  assert.equal(theme.getTheme(), 'dark');
  env.systemChange(false);
  assert.equal(theme.getTheme(), 'light');

  theme.setTheme('dark'); // explicit choice
  env.systemChange(false);
  assert.equal(theme.getTheme(), 'dark', 'saved choice must not be overridden by the system');
});

test('initTheme repairs the attribute if the early script was blocked', async () => {
  const env = setup({ systemDark: true });
  const theme = await loadClientModule('theme.js');
  // early script did not run, so no data-theme yet
  theme.initTheme();
  assert.equal(env.attrs['data-theme'], 'dark');
});

test('works with blocked storage: toggle still changes the theme for this visit', async () => {
  const env = setup({ systemDark: false, storageBlocked: true });
  const theme = await loadClientModule('theme.js');
  runInitScript(env);
  theme.initTheme();
  theme.toggleTheme();
  assert.equal(theme.getTheme(), 'dark');
});

test('setting an unknown theme does nothing', async () => {
  const env = setup();
  const theme = await loadClientModule('theme.js');
  runInitScript(env);
  theme.setTheme('sepia');
  assert.equal(theme.getTheme(), 'light');
  assert.equal(env.store['atmradar.theme'], undefined);
});

test('the init script is a blocking script in <head> before any stylesheet', () => {
  const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const tag = html.match(/<script src="\/js\/theme-init\.js"([^>]*)><\/script>/);
  assert.ok(tag, 'theme-init.js is loaded');
  assert.doesNotMatch(tag[1], /defer|async|module/, 'must block rendering');
  assert.ok(html.indexOf('theme-init.js') < html.indexOf('rel="stylesheet"'), 'must come before stylesheets');
  assert.ok(html.indexOf('theme-init.js') < html.indexOf('</head>'));
});
