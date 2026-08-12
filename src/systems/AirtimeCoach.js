// AirtimeCoach.js — pure presentation policy for Training 4's HUD.
//
// GameScene owns the telemetry and HudScene owns the pixels. Keeping the
// wording/colour decisions here makes the lesson testable without booting
// Phaser, and gives controller and keyboard players equivalent instructions.

const COLORS = Object.freeze({
  info: '#00e5ff',
  success: '#2ee56b',
  warning: '#ffcf3f',
  failure: '#ff6b6b',
});

export function airtimeControlHint(device = 'keyboard') {
  return device === 'gamepad'
    ? '↑ SHORT  •  ↓ LONG'
    : 'W SHORT  •  S LONG';
}

export function formatAirtime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${safe.toFixed(2)}s`;
}

function toneColor(tone) {
  if (tone === 'danger' || tone === 'error') return COLORS.failure;
  return COLORS[tone] ?? COLORS.info;
}

function isFailureTone(tone) {
  return tone === 'failure' || tone === 'danger' || tone === 'error';
}

// `telemetry` follows GameScene.airtimeTrainingView. All reads are defensive:
// the HUD comes online before the first launch and should never display NaN or
// flash a false failure while the course is still settling at the start line.
export function airtimeCoachView(telemetry = {}, device = 'keyboard') {
  const phase = telemetry.phase ?? 'approach';
  const flightAssist = telemetry.flightAssist === true;
  const current = Number.isFinite(telemetry.currentAirSeconds)
    ? Math.max(0, telemetry.currentAirSeconds)
    : 0;
  const best = Number.isFinite(telemetry.bestAirSeconds)
    ? Math.max(0, telemetry.bestAirSeconds)
    : 0;
  const speed = Number.isFinite(telemetry.speed) ? Math.max(0, telemetry.speed) : 0;
  const requiredSpeed = Number.isFinite(telemetry.requiredSpeed)
    ? Math.max(0, telemetry.requiredSpeed)
    : 0;
  const feedback = typeof telemetry.message === 'string' && telemetry.message.trim()
    ? telemetry.message.trim()
    : null;
  const controls = airtimeControlHint(device);

  if (phase === 'airborne') {
    const glide = Number.isFinite(telemetry.glide) ? telemetry.glide : 0;
    const glideMode = telemetry.glideMode ?? (
      glide >= 0.25 ? 'long' : glide <= -0.25 ? 'short' : 'neutral'
    );
    const glideLabel = glideMode === 'long'
      ? 'GLIDING LONG  •  PULL ↓'
      : glideMode === 'short'
        ? 'SHORT ARC  •  LAND EARLY'
        : device === 'gamepad'
          ? 'AIR CONTROL  •  PUSH ↑ / PULL ↓'
          : 'AIR CONTROL  •  W SHORT / S LONG';
    const glideColor = glideMode === 'long'
      ? '#ffcf3f'
      : glideMode === 'short'
        ? '#ff2d95'
        : COLORS.info;
    return {
      phase,
      title: flightAssist ? 'FLIGHT TIME' : 'AIRTIME',
      value: formatAirtime(current),
      // Once airborne, the player's live control must win over approach
      // feedback. Otherwise a green READY message can contradict magenta
      // short-arc vanes for almost the complete mastery jump.
      detail: glideLabel,
      controls: '',
      color: glideColor,
      meter: null,
      pulse: false,
    };
  }

  if (phase === 'gap') {
    const ready = typeof telemetry.gapReady === 'boolean'
      ? telemetry.gapReady
      : requiredSpeed > 0 && speed >= requiredSpeed;
    const ratio = requiredSpeed > 0 ? Math.min(1, speed / requiredSpeed) : 0;
    return {
      phase,
      title: ready ? 'ROCK GAP READY' : 'ROCK GAP',
      value: requiredSpeed > 0
        ? `${Math.floor(speed / 100)} / ${Math.ceil(requiredSpeed / 100)}`
        : `${Math.floor(speed / 100)}`,
      detail: feedback ?? (ready
        ? 'READY  •  HOLD GOLD LINE'
        : 'BANK BOOST BEFORE GOLD RAMP'),
      controls: ready
        ? (device === 'gamepad' ? 'PULL ↓  LONG ARC' : 'HOLD S  LONG ARC')
        : (device === 'gamepad' ? 'X / □ BOOST' : 'C BOOST'),
      color: feedback
        ? toneColor(telemetry.messageTone)
        : ready ? COLORS.success : COLORS.warning,
      meter: ratio,
      pulse: !!feedback || ready,
    };
  }

  const phaseTitle = phase === 'landed'
    ? isFailureTone(telemetry.messageTone)
      ? 'TRY AGAIN'
      : flightAssist ? 'TOUCHDOWN' : 'LANDED'
    : flightAssist ? 'LIFT WINGS READY' : 'NEXT  •  GOLD RAMP';
  return {
    phase,
    title: phaseTitle,
    value: phase === 'landed' && best > 0 ? `BEST ${formatAirtime(best)}` : '',
    detail: feedback ?? (phase === 'landed'
      ? flightAssist ? 'SET UP NEXT FLIGHT' : 'SET UP NEXT GOLD RAMP'
      : flightAssist ? 'HIT RAMP  •  PULL BACK TO SOAR' : 'CENTER CAR  •  HIT GOLD'),
    controls: phase === 'landed' ? '' : controls,
    color: feedback ? toneColor(telemetry.messageTone) : COLORS.info,
    meter: null,
    pulse: !!feedback,
  };
}
