import { THEME } from "./Theme.js";

export class GlowRenderer {
  background(ctx, width, height, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const base = ctx.createRadialGradient(
      width * 0.50, height * 0.44, 0,
      width * 0.50, height * 0.46, Math.max(width, height) * 0.78
    );
    base.addColorStop(0, "#0c2230");
    base.addColorStop(0.34, "#081924");
    base.addColorStop(0.66, THEME.background);
    base.addColorStop(1, THEME.backgroundDeep);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    const vertical = ctx.createLinearGradient(0, 0, 0, height);
    vertical.addColorStop(0, "rgba(25,88,118,0.055)");
    vertical.addColorStop(0.30, "rgba(0,234,255,0.012)");
    vertical.addColorStop(0.72, "rgba(0,0,0,0)");
    vertical.addColorStop(1, "rgba(0,0,0,0.20)");
    ctx.fillStyle = vertical;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = "screen";
    const ambient = ctx.createRadialGradient(
      width * 0.52, height * 0.48, 0,
      width * 0.52, height * 0.48, Math.max(width, height) * 0.42
    );
    ambient.addColorStop(0, "rgba(0,234,255,0.032)");
    ambient.addColorStop(0.48, "rgba(0,165,210,0.014)");
    ambient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ambient;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  }

  globeAtmosphere(ctx, projection, alpha = 1) {
    const r = projection.radius * (projection.camera.zoom || 1);
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const outer = ctx.createRadialGradient(
      projection.centerX, projection.centerY, r * 0.72,
      projection.centerX, projection.centerY, r * 1.18
    );
    outer.addColorStop(0, "rgba(0,234,255,0)");
    outer.addColorStop(0.68, "rgba(0,234,255,0.018)");
    outer.addColorStop(0.88, "rgba(0,234,255,0.065)");
    outer.addColorStop(1, "rgba(0,234,255,0.19)");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(projection.centerX, projection.centerY, r * 1.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha * 0.34;
    ctx.strokeStyle = THEME.coast;
    ctx.lineWidth = 1.05;
    ctx.shadowColor = THEME.node;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(projection.centerX, projection.centerY, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.10;
    ctx.lineWidth = 4.2;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(projection.centerX, projection.centerY, r * 1.006, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
