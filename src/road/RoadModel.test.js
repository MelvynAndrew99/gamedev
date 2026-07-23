import test from 'node:test';
import assert from 'node:assert/strict';

import { TUNING } from '../config/tuning.js';
import trainingLoop from '../tracks/training-loop.json' with { type: 'json' };
import neonGulch from '../tracks/neon-gulch.json' with { type: 'json' };
import syndicateRun from '../tracks/syndicate-run.json' with { type: 'json' };
import { RoadModel } from './RoadModel.js';

function interactiveLayout(model) {
  return model.segments.flatMap((segment) =>
    segment.sprites
      .filter((sprite) => sprite.def)
      .map((sprite) => [segment.index, sprite.key, sprite.offset])
  );
}

test('campaign decoration is deterministic for a track seed', () => {
  const first = new RoadModel(TUNING);
  const second = new RoadModel(TUNING);

  first.buildFromData(trainingLoop);
  second.buildFromData(trainingLoop);

  assert.deepEqual(interactiveLayout(first), interactiveLayout(second));
  assert.ok(interactiveLayout(first).length > 0);
});

test('lap reset re-arms interactive sprites without changing layout', () => {
  const model = new RoadModel(TUNING);
  model.buildFromData(trainingLoop);
  const sprite = model.segments.flatMap((segment) => segment.sprites)
    .find((candidate) => candidate.def);

  sprite.hit = true;
  model.resetLapSprites();

  assert.equal(sprite.hit, false);
});

test('cones never appear to announce ground boosts', () => {
  for (const track of [trainingLoop, neonGulch, syndicateRun]) {
    const model = new RoadModel(TUNING);
    model.buildFromData(track);

    for (let i = 0; i < model.segments.length; i++) {
      const segment = model.segments[i];
      for (const sprite of segment.sprites) {
        if (sprite.key === 'boost') {
          assert.equal(model.hasConeWarningBehind(i, sprite.offset), false, track.id);
        }
      }
      if (segment.zipper) {
        assert.equal(model.hasConeWarningBehind(i, segment.zipper.offset), false, track.id);
      }
    }
  }
});
