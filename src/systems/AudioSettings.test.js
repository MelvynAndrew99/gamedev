import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUDIO_SETTINGS_KEY,
  AudioSettingsStore,
  installAudioMuteShortcut,
  isAudioMuteShortcut,
  loadAudioSettings,
  sanitizeAudioSettings,
  toggleAllAudio,
  toggleAudioChannel,
} from './AudioSettings.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('audio settings sanitize corrupt and partial saves', () => {
  assert.deepEqual(sanitizeAudioSettings(null), { musicEnabled: true, sfxEnabled: true });
  assert.deepEqual(
    sanitizeAudioSettings({ musicEnabled: false, sfxEnabled: 'no' }),
    { musicEnabled: false, sfxEnabled: true },
  );
  assert.deepEqual(loadAudioSettings(memoryStorage({ [AUDIO_SETTINGS_KEY]: '{bad' })), {
    musicEnabled: true,
    sfxEnabled: true,
  });
});

test('individual channel toggles and mute-all semantics are deterministic', () => {
  assert.deepEqual(toggleAudioChannel({ musicEnabled: true, sfxEnabled: true }, 'music'), {
    musicEnabled: false,
    sfxEnabled: true,
  });
  assert.deepEqual(toggleAllAudio({ musicEnabled: false, sfxEnabled: true }), {
    musicEnabled: false,
    sfxEnabled: false,
  });
  assert.deepEqual(toggleAllAudio({ musicEnabled: false, sfxEnabled: false }), {
    musicEnabled: true,
    sfxEnabled: true,
  });
});

test('store persists changes, applies both buses, and notifies subscribers', () => {
  const storage = memoryStorage();
  const engine = {
    musicMuted: null,
    sfxMuted: null,
    setMusicMuted(value) { this.musicMuted = value; },
    setSfxMuted(value) { this.sfxMuted = value; },
  };
  const store = new AudioSettingsStore(storage);
  const notices = [];
  store.subscribe((value) => notices.push(value));
  store.setChannel('music', engine);
  assert.equal(engine.musicMuted, true);
  assert.equal(engine.sfxMuted, false);
  assert.deepEqual(new AudioSettingsStore(storage).get(), {
    musicEnabled: false,
    sfxEnabled: true,
  });
  assert.deepEqual(notices, [{ musicEnabled: false, sfxEnabled: true }]);
});

test('M shortcut ignores repeats, modifiers, and editable controls', () => {
  assert.equal(isAudioMuteShortcut({ code: 'KeyM' }), true);
  assert.equal(isAudioMuteShortcut({ code: 'KeyM', repeat: true }), false);
  assert.equal(isAudioMuteShortcut({ code: 'KeyM', ctrlKey: true }), false);

  let listener;
  let toggles = 0;
  let changes = 0;
  const windowTarget = {
    addEventListener(_type, callback) { listener = callback; },
    removeEventListener() {},
  };
  installAudioMuteShortcut({
    windowTarget,
    settings: { toggleAll: () => { toggles += 1; return {}; } },
    engine: {},
    isEditable: (target) => target === 'editable',
    onChange: () => { changes += 1; },
  });
  listener({ code: 'KeyM', target: 'editable' });
  listener({ code: 'KeyM', target: null });
  assert.equal(toggles, 1);
  assert.equal(changes, 1);
});
