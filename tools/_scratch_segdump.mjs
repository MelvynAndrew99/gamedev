import { RoadModel } from '../src/road/RoadModel.js';
import { TUNING } from '../src/config/tuning.js';
import trainingLoop from '../src/tracks/training-loop.json' with { type: 'json' };
import hazardWeave from '../src/tracks/training-hazard-weave.json' with { type: 'json' };

const model = new RoadModel(TUNING);
model.buildFromData(trainingLoop);

let lastCurve = null;
for (let i = 0; i < model.segments.length; i++) {
  const s = model.segments[i];
  const curveBucket = Math.round(s.curve * 1000) / 1000;
  if (curveBucket !== lastCurve) {
    console.log(`seg ${i}: curve -> ${curveBucket}`);
    lastCurve = curveBucket;
  }
}
console.log('total segments', model.segments.length, 'trackLength', model.trackLength);
console.log('existing hazard-weave formation ats:', hazardWeave.objects.filter(o=>o.kind==='rock').map(o=>o.at));
