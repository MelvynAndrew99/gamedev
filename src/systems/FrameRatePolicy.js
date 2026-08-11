// FrameRatePolicy.js — optional presentation fallback, never a physics dial.

export function presentationFpsLimit(search = '') {
  try {
    return new URLSearchParams(String(search)).get('fps') === '60' ? 60 : 0;
  } catch {
    return 0;
  }
}
