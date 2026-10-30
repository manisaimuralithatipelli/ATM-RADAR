// Theme state. The first value is set by /js/theme-init.js before paint;
// this module keeps it in sync, saves explicit choices, and notifies listeners.

const STORAGE_KEY = 'atmradar.theme';
const THEME_COLORS = { light: '#ffffff', dark: '#151d27' };
const listeners = new Set();
let watching = false;

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch (err) {
    return null;
  }
}

function writeStored(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (err) {
    // The choice still applies until the page is closed
  }
}

function systemPrefersDark() {
  try {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch (err) {
    return false;
  }
}

export function getTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  return current === 'dark' ? 'dark' : 'light';
}

function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
  for (const listener of listeners) listener(theme);
}

// Called by the toggle. This is an explicit choice, so it is saved.
export function setTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') return;
  writeStored(theme);
  if (theme !== getTheme()) apply(theme);
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

export function onThemeChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initTheme() {
  // Make sure the attribute matches saved or system state even if the early script was blocked
  const wanted = readStored() || (systemPrefersDark() ? 'dark' : 'light');
  if (wanted !== getTheme()) apply(wanted);
  else {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[wanted]);
  }

  // Follow operating system changes only while the user has not chosen a theme
  if (!watching && window.matchMedia) {
    try {
      const query = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = (event) => {
        if (readStored()) return;
        const next = event.matches ? 'dark' : 'light';
        if (next !== getTheme()) apply(next);
      };
      if (query.addEventListener) query.addEventListener('change', onChange);
      else if (query.addListener) query.addListener(onChange);
      watching = true;
    } catch (err) {
      // Not supported: the theme simply will not follow the system while the page is open
    }
  }
}
