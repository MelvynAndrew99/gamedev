// RacerState.js — the racer's persistent condition. Module-level singleton,
// same lifetime bucket as TUNING: survives scene restarts, dies on refresh.
// (Later, if we want it to survive refresh too, it serializes through
// HighScores-style localStorage — the shape is already JSON-friendly.)
//
// THE DESIGN RULE THAT LIVES HERE: health does NOT refill between races.
// Damage you don't pay to repair follows you into the next course. That
// makes repair-vs-upgrade a real decision, and lets skilled players run
// dented cars on purpose to afford better toys. Any code that "helpfully"
// resets health between story races is breaking the game's economy.

export const RACER = {
  maxHealth: 100,
  health: 100,
  money: 0, // earned at race payouts (shop comes later)

  // New campaign / new endless run: fresh car, empty pockets.
  resetRun() {
    this.health = this.maxHealth;
    this.money = 0;
  },

  // Returns true if this hit wrecked the car.
  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  },

  repair(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  },

  get healthFrac() {
    return this.health / this.maxHealth;
  },
};