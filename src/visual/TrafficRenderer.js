import { THEME } from "./Theme.js";

function toVec(lat, lon) {
  const a = lat * Math.PI / 180, b = lon * Math.PI / 180;
  return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)];
}
function fromVec(v) {
  const n = Math.hypot(...v) || 1;
  const x = v[0]/n, y=v[1]/n, z=v[2]/n;
  return { lat: Math.asin(z) * 180 / Math.PI, lon: Math.atan2(y, x) * 180 / Math.PI };
}
function slerp(a, b, t) {
  const av = toVec(a.lat,a.lon), bv=toVec(b.lat,b.lon);
  const dot = Math.max(-1, Math.min(1, av[0]*bv[0]+av[1]*bv[1]+av[2]*bv[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-5) return { lat:a.lat+(b.lat-a.lat)*t, lon:a.lon+(b.lon-a.lon)*t };
  const so = Math.sin(omega), k1=Math.sin((1-t)*omega)/so, k2=Math.sin(t*omega)/so;
  return fromVec([av[0]*k1+bv[0]*k2,av[1]*k1+bv[1]*k2,av[2]*k1+bv[2]*k2]);
}

export class TrafficRenderer {
  render(ctx, routes, nodeNetwork, projection, { alpha = 1, mode = "world", country = null } = {}) {
    for (const route of routes) {
      const from = nodeNetwork.get(route.from), to = nodeNetwork.get(route.to);
      if (!from || !to) continue;
      if (country && from.location.country !== country && to.location.country !== country) continue;
      const samples = mode === "globe" ? 32 : 24;
      const path = [];
      for (let i=0;i<=samples;i++) {
        const geo=slerp(from.location,to.location,i/samples);
        const p=projection.project(geo.lat,geo.lon);
        path.push(p);
      }
      ctx.save();
      ctx.strokeStyle=THEME.traffic; ctx.lineWidth=mode==="country"?1.15:0.72;
      ctx.shadowColor=THEME.traffic; ctx.shadowBlur=7;
      ctx.globalAlpha=alpha*Math.min(0.36,route.opacity*0.50);
      ctx.beginPath(); let started=false;
      for (let i=0;i<path.length;i++) {
        const p=path[i];
        if (!p.visible) { started=false; continue; }
        if (!started) { ctx.moveTo(p.x,p.y); started=true; } else ctx.lineTo(p.x,p.y);
      }
      ctx.stroke();
      const geo=slerp(from.location,to.location,route.progress);
      const pulse=projection.project(geo.lat,geo.lon);
      if (pulse.visible) {
        ctx.globalAlpha=alpha*Math.min(0.85,0.35+route.opacity);
        ctx.fillStyle=THEME.coastStrong; ctx.shadowBlur=14;
        ctx.beginPath(); ctx.arc(pulse.x,pulse.y,mode==="country"?2.4:1.9,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }
}
