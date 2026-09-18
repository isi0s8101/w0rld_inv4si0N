export class TrafficRoute {
  constructor({ id, from, to, startTime, duration, intensity = 0.6 }) {
    this.id = id;
    this.from = from;
    this.to = to;
    this.startTime = startTime;
    this.duration = duration;
    this.intensity = intensity;
    this.progress = 0;
    this.opacity = 0;
    this.completed = false;
  }

  update(now) {
    this.progress = Math.max(0, Math.min(1, (now - this.startTime) / this.duration));
    this.opacity = Math.sin(this.progress * Math.PI) * this.intensity;
    this.completed = this.progress >= 1;
  }
}
