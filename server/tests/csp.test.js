'use strict';

// Regression test: the map must be allowed to load its tiles under the page's
// Content Security Policy. A wildcard source such as *.example.com does not
// match example.com itself, which once left the map blank with markers only.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const mapSource = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'map.js'), 'utf8');

function imgSources() {
  const block = /imgSrc:\s*\[([\s\S]*?)\]/.exec(appSource);
  assert.ok(block, 'imgSrc directive not found in app.js');
  // The block is a plain JavaScript array literal, so evaluate it in an empty sandbox
  return vm.runInNewContext(`[${block[1]}]`).map((source) => source.replace(/^'|'$/g, ''));
}

// CSP host-source matching: exact host, or *.host which needs at least one extra label
function allowed(sources, url) {
  const { protocol, hostname } = new URL(url);
  return sources.some((source) => {
    if (source === 'self' || source === 'data:') return false;
    const m = /^(https?:)\/\/(\*\.)?([^/:]+)$/.exec(source);
    if (!m) return false;
    if (m[1] !== protocol) return false;
    if (m[2]) return hostname.endsWith(`.${m[3]}`);
    return hostname === m[3];
  });
}

test('the CSP matcher itself follows the spec (wildcard does not match the bare host)', () => {
  assert.equal(allowed(['https://*.example.com'], 'https://example.com/a.png'), false);
  assert.equal(allowed(['https://*.example.com'], 'https://a.example.com/a.png'), true);
  assert.equal(allowed(['https://example.com'], 'https://example.com/a.png'), true);
});

test('the tile URL used by the map is allowed by the img-src policy', () => {
  const tileTemplate = /TILE_URL\s*=\s*'([^']+)'/.exec(mapSource);
  assert.ok(tileTemplate, 'TILE_URL not found in map.js');
  const sample = tileTemplate[1].replace('{s}', 'a').replace('{z}', '13').replace('{x}', '5900').replace('{y}', '3700');
  assert.ok(allowed(imgSources(), sample), `tile URL ${sample} is blocked by img-src: ${imgSources().join(' ')}`);
});

test('subdomain tile hosts are also allowed', () => {
  assert.ok(allowed(imgSources(), 'https://a.tile.openstreetmap.org/13/1/1.png'));
});
