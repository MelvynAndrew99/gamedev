// Pure contact-shadow policy shared by gameplay and its regression tests.
// The shadow remains on the road while the vehicle rises, becoming smaller
// and lighter so airtime reads as height instead of a sprite translation.

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function vehicleShadowFrame({ liftPx = 0, airScaleX = 1 } = {}) {
  const lift = clamp((Number(liftPx) || 0) / 96, 0, 1);
  const widthScale = clamp(Number(airScaleX) || 1, 0.7, 1.7);
  return {
    scaleX: widthScale * (1 - lift * 0.42),
    scaleY: 1 - lift * 0.58,
    alpha: 0.48 - lift * 0.3,
  };
}
