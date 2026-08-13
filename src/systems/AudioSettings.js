export const AUDIO_SETTINGS_KEY = 'rhythmic-ride.audio.v1';

export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  musicEnabled: true,
  sfxEnabled: true,
});

export function sanitizeAudioSettings(value) {
  return {
    musicEnabled: typeof value?.musicEnabled === 'boolean'
      ? value.musicEnabled
      : DEFAULT_AUDIO_SETTINGS.musicEnabled,
    sfxEnabled: typeof value?.sfxEnabled === 'boolean'
      ? value.sfxEnabled
      : DEFAULT_AUDIO_SETTINGS.sfxEnabled,
  };
}

export function loadAudioSettings(storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem(AUDIO_SETTINGS_KEY);
    return sanitizeAudioSettings(saved ? JSON.parse(saved) : null);
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(settings, storage = globalThis.localStorage) {
  const safe = sanitizeAudioSettings(settings);
  try {
    storage?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(safe));
  } catch {
    // Private browsing and disabled storage must never interrupt play.
  }
  return safe;
}

export function toggleAudioChannel(settings, channel) {
  const safe = sanitizeAudioSettings(settings);
  if (channel === 'music') return { ...safe, musicEnabled: !safe.musicEnabled };
  if (channel === 'sfx') return { ...safe, sfxEnabled: !safe.sfxEnabled };
  return safe;
}

export function toggleAllAudio(settings) {
  const safe = sanitizeAudioSettings(settings);
  const enable = !(safe.musicEnabled || safe.sfxEnabled);
  return { musicEnabled: enable, sfxEnabled: enable };
}

export function isAudioMuteShortcut(event = {}) {
  return event.code === 'KeyM'
    && event.repeat !== true
    && event.isComposing !== true
    && event.altKey !== true
    && event.ctrlKey !== true
    && event.metaKey !== true;
}

export class AudioSettingsStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.state = loadAudioSettings(storage);
    this.listeners = new Set();
  }

  get() {
    return { ...this.state };
  }

  apply(engine) {
    engine?.setMusicMuted?.(!this.state.musicEnabled);
    engine?.setSfxMuted?.(!this.state.sfxEnabled);
    return this.get();
  }

  setChannel(channel, engine) {
    this.state = saveAudioSettings(
      toggleAudioChannel(this.state, channel),
      this.storage,
    );
    this.apply(engine);
    this.notify();
    return this.get();
  }

  toggleAll(engine) {
    this.state = saveAudioSettings(toggleAllAudio(this.state), this.storage);
    this.apply(engine);
    this.notify();
    return this.get();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const snapshot = this.get();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export function installAudioMuteShortcut({
  windowTarget,
  settings,
  engine,
  isEditable = () => false,
  onChange = () => {},
}) {
  const onKeyDown = (event) => {
    if (!isAudioMuteShortcut(event) || isEditable(event.target)) return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    onChange(settings.toggleAll(engine));
  };
  windowTarget.addEventListener('keydown', onKeyDown, { capture: true });
  return () => windowTarget.removeEventListener('keydown', onKeyDown, { capture: true });
}

export const AUDIO_SETTINGS = new AudioSettingsStore();
