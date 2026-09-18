const ALLOWED_SPEEDS = new Set([0, 1, 2, 5, 10, 50]);

export class GameClock {
  constructor({ startDate = "2048-01-01", speed = 1, daysPerSecond = 1 } = {}) {
    this.startDate = startDate;
    this.speed = ALLOWED_SPEEDS.has(speed) ? speed : 1;
    this.daysPerSecond = Math.max(0.01, Number(daysPerSecond) || 1);
    this.day = 0;
    this.accumulator = 0;
  }

  setSpeed(speed) {
    const value = Number(speed);
    if (!ALLOWED_SPEEDS.has(value)) return false;
    this.speed = value;
    return true;
  }

  pause() { this.speed = 0; }
  play() { if (this.speed === 0) this.speed = 1; }

  consume(realDeltaSeconds) {
    if (this.speed <= 0) return 0;
    const delta = Math.max(0, Math.min(1, Number(realDeltaSeconds) || 0));
    this.accumulator += delta * this.daysPerSecond * this.speed;
    const days = Math.floor(this.accumulator);
    if (days > 0) this.accumulator -= days;
    return Math.min(days, 60);
  }

  advance(days = 1) { this.day += Math.max(0, Math.floor(days)); }

  date() {
    const date = new Date(`${this.startDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + this.day);
    return date.toISOString().slice(0, 10);
  }

  snapshot() { return { startDate: this.startDate, speed: this.speed, daysPerSecond: this.daysPerSecond, day: this.day, accumulator: this.accumulator, date: this.date() }; }
  restore(snapshot) {
    if (!snapshot) return;
    this.startDate = snapshot.startDate || this.startDate;
    this.speed = ALLOWED_SPEEDS.has(snapshot.speed) ? snapshot.speed : this.speed;
    this.daysPerSecond = Math.max(0.01, Number(snapshot.daysPerSecond) || this.daysPerSecond);
    this.day = Math.max(0, Math.floor(snapshot.day || 0));
    this.accumulator = Math.max(0, Number(snapshot.accumulator) || 0);
  }
}
