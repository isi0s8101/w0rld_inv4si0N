export class ProjectionAdapter {
  constructor({ globe, world, country }) {
    this.projections = { globe, world, country };
    this.mode = "world";
  }
  use(mode) { if (this.projections[mode]) this.mode = mode; return this.projections[this.mode]; }
  get(mode = this.mode) { return this.projections[mode]; }
  project(lat, lon, mode = this.mode) { return this.projections[mode].project(lat, lon); }
}
