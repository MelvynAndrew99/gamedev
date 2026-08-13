import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjacentDiscoveredTrack,
  musicListWindow,
  moveMusicSelection,
  musicLibraryEntries,
} from './MusicPlayerModel.js';

const playlist = [
  { label: 'OPEN', discovered: () => true },
  { label: 'LOCKED', discovered: () => false },
  { label: 'WON', discovered: (context) => context.won },
];

test('music library exposes every album slot without leaking locked titles', () => {
  const entries = musicLibraryEntries(playlist, { won: true });
  assert.deepEqual(entries.map(({ index, discovered }) => ({ index, discovered })), [
    { index: 0, discovered: true },
    { index: 1, discovered: false },
    { index: 2, discovered: true },
  ]);
});

test('library cursor wraps while shoulder skip ignores locked tracks', () => {
  const entries = musicLibraryEntries(playlist, { won: true });
  assert.equal(moveMusicSelection(0, entries.length, 'up'), 2);
  assert.equal(moveMusicSelection(2, entries.length, 'down'), 0);
  assert.equal(adjacentDiscoveredTrack(entries, 0, 'next'), 2);
  assert.equal(adjacentDiscoveredTrack(entries, 2, 'previous'), 0);
});

test('long libraries keep the selected track inside a six-row scroll window', () => {
  assert.deepEqual(musicListWindow(0, 11, 6), {
    start: 0, end: 6, size: 6, total: 11,
    canScrollUp: false, canScrollDown: true,
    thumbFraction: 6 / 11, scrollFraction: 0,
    label: '1–6 / 11',
  });
  const middle = musicListWindow(6, 11, 6);
  assert.ok(middle.start <= 6 && middle.end > 6);
  assert.equal(middle.canScrollUp, true);
  assert.equal(middle.canScrollDown, true);
  assert.deepEqual(musicListWindow(10, 11, 6), {
    start: 5, end: 11, size: 6, total: 11,
    canScrollUp: true, canScrollDown: false,
    thumbFraction: 6 / 11, scrollFraction: 1,
    label: '6–11 / 11',
  });
});
