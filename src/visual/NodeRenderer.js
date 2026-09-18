import { THEME } from "./Theme.js";

export class NodeRenderer {
  render(ctx, nodes, projection, { alpha = 1, country = null, mode = "world", networkIntensity = 0.34 } = {}) {
    const now = performance.now() / 1000;
    for (const node of nodes) {
      const p = projection.project(node.location.lat, node.location.lon);
      if (!p.visible) continue;
      const isLocal = !country || node.location.country === country;
      const active = node.state !== "idle";
      const pulse = 1 + Math.sin(node.phase) * 0.15 + (active ? 0.22 : 0);
      const scale = mode === "country" ? 1.25 : mode === "globe" ? 0.82 : 1;
      const r = (1.3 + node.importance * 1.35) * scale * pulse;
      const depth = mode === "globe" ? 0.35 + p.depth * 0.75 : 1;
      ctx.save();
      ctx.globalAlpha = alpha * depth * (0.40 + networkIntensity * 0.42) * (isLocal ? 1 : 0.68);
      ctx.fillStyle = active ? THEME.nodeActive : THEME.node;
      ctx.strokeStyle = THEME.coast;
      ctx.shadowColor = THEME.node;
      ctx.shadowBlur = active ? 16 : 9;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha *= active ? 0.72 : 0.38;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * (2.8 + (now % 1) * 0.15), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
}
