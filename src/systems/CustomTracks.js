// CustomTracks.js — pure jam-sized track-builder model and persistence.
//
// The racing engine consumes a linear piece list, so the editor presents that
// list as a connected top-down ribbon. Authors still drag visible road tiles
// through a grid and layer props onto them, while every saved route compiles
// deterministically into the existing pseudo-3D track contract.

const STORAGE_KEY = 'rhythmic-ride.custom-tracks.v1';
export const CUSTOM_TRACK_VERSION = 1;
export const CUSTOM_TRACK_LIMIT = 6;
export const CUSTOM_GRID = Object.freeze({ columns: 8, rows: 8, startX: 4, startY: 7 });

export const CUSTOM_ENVIRONMENTS = Object.freeze([
  Object.freeze({ id: 'training-loop', label: 'COASTAL SCHOOL' }),
  Object.freeze({ id: 'proving-ground', label: 'MIDNIGHT CIRCUIT' }),
  Object.freeze({ id: 'neon-gulch', label: 'NEON GULCH' }),
  Object.freeze({ id: 'syndicate-run', label: 'FREIGHT BELT' }),
]);

export const CUSTOM_ROAD_TOOLS = Object.freeze([
  Object.freeze({ id: 'straight', label: 'STRAIGHT', color: 0x596071 }),
  Object.freeze({ id: 'left', label: 'LEFT BEND', color: 0x00b9d8 }),
  Object.freeze({ id: 'right', label: 'RIGHT BEND', color: 0xff2d95 }),
  Object.freeze({ id: 'hill', label: 'HILL', color: 0xffcf3f }),
  Object.freeze({ id: 'dirt', label: 'DIRT', color: 0x9b6848 }),
  Object.freeze({ id: 'chicane', label: 'CHICANE', color: 0xa779ff }),
]);

export const CUSTOM_OBJECT_TOOLS = Object.freeze([
  Object.freeze({ id: 'cone', label: 'CONE', color: 0xff8a3d }),
  Object.freeze({ id: 'rock', label: 'ROCK', color: 0xa7afbf }),
  Object.freeze({ id: 'boost', label: 'BOOST', color: 0x2ee56b }),
  Object.freeze({ id: 'ramp', label: 'RAMP', color: 0xffcf3f }),
]);

const ROAD_IDS = new Set(CUSTOM_ROAD_TOOLS.map(({ id }) => id));
const OBJECT_IDS = new Set(CUSTOM_OBJECT_TOOLS.map(({ id }) => id));
const ENVIRONMENT_IDS = new Set(CUSTOM_ENVIRONMENTS.map(({ id }) => id));
const DIRECTIONS = Object.freeze([
  Object.freeze({ x: 0, y: -1 }),
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: -1, y: 0 }),
]);

const PIECES = Object.freeze({
  straight: Object.freeze(['straight', 18]),
  left: Object.freeze(['curve', 16, -2.4]),
  right: Object.freeze(['curve', 16, 2.4]),
  hill: Object.freeze(['hill', 18, 18]),
  dirt: Object.freeze(['dirt', 18, 0, 0]),
  chicane: Object.freeze(['chicane', 12, 2.6, 0]),
});

export function customBuilderUnlocked(schoolTiles = [], storyTiles = []) {
  const releasedSchool = schoolTiles.filter((tile) => !tile.comingSoon);
  return releasedSchool.length > 0 &&
    releasedSchool.every((tile) => tile.completed) &&
    storyTiles.length > 0 &&
    storyTiles.every((tile) =>
      (tile.qualifier?.attempted ?? tile.qualifier?.complete) &&
      (tile.rivals?.attempted ?? tile.rivals?.complete)
    );
}

export function createCustomTrackDraft(sequence = 1) {
  return Object.freeze({
    version: CUSTOM_TRACK_VERSION,
    id: `custom-${Date.now().toString(36)}-${Math.max(1, sequence)}`,
    name: `CUSTOM ${String(Math.max(1, sequence)).padStart(2, '0')}`,
    environment: CUSTOM_ENVIRONMENTS[0].id,
    roads: Object.freeze(['straight']),
    objects: Object.freeze([]),
    updatedAt: Date.now(),
  });
}

export function customRouteLayout(roads = [], grid = CUSTOM_GRID) {
  const safeRoads = roads.filter((type) => ROAD_IDS.has(type));
  const cells = [];
  const occupied = new Set();
  let x = grid.startX;
  let y = grid.startY;
  let heading = 0;
  let valid = true;
  for (let index = 0; index < safeRoads.length; index++) {
    const type = safeRoads[index];
    const key = `${x}:${y}`;
    if (
      x < 0 || x >= grid.columns || y < 0 || y >= grid.rows ||
      occupied.has(key)
    ) {
      valid = false;
      break;
    }
    cells.push(Object.freeze({ index, x, y, heading, type }));
    occupied.add(key);
    if (type === 'left') heading = (heading + 3) % 4;
    if (type === 'right') heading = (heading + 1) % 4;
    x += DIRECTIONS[heading].x;
    y += DIRECTIONS[heading].y;
  }
  const nextAvailable = x >= 0 && x < grid.columns && y >= 0 && y < grid.rows &&
    !occupied.has(`${x}:${y}`);
  return Object.freeze({
    valid,
    cells: Object.freeze(cells),
    next: Object.freeze({ x, y, heading, available: valid && nextAvailable }),
  });
}

export function appendCustomRoad(draft, type) {
  if (!ROAD_IDS.has(type)) return Object.freeze({ ok: false, reason: 'UNKNOWN ROAD TILE', draft });
  if ((draft.roads?.length ?? 0) >= 18) {
    return Object.freeze({ ok: false, reason: 'ROUTE LIMIT 18 TILES', draft });
  }
  const roads = [...(draft.roads ?? []), type];
  const layout = customRouteLayout(roads);
  if (!layout.valid) return Object.freeze({ ok: false, reason: 'ROAD CROSSES ITSELF', draft });
  if (layout.cells.length !== roads.length) {
    return Object.freeze({ ok: false, reason: 'ROAD LEAVES THE BUILD AREA', draft });
  }
  return Object.freeze({ ok: true, draft: freezeDraft({ ...draft, roads }) });
}

export function removeLastCustomRoad(draft) {
  const roads = [...(draft.roads ?? [])];
  if (roads.length <= 1) return freezeDraft(draft);
  roads.pop();
  const objects = (draft.objects ?? []).filter(({ roadIndex }) => roadIndex < roads.length);
  return freezeDraft({ ...draft, roads, objects });
}

export function placeCustomObject(draft, roadIndex, kind, lane = 0) {
  if (!OBJECT_IDS.has(kind)) return Object.freeze({ ok: false, reason: 'UNKNOWN OBJECT', draft });
  if (!Number.isInteger(roadIndex) || roadIndex < 0 || roadIndex >= (draft.roads?.length ?? 0)) {
    return Object.freeze({ ok: false, reason: 'DROP OBJECT ON A ROAD TILE', draft });
  }
  const cleanLane = lane < -0.2 ? -0.55 : lane > 0.2 ? 0.55 : 0;
  const objects = (draft.objects ?? []).filter((object) => object.roadIndex !== roadIndex);
  objects.push({ roadIndex, kind, lane: cleanLane });
  objects.sort((a, b) => a.roadIndex - b.roadIndex);
  return Object.freeze({ ok: true, draft: freezeDraft({ ...draft, objects }) });
}

export function removeCustomObject(draft, roadIndex) {
  return freezeDraft({
    ...draft,
    objects: (draft.objects ?? []).filter((object) => object.roadIndex !== roadIndex),
  });
}

export function cycleCustomEnvironment(draft, direction = 1) {
  const current = Math.max(0, CUSTOM_ENVIRONMENTS.findIndex(
    ({ id }) => id === draft.environment,
  ));
  const next = (current + (direction < 0 ? -1 : 1) + CUSTOM_ENVIRONMENTS.length) %
    CUSTOM_ENVIRONMENTS.length;
  return freezeDraft({ ...draft, environment: CUSTOM_ENVIRONMENTS[next].id });
}

export function validateCustomTrack(draft) {
  const layout = customRouteLayout(draft?.roads);
  const errors = [];
  if (!layout.valid || layout.cells.length !== (draft?.roads?.length ?? 0)) errors.push('ROUTE IS NOT VALID');
  if ((draft?.roads?.length ?? 0) < 6) errors.push('ADD AT LEAST 6 ROAD TILES');
  if ((draft?.roads?.length ?? 0) > 18) errors.push('ROUTE EXCEEDS 18 TILES');
  if (!ENVIRONMENT_IDS.has(draft?.environment)) errors.push('CHOOSE A TRACK SCENE');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), layout });
}

export function compileCustomTrack(draft) {
  const validation = validateCustomTrack(draft);
  if (!validation.valid) throw new Error(validation.errors.join(' • '));
  const pieces = draft.roads.map((type) => [...PIECES[type]]);
  const starts = [];
  let segment = 0;
  draft.roads.forEach((type, index) => {
    starts[index] = segment;
    segment += pieceSegmentCount(PIECES[type]);
  });
  const objects = (draft.objects ?? []).map((object, index) => {
    const piece = PIECES[draft.roads[object.roadIndex]];
    const pieceLength = pieceSegmentCount(piece);
    return {
      id: `custom-object-${index + 1}`,
      at: starts[object.roadIndex] + Math.max(30, Math.floor(pieceLength * 0.58)),
      kind: object.kind,
      offset: object.lane,
      once: object.kind === 'boost',
    };
  });
  const name = cleanName(draft.name);
  return Object.freeze({
    id: `user-${String(draft.id).replace(/[^a-z0-9-]/gi, '').slice(0, 40)}`,
    customDraftId: draft.id,
    custom: true,
    name,
    seed: hashString(draft.id),
    laps: 2,
    finish: 'laps',
    music: draft.environment,
    environment: draft.environment,
    intro: 'A player-built two-lap circuit. Learn the line, then chase a clean finish.',
    decoration: Object.freeze({ roadsidePosts: true, nitro: false, zippers: false }),
    objectives: Object.freeze([Object.freeze({
      id: 'finish', type: 'complete_laps', value: 2,
      label: 'FINISH 2 LAPS', hudLabel: 'FINISH', points: 1000,
    })]),
    patterns: Object.freeze({ startClear: 30, finishClear: 45, placements: Object.freeze([]) }),
    objects: Object.freeze(objects.map(Object.freeze)),
    pieces: Object.freeze(pieces.map(Object.freeze)),
    obstacles: 0,
    par: 2,
  });
}

export function loadCustomTracks(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, CUSTOM_TRACK_LIMIT).map(sanitizeDraft).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveCustomTrack(draft, storage = globalThis.localStorage) {
  const clean = sanitizeDraft(draft);
  if (!clean) return Object.freeze({ ok: false, reason: 'TRACK DATA IS INVALID', tracks: [] });
  const validation = validateCustomTrack(clean);
  if (!validation.valid) {
    return Object.freeze({ ok: false, reason: validation.errors[0], tracks: loadCustomTracks(storage) });
  }
  const tracks = loadCustomTracks(storage);
  const index = tracks.findIndex(({ id }) => id === clean.id);
  const saved = freezeDraft({ ...clean, updatedAt: Date.now() });
  if (index >= 0) tracks[index] = saved;
  else if (tracks.length < CUSTOM_TRACK_LIMIT) tracks.push(saved);
  else return Object.freeze({ ok: false, reason: 'SIX TRACK SLOTS ARE FULL', tracks });
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(tracks));
  } catch {
    return Object.freeze({ ok: false, reason: 'SAVE STORAGE IS UNAVAILABLE', tracks });
  }
  return Object.freeze({ ok: true, track: saved, tracks: Object.freeze(tracks) });
}

export function deleteCustomTrack(id, storage = globalThis.localStorage) {
  const tracks = loadCustomTracks(storage).filter((track) => track.id !== id);
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(tracks)); } catch { /* optional storage */ }
  return Object.freeze(tracks);
}

function sanitizeDraft(value) {
  if (!value || typeof value !== 'object') return null;
  const roads = Array.isArray(value.roads)
    ? value.roads.filter((type) => ROAD_IDS.has(type)).slice(0, 18)
    : [];
  if (!roads.length) roads.push('straight');
  const layout = customRouteLayout(roads);
  if (!layout.valid || layout.cells.length !== roads.length) return null;
  const objects = Array.isArray(value.objects)
    ? value.objects.filter((object) =>
      Number.isInteger(object?.roadIndex) && object.roadIndex >= 0 &&
      object.roadIndex < roads.length && OBJECT_IDS.has(object?.kind)
    ).slice(0, roads.length).map((object) => ({
      roadIndex: object.roadIndex,
      kind: object.kind,
      lane: object.lane < -0.2 ? -0.55 : object.lane > 0.2 ? 0.55 : 0,
    }))
    : [];
  return freezeDraft({
    version: CUSTOM_TRACK_VERSION,
    id: String(value.id ?? `custom-${Date.now().toString(36)}`).slice(0, 64),
    name: cleanName(value.name),
    environment: ENVIRONMENT_IDS.has(value.environment)
      ? value.environment
      : CUSTOM_ENVIRONMENTS[0].id,
    roads,
    objects,
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now(),
  });
}

function freezeDraft(value) {
  return Object.freeze({
    ...value,
    roads: Object.freeze([...(value.roads ?? ['straight'])]),
    objects: Object.freeze((value.objects ?? []).map((object) => Object.freeze({ ...object }))),
  });
}

function cleanName(value) {
  const name = String(value ?? 'CUSTOM TRACK').replace(/[^A-Z0-9 -]/gi, '').trim().slice(0, 20);
  return name || 'CUSTOM TRACK';
}

function pieceSegmentCount(piece) {
  const [type, length = 1] = piece;
  return Math.max(1, Math.floor(length)) * (type === 'chicane' ? 6 : 3);
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
