// Central translation layer. All visible text comes from /locales/<lang>.json.
// The chosen language is stored in localStorage and never affects API data.

export const SUPPORTED_LANGUAGES = ['en', 'te', 'hi'];
const DEFAULT_LANGUAGE = 'en';
const STORAGE_KEY = 'atmradar.lang';
const LOCALE_TAGS = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };

// Native names are always shown in their own script so people can find their language
export const LANGUAGE_NAMES = Object.freeze({ en: 'English', te: '\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41', hi: '\u0939\u093F\u0928\u094D\u0926\u0940' });

const dictionaries = {};
const listeners = new Set();
let current = DEFAULT_LANGUAGE;

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    return null;
  }
}

function writeStored(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch (err) {
    // Storage can be blocked. The language still works for this visit.
  }
}

async function loadDictionary(lang) {
  if (dictionaries[lang]) return;
  const response = await fetch(`/locales/${lang}.json`);
  if (!response.ok) throw new Error(`Could not load ${lang} translations`);
  dictionaries[lang] = await response.json();
}

function lookup(dictionary, key) {
  if (!dictionary) return undefined;
  let node = dictionary;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function find(key) {
  const value = lookup(dictionaries[current], key);
  return value !== undefined ? value : lookup(dictionaries[DEFAULT_LANGUAGE], key);
}

export function getLanguage() {
  return current;
}

export function getLocaleTag() {
  return LOCALE_TAGS[current] || LOCALE_TAGS[DEFAULT_LANGUAGE];
}

export function t(key, params) {
  let value;

  if (params && params.count !== undefined) {
    const rule = new Intl.PluralRules(getLocaleTag()).select(Number(params.count));
    value = find(`${key}_${rule}`);
    if (value === undefined) value = find(`${key}_other`);
  }
  if (value === undefined) value = find(key);
  if (value === undefined) return key;

  return value.replace(/\{(\w+)\}/g, (match, name) =>
    params && Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  );
}

// Shows (or clears) an error message from a machine code. The code is kept on the
// element so the message is translated again when the language changes.
export function showErrorCode(node, code) {
  if (code) {
    node.dataset.errorCode = code;
    node.textContent = t(`errors.${code}`);
  } else {
    delete node.dataset.errorCode;
    node.textContent = '';
  }
}

export function applyTranslations(root = document) {
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll('[data-error-code]')) {
    node.textContent = t(`errors.${node.dataset.errorCode}`);
  }
  for (const node of root.querySelectorAll('[data-i18n-placeholder]')) {
    node.setAttribute('placeholder', t(node.dataset.i18nPlaceholder));
  }
  for (const node of root.querySelectorAll('[data-i18n-aria-label]')) {
    node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel));
  }
  for (const node of root.querySelectorAll('[data-i18n-title]')) {
    node.setAttribute('title', t(node.dataset.i18nTitle));
  }
}

function applyDocumentSettings() {
  document.documentElement.lang = current;
  const data = (document.body && document.body.dataset) || {};
  document.title = t(data.titleKey || 'meta.title');
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', t(data.descriptionKey || 'meta.description'));
}

export async function initI18n() {
  const stored = readStored();
  const wanted = SUPPORTED_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE;

  await loadDictionary(DEFAULT_LANGUAGE);
  current = DEFAULT_LANGUAGE;

  if (wanted !== DEFAULT_LANGUAGE) {
    try {
      await loadDictionary(wanted);
      current = wanted;
    } catch (err) {
      current = DEFAULT_LANGUAGE;
    }
  }

  applyDocumentSettings();
  applyTranslations(document);
}

export async function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang) || lang === current) return;

  await loadDictionary(lang);
  current = lang;
  writeStored(lang);

  applyDocumentSettings();
  applyTranslations(document);
  for (const listener of listeners) listener(lang);
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
