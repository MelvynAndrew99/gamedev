// tools/gen-props.js — generates the obstacle/roadside prop sprites:
//   public/assets/cone.png   (32x32)  small hazard
//   public/assets/rock.png   (40x28)  big hazard
//   public/assets/post.png   (16x56)  roadside light post (non-collidable,
//                                      exists to make speed visible)
// Same art-as-code approach as gen-car.js: pixel maps + palette, 2x scale.
// Usage: node tools/gen-props.js   (needs: npm i -D pngjs)

import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const PALETTE = {
  '.': null,
  K: [0x0a, 0x0a, 0x14], // outline
  O: [0xff, 0x7a, 0x1a], // cone orange
  o: [0xc2, 0x54, 0x00], // cone shadow
  W: [0xff, 0xff, 0xff], // cone band / glints
  G: [0x8a, 0x8a, 0x9a], // rock light
  g: [0x5c, 0x5c, 0x6c], // rock mid
  d: [0x3c, 0x3c, 0x4a], // rock dark
  P: [0x2a, 0x2a, 0x3a], // post pole
  C: [0x00, 0xe5, 0xff], // post lamp (cyan — matches the rumble neon)
  N: [0x2e, 0xe5, 0x6b], // nitro green (canister metal reuses rock gray G)
  Y: [0xff, 0xcf, 0x3f], // ramp chevron yellow
  y: [0xc9, 0x9a, 0x12], // ramp chevron shade
  L: [0xff, 0xe9, 0x8a], // ramp lip highlight / arrow paint
  B: [0x8a, 0x4a, 0x1e], // ramp support strut, rust (matches car body rust)
  E: [0x2e, 0xe5, 0x6b], // boost green
  e: [0x14, 0x8f, 0x3f], // boost green shade
};

const SPRITES = {
  // Nitro cell: energy bolt in a green diamond — floats above the road
  // (collectible language: pickups gleam, hazards squat). Nothing like the
  // flat painted zippers or the yellow ramp face.
  boost: [
    '......KK......',
    '.....KNNK.....',
    '....KNNNNK....',
    '...KNNWWNNK...',
    '..KNNNWWKNNK..',
    '.KNNNWWKNNNNK.',
    'KNNNWWWWKNNNNK',
    'KNNNNKWWWWNNNK',
    '.KNNNNKWWNNNK.',
    '..KNNKWWNNNK..',
    '...KNNWWNNK...',
    '....KNNNNK....',
    '.....KNNK.....',
    '......KK......',
  ],
  // A scrap-metal wedge, not a flat painted bar. Cyan marker poles make its
  // wide horizontal silhouette survive distance without changing the fact
  // that this is a physical raised object the car launches from.
  // The silhouette tapers from a
  // narrow bright lip (top — the launch edge, farthest away/highest) down
  // to a wide riveted base plate (bottom — ground contact), the taper
  // itself being the "this surface tilts up and away from you" cue that a
  // flat rectangle can't give. Rust support struts brace the sides, tread
  // bands carry a single bold center arrow (paint, not texture noise), and
  // two beacon lights on the lip match the roadside posts' night-visibility
  // language so it reads before collision distance same as they do.
  ramp: [
    '....KCCK............KCCK....',
    '....KCCK............KCCK....',
    '....KCCK............KCCK....',
    '......KLCLLLLLLLLLLCLLK.....',
    '.......LLLLLLLLLLLLLLL......',
    '.....KBggggggggggggggBgK....',
    '.....KBYYYYYYLYLYYYYYBYK....',
    '.....KBYYYYYYLYLYYYYYBYK....',
    '....KByyyyyyyLyLyyyyyyByK...',
    '....KByyyyyyLyyyLyyyyyByK...',
    '....KBYYYYYYLYYYLYYYYYBYK...',
    '...KBYYYYYYLYYYYYLYYYYYBYK..',
    '...KByyyyyyLyyyyyLyyyyyByK..',
    '...KByyyyyLyyyyyyyLyyyyByK..',
    '...KBYYYYYLYYYYYYYLYYYYBYK..',
    '..KBYYYYYLYYYYYYYYYLYYYYBYK.',
    '..KByyyyLyyyyyyyyyyyLyyyByK.',
    '..KByyyyLyyyyyyyyyyyLyyyByK.',
    '.KBYYYYLYYYYYYYYYYYYYLYYYBYK',
    'KKBKKKKKKKKKKKKKKKKKKKKKKBKK',
    'dddKdddddKddddddddKdddddKddd',
    'dddddddddddddddddddddddddddd',
    'KKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  ],
  cone: [
    '.....KK.....',
    '....KOOK....',
    '....KooK....',
    '....KOOoK...',
    '...KOOOOoK..',
    '...KWWWWWK..',
    '...KWWWWWK..',
    '..KOOOOOOoK.',
    '..KOOOOOOoK.',
    '..KWWWWWWWK.',
    '..KWWWWWWWK.',
    '.KOOOOOOOOoK',
    '.KOOOOOOOOoK',
    '.KOOOOOOOOoK',
    'KKKKKKKKKKKK',
    'KooooooooooK',
    'KooooooooooK',
    'KKKKKKKKKKKK',
  ],
  rock: [
    '......KKKKK.........',
    '....KKGGGGKK...KKK..',
    '...KGGGGGGGGK.KGGgK.',
    '..KGGGGWGGGGgKGGGgK.',
    '.KGGGGGGGGGGGgGGggK.',
    '.KGGGGGGGGGgggGgggK.',
    'KGGGGGGGGGGGggggggdK',
    'KGGGGGGGgggggggddddK',
    'KGgGGGgggggggdddddK.',
    'KggggggggggdddddddK.',
    'KgggggggdddddddddK..',
    '.KgddddddddddddddK..',
    '..KKddddddddddKKK...',
    '....KKKKKKKKKK......',
  ],
  post: [
    '..KKKK..',
    '.KCCCCK.',
    '.KCWCCK.',
    '.KCCCCK.',
    '..KKKK..',
    '...KK...',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '..KPPK..',
    '.KPPPPK.',
    'KKKKKKKK',
  ],
};

const SCALE = 2;

function writeSprite(name, map) {
  const w = map[0].length * SCALE;
  const h = map.length * SCALE;
  const png = new PNG({ width: w, height: h });
  map.forEach((row, my) => {
    [...row].forEach((ch, mx) => {
      const c = PALETTE[ch];
      if (!c) return;
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const i = ((my * SCALE + dy) * w + mx * SCALE + dx) * 4;
          png.data[i] = c[0]; png.data[i + 1] = c[1];
          png.data[i + 2] = c[2]; png.data[i + 3] = 255;
        }
      }
    });
  });
  const out = path.join(process.cwd(), 'public', 'assets', `${name}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, PNG.sync.write(png));
  console.log(`wrote ${out} (${w}x${h})`);
}

for (const [name, map] of Object.entries(SPRITES)) {
  const len = map[0].length;
  map.forEach((row, i) => {
    if (row.length !== len) throw new Error(`${name} row ${i}: ${row.length} != ${len}`);
  });
  writeSprite(name, map);
}
