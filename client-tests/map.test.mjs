import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClientModule } from './load-modules.mjs';

const item = (id, x, y) => ({ id, x, y });
const sizes = (groups) => groups.map((g) => g.length).sort((a, b) => b - a);
const CX = 40;
const CY = 48;

test('pins that would overlap are merged, distant pins stay separate', async () => {
  const { groupByScreenDistance } = await loadClientModule('map.js');
  const groups = groupByScreenDistance([item('a', 0, 0), item('b', 10, 10), item('c', 300, 300)], null);
  assert.deepEqual(sizes(groups), [2, 1]);
});

test('pins side by side but far enough apart in either direction are kept separate', async () => {
  const { groupByScreenDistance } = await loadClientModule('map.js');
  assert.deepEqual(sizes(groupByScreenDistance([item('a', 0, 0), item('b', 40, 0)], null)), [1, 1]);
  assert.deepEqual(sizes(groupByScreenDistance([item('a', 0, 0), item('b', 0, 48)], null)), [1, 1]);
  assert.deepEqual(sizes(groupByScreenDistance([item('a', 0, 0), item('b', 39, 47)], null)), [2]);
});

test('no ATM is lost or duplicated', async () => {
  const { groupByScreenDistance } = await loadClientModule('map.js');
  const items = Array.from({ length: 40 }, (_, i) => item(`id${i}`, (i * 37) % 200, (i * 91) % 200));
  const ids = groupByScreenDistance(items, null).flat().map((m) => m.id).sort();
  assert.deepEqual(ids, items.map((m) => m.id).sort());
});

test('visible pins can never overlap: group anchors are always at least a pin apart', async () => {
  const { groupByScreenDistance } = await loadClientModule('map.js');
  for (let seed = 1; seed <= 25; seed += 1) {
    const items = Array.from({ length: 60 }, (_, i) => item(`id${i}`, (i * 53 * seed) % 500, (i * 29 * seed) % 400));
    const anchors = groupByScreenDistance(items, null).map((g) => g[0]);
    for (let i = 0; i < anchors.length; i += 1) {
      for (let j = i + 1; j < anchors.length; j += 1) {
        const apart = Math.abs(anchors[i].x - anchors[j].x) >= CX || Math.abs(anchors[i].y - anchors[j].y) >= CY;
        assert.ok(apart, `pins overlap for seed ${seed}`);
      }
    }
  }
});

test('the selected ATM is always the anchor of its group, so its position is kept', async () => {
  const { groupByScreenDistance } = await loadClientModule('map.js');
  const groups = groupByScreenDistance([item('a', 0, 0), item('b', 5, 5), item('c', 8, 8)], 'b');
  const selectedGroup = groups.find((g) => g.some((m) => m.id === 'b'));
  assert.equal(selectedGroup[0].id, 'b');
  assert.equal(groups.flat().length, 3);
});

test('identical positions are grouped, and an empty list gives no groups', async () => {
  const { groupByScreenDistance } = await loadClientModule('map.js');
  assert.deepEqual(sizes(groupByScreenDistance([item('a', 5, 5), item('b', 5, 5), item('c', 5, 5)], null)), [3]);
  assert.deepEqual(groupByScreenDistance([], null), []);
});

test('grouping does not change its input', async () => {
  const { groupByScreenDistance } = await loadClientModule('map.js');
  const items = [item('a', 0, 0), item('b', 5, 5)];
  const copy = JSON.stringify(items);
  groupByScreenDistance(items, 'a');
  assert.equal(JSON.stringify(items), copy);
});
