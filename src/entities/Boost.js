// Boost.js — the stacked/held boost gauge. Pure state machine, no Phaser, no
// rendering: GameScene reads its output every frame and drives Player/HUD/SFX
// from it. Testable in plain Node, same spirit as Player.js/ObjectiveState.js.
//
// One 3-slot bank (TUNING.nitroMax), filled by collect() (a pickup contact),
// spent by update(dt, pressed) reading the boost button each frame:
//
//   - A quick press-release ("tap") burns 1 slot and stacks the active TIER
//     (1/2/3) if it lands inside `boostChainWindow` of the previous release
//     while a boost is still active — tap-tap-tap climbs 1 -> 2 -> 3.
//   - Holding the button past `boostHoldThreshold` instead drains a slot
//     every `boostHoldDrainInterval` to EXTEND the current tier's active
//     window, never to raise it. Spend the bank on height or length, not
//     both at full effect.
//
// `ceilingMultiplier` is the number Player.js clamps speed to each frame: the
// active tier's ceiling while a boost burns, then a linear ease back down to
// `overspeedCap` over `boostDecayTail` once it ends — the "gauge wears off"
// feel, and Player's own clamp riding that number down is the entire decay
// implementation (no separate boost-decay acceleration term needed).
export class Boost {
  constructor(tuning, capacity = tuning.nitroMax) {
    this.t = tuning;
    this.capacity = Math.max(1, Math.floor(Number(capacity) || tuning.nitroMax));
    this.slots = 0;
    this.tier = 0;          // 0 = inactive, 1/2/3 = active tap-stack tier
    this.holding = false;   // true once the current press has crossed the hold threshold
    this.elapsed = 0;
    this.activeUntil = 0;   // elapsed timestamp the active tier's window ends
    this.nextDrainAt = Infinity;
    this.pressedAt = -Infinity;
    this.releasedAt = -Infinity;
    this.wasPressed = false;
    this.decayFromTier = 0; // last active tier, for the post-boost ease-down
    this.decayStartAt = null;
    this.justActivated = 0; // 0 or the newly-reached tier, one-frame pulse
    this.justExtended = false; // hold drained another slot into the same tier, one-frame pulse
  }

  get full() {
    return this.slots >= this.capacity;
  }

  collect() {
    this.slots = Math.min(this.capacity, this.slots + 1);
  }

  update(dt, pressed) {
    const t = this.t;
    this.elapsed += dt;
    this.justActivated = 0;
    this.justExtended = false;

    const justPressed = pressed && !this.wasPressed;
    if (justPressed) {
      this.pressedAt = this.elapsed;
      if (this.slots > 0) {
        const chained = this.tier > 0 &&
          this.elapsed - this.releasedAt <= t.boostChainWindow;
        const nextTier = chained ? Math.min(3, this.tier + 1) : 1;
        this.slots--;
        this.tier = nextTier;
        this.activeUntil = this.elapsed + t.boostBurnDuration;
        // The threshold only decides whether this press is a hold. The first
        // slot already bought a complete burn, so do not spend slot two until
        // that full interval has elapsed.
        this.nextDrainAt = this.elapsed + t.boostHoldDrainInterval;
        this.holding = false;
        this.justActivated = nextTier;
      }
    }

    if (pressed && this.tier > 0) {
      const heldDuration = this.elapsed - this.pressedAt;
      if (heldDuration >= t.boostHoldThreshold) {
        this.holding = true;
        if (this.slots > 0 && this.elapsed >= this.nextDrainAt) {
          this.slots--;
          this.activeUntil += t.boostBurnDuration; // extend duration, never tier
          this.nextDrainAt = this.elapsed + t.boostHoldDrainInterval;
          this.justExtended = true;
        }
      }
    } else {
      this.holding = false;
    }

    if (!pressed && this.wasPressed) this.releasedAt = this.elapsed;
    this.wasPressed = pressed;

    if (this.tier > 0 && this.elapsed >= this.activeUntil) {
      this.decayFromTier = this.tier;
      this.decayStartAt = this.elapsed;
      this.tier = 0;
      this.holding = false;
    }
  }

  get ceilingMultiplier() {
    const t = this.t;
    if (this.tier > 0) return t.boostTierCeilings[this.tier - 1];
    if (this.decayStartAt == null) return t.overspeedCap;
    const since = this.elapsed - this.decayStartAt;
    if (since >= t.boostDecayTail) return t.overspeedCap;
    const from = t.boostTierCeilings[this.decayFromTier - 1];
    return from + (t.overspeedCap - from) * (since / t.boostDecayTail);
  }
}
