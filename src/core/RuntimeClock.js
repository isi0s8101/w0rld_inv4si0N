export class RuntimeClock {
  constructor() {
    this.time = 0;
    this.delta = 0;
    this.elapsed = 0;
    this.lastNow = null;
  }

  start(now = performance.now()) {
    this.time = now / 1000;
    this.delta = 0;
    this.elapsed = 0;
    this.lastNow = now;
    return this;
  }

  resume(now = performance.now()) {
    this.time = now / 1000;
    this.delta = 0;
    this.lastNow = now;
    return this;
  }

  tick(now = performance.now()) {
    if (this.lastNow === null) return this.start(now);
    const rawDelta = Math.max(0, (now - this.lastNow) / 1000);
    this.delta = Math.min(0.05, rawDelta);
    this.elapsed += rawDelta;
    this.time = now / 1000;
    this.lastNow = now;
    return this;
  }
}
