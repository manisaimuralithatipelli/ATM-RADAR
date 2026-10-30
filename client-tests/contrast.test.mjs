import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const css = fs.readFileSync(path.join(publicDir, 'css', 'theme.css'), 'utf8');

function parseBlock(source) {
  const vars = {};
  for (const m of source.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

const light = parseBlock(css.match(/:root\s*\{([\s\S]*?)\n\}/)[1]);
const darkOverrides = parseBlock(css.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)[1]);
const dark = { ...light, ...darkOverrides };

function luminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum ratio, what it is]
const TEXT = 4.5;
const UI = 3;
const PAIRS = [
  ['text', 'bg', TEXT, 'body text on page'],
  ['text', 'surface', TEXT, 'text on cards'],
  ['text', 'surface-2', TEXT, 'text on hover areas'],
  ['text-muted', 'bg', TEXT, 'muted text on page'],
  ['text-muted', 'surface', TEXT, 'muted text on cards'],
  ['text-muted', 'surface-2', TEXT, 'muted text on tinted areas'],
  ['on-brand', 'brand', TEXT, 'primary button text'],
  ['on-brand', 'brand-strong', TEXT, 'primary button text on hover'],
  ['brand-strong', 'surface', TEXT, 'links and active nav on cards'],
  ['brand-strong', 'bg', TEXT, 'links on page'],
  ['brand-strong', 'surface-2', TEXT, 'quiet button hover'],
  ['danger-text', 'surface', TEXT, 'error text on cards'],
  ['danger-text', 'bg', TEXT, 'error text on page'],
  ['available-fg', 'available-bg', TEXT, 'Available badge and report button'],
  ['unavailable-fg', 'unavailable-bg', TEXT, 'Unavailable badge and report button'],
  ['unknown-fg', 'unknown-bg', TEXT, 'Unknown badge'],
  ['toast-text', 'toast-bg', TEXT, 'notification text'],
  ['focus', 'surface', UI, 'keyboard focus ring on cards'],
  ['focus', 'bg', UI, 'keyboard focus ring on page'],
  ['focus', 'surface-2', UI, 'keyboard focus ring on tinted areas'],
  ['border-strong', 'surface', UI, 'input borders'],
  ['border-strong', 'bg', UI, 'control borders on page'],
  ['brand', 'surface', UI, 'selected card outline and pressed toggle'],
  ['available-border', 'available-bg', UI, 'Available badge border'],
  ['unavailable-border', 'unavailable-bg', UI, 'Unavailable badge border'],
  ['unknown-border', 'unknown-bg', UI, 'Unknown badge border'],
  ['toast-success', 'toast-bg', UI, 'success toast marker'],
  ['toast-error', 'toast-bg', UI, 'error toast marker'],
];

for (const [name, tokens] of [['light', light], ['dark', dark]]) {
  test(`${name} theme: text and control colours meet WCAG AA contrast`, () => {
    const failures = [];
    for (const [fg, bg, min, label] of PAIRS) {
      assert.ok(tokens[fg] && tokens[bg], `missing token ${fg} or ${bg}`);
      const r = ratio(tokens[fg], tokens[bg]);
      if (r < min) failures.push(`${label}: ${fg} on ${bg} is ${r.toFixed(2)}, needs ${min}`);
    }
    assert.deepEqual(failures, []);
  });

  test(`${name} theme: map markers have a visible symbol (white on marker colour)`, () => {
    for (const status of ['available', 'unavailable', 'unknown', 'cluster']) {
      const r = ratio('#ffffff', tokens[`marker-${status}`]);
      assert.ok(r >= UI, `marker ${status} is ${r.toFixed(2)}`);
    }
  });
}

test('the three status colours stay distinguishable from each other in both themes', () => {
  for (const tokens of [light, dark]) {
    const set = new Set(['available', 'unavailable', 'unknown'].map((s) => tokens[`${s}-bg`]));
    assert.equal(set.size, 3);
  }
});

test('dark theme overrides every colour token the light theme defines', () => {
  const colourTokens = Object.keys(light).filter((k) => /^#|^rgba?\(/.test(light[k]) && !k.startsWith('marker-'));
  const missing = colourTokens.filter((k) => !(k in darkOverrides));
  assert.deepEqual(missing, []);
});
