export class SeededRandom {
  constructor(seed = 0x57494e56) {
    const normalized = Number(seed) >>> 0;
    this.initialSeed = normalized || 1;
    this.state = this.initialSeed;
  }

  next() {
    let t = (this.state += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) { return min + this.next() * (max - min); }
  int(min, maxInclusive) { return Math.floor(this.range(min, maxInclusive + 1)); }
  chance(probability) { return this.next() < probability; }
  pick(items) { return items.length ? items[Math.floor(this.next() * items.length)] : null; }

  fork(label = "") {
    let hash = this.initialSeed ^ 0x9E3779B9;
    for (let i = 0; i < label.length; i++) hash = Math.imul(hash ^ label.charCodeAt(i), 16777619) >>> 0;
    return new SeededRandom(hash || 1);
  }

  snapshot() { return { initialSeed: this.initialSeed, state: this.state >>> 0 }; }
  restore(snapshot) {
    if (!snapshot) return;
    this.initialSeed = Number(snapshot.initialSeed) >>> 0 || 1;
    this.state = Number(snapshot.state) >>> 0 || this.initialSeed;
  }
}
