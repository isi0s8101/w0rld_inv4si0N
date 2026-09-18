export class GlobeProjection {
  constructor() { this.resize(1, 1); this.setCamera({ rotationX: -0.1, rotationY: -0.3, zoom: 1 }); }
  resize(width, height) {
    this.width = Math.max(1, width); this.height = Math.max(1, height);
    this.centerX = this.width / 2; this.centerY = this.height / 2;
    this.radius = Math.min(this.width, this.height) * 0.34;
  }
  setViewport({ centerX = this.width / 2, centerY = this.height / 2, radius = Math.min(this.width, this.height) * 0.34 } = {}) {
    this.centerX = centerX; this.centerY = centerY; this.radius = radius;
  }
  setCamera(camera) { this.camera = camera; }
  project(lat, lon) {
    const latR = lat * Math.PI / 180;
    const lonR = lon * Math.PI / 180;
    let x = Math.cos(latR) * Math.sin(lonR);
    let y = -Math.sin(latR);
    let z = Math.cos(latR) * Math.cos(lonR);
    const ry = this.camera.rotationY || 0;
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const rx = this.camera.rotationX || 0;
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const y2 = y * cx - z1 * sx;
    const z2 = y * sx + z1 * cx;
    const zoom = this.camera.zoom || 1;
    return {
      x: this.centerX + x1 * this.radius * zoom,
      y: this.centerY + y2 * this.radius * zoom,
      visible: z2 >= -0.02,
      depth: (z2 + 1) / 2,
      z: z2
    };
  }
  containsPoint(x, y) {
    const r = this.radius * (this.camera.zoom || 1);
    return (x - this.centerX) ** 2 + (y - this.centerY) ** 2 <= r * r;
  }
}
