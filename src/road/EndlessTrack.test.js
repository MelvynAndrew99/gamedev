import test from 'node:test';
import assert from 'node:assert/strict';

import { TUNING } from '../config/tuning.js';
import { EndlessTrack } from './EndlessTrack.js';

function assertConeLanguage(track) {
  for (let i = 0; i < track.segments.length; i++) {
    const segment = track.segments[i];
    for (const sprite of segment.sprites) {
      if (sprite.key === 'boost') {
        assert.equal(
          track.hasConeWarningBehind(i, sprite.offset),
          false,
          `boost at absolute segment ${segment.index}`
        );
      }
    }
    if (segment.zipper) {
      assert.equal(
        track.hasConeWarningBehind(i, segment.zipper.offset),
        false,
        `zipper at absolute segment ${segment.index}`
      );
    }
  }
}

test('endless generation preserves cone language through growth and trimming', () => {
  const track = new EndlessTrack(TUNING);
  // Fixed pattern/object choices make failures reproducible; geometry can
  // remain random because this assertion concerns object ordering.
  let state = 123456789;
  track.rng = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };

  for (let step = 0; step < 12; step++) {
    const position = step * 120 * TUNING.segmentLength;
    track.ensureAhead(position);
    assertConeLanguage(track);
  }
});
