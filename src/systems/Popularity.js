// Popularity.js — the crowd's opinion of you, as a number. Pure logic.
//
// Mechanics: every reckless act pays `base * combo` fame, refreshes the
// combo window, and grows the combo (capped). Let the window lapse and
// the combo resets quietly; hit a rock and it BUSTS loudly. The unbanked
// combo is the tension engine — prospect theory says a possessed-and-
// losable 6x multiplier motivates harder than the promise of future
// fame ever could.
//
// At payout time, fame converts to money (popPayoutRate). The economy
// contract: a fully-worked lap of stunts should rival or beat the
// finish-time bonus, so "stunt earner" is a real career, not a tip jar.

export class Popularity {
  constructor(tuning) {
    this.t = tuning;
    this.total = 0;
    this.combo = 1;
    this.timer = 0;
  }

  // Returns the fame actually earned (base * combo at time of the act).
  add(base) {
    const earned = base * this.combo;
    this.total += earned;
    this.combo = Math.min(this.t.comboMax, this.combo + 1);
    this.timer = this.t.comboWindow;
    return earned;
  }

  // Rock. Returns true if there was a combo worth mourning.
  bust() {
    const hadCombo = this.combo > 1;
    this.combo = 1;
    this.timer = 0;
    return hadCombo;
  }

  update(dt) {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) this.combo = 1; // quiet lapse, not a bust
    }
  }

  get cash() {
    return Math.round(this.total * this.t.popPayoutRate);
  }
}