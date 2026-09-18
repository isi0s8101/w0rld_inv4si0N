import test from "node:test";
import assert from "node:assert/strict";
import { WorldProjection } from "../src/world/WorldProjection.js";
import { GlobeProjection } from "../src/world/GlobeProjection.js";
import { CountryProjection } from "../src/world/CountryProjection.js";

test("WorldProjection round-trip lat/lon", () => {
  const p = new WorldProjection(); p.resize(1600, 900); p.setCamera({centerX:2.3,centerY:48.8,zoom:1.02});
  const screen = p.project(48.8566, 2.3522);
  const geo = p.unproject(screen.x, screen.y);
  assert.ok(Math.abs(geo.lat - 48.8566) < 1e-6);
  assert.ok(Math.abs(geo.lon - 2.3522) < 1e-6);
});

test("GlobeProjection différencie face avant et arrière", () => {
  const p = new GlobeProjection(); p.resize(1200, 800); p.setCamera({rotationX:0,rotationY:0,zoom:1});
  assert.equal(p.project(0,0).visible, true);
  assert.equal(p.project(0,180).visible, false);
});

test("CountryProjection centre le pays dans son viewport", () => {
  const p = new CountryProjection(); p.resize(200,200);
  p.setFeature({properties:{bounds:[-5,42,8,51]}});
  const c=p.project(46.5,1.5);
  assert.ok(Math.abs(c.x-100)<1);
  assert.ok(Math.abs(c.y-100)<1);
});
