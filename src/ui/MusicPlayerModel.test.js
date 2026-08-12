import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjacentDiscoveredTrack,
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
