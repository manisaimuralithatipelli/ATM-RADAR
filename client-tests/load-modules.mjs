// Copies public/js into a temp folder marked as ES modules so Node can import
// the same files the browser runs, without changing how the site serves them.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, '..', 'public');

export const localesDir = path.join(publicDir, 'locales');

export async function loadClientModule(name) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atmradar-client-'));
  fs.cpSync(path.join(publicDir, 'js'), path.join(tmp, 'js'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  return import(pathToFileURL(path.join(tmp, 'js', name)).href);
}

export function installBrowserStubs({ extraDictionaries = {}, storage = {} } = {}) {
  const store = { ...storage };
  const fetchLog = [];

  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
  };

  globalThis.document = {
    documentElement: { lang: '' },
    title: '',
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  globalThis.fetch = async (url) => {
    fetchLog.push(url);
    const match = /\/locales\/(\w+)\.json$/.exec(url);
    const lang = match && match[1];
    let data = extraDictionaries[lang];
    if (!data && lang === 'en') data = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
    if (!data) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => data };
  };

  return { store, fetchLog };
}
