import { SCENES } from "../config/scenes.js";
import { THEME } from "../visual/Theme.js";
export class SceneManager {
  constructor(bus, sections = []) {
    this.bus = bus; this.sections = [...sections]; this.current = "HERO";
    this.target = { ...SCENES.HERO }; this.values = { ...SCENES.HERO };
    this.progress = 0; this.enabled = true; this.observer = null;
  }
  init() {
    this.observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) this.setScene(visible.target.dataset.scene);
    }, { threshold: [0.15, 0.35, 0.6, 0.85] });
    this.sections.forEach((section) => this.observer.observe(section));
  }
  setScene(scene) {
    if (!SCENES[scene]) return false;
    if (scene !== this.current) {
      const previous = this.current; this.bus.emit("scene:leave", { scene: previous });
      this.current = scene; this.target = { ...SCENES[scene] };
      this.bus.emit("scene:enter", { scene, previous });
    }
    return true;
  }
  update(dt) {
    if (!this.enabled) return;
    const section = this.sections.find((item) => item.dataset.scene === this.current);
    if (section) {
      const rect = section.getBoundingClientRect();
      this.progress = Math.max(0, Math.min(1, (innerHeight - rect.top) / Math.max(1, rect.height + innerHeight)));
      this.bus.emit("scene:progress", { scene: this.current, progress: this.progress });
    }
    const mix = 1 - Math.exp(-THEME.transitionSpeed * dt);
    for (const key of Object.keys(this.values)) this.values[key] += (this.target[key] - this.values[key]) * mix;
  }
  setEnabled(value) { this.enabled = value; }
  destroy() { this.observer?.disconnect(); }
}
