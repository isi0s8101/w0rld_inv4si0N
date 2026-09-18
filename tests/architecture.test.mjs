import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const required = [
  "src/core/StateManager.js","src/core/EventEngine.js","src/core/TransitionManager.js","src/core/SiteInteractionAPI.js",
  "src/world/WorldEngine.js","src/world/WorldProjection.js","src/world/GlobeProjection.js","src/world/CountryProjection.js","src/world/ProjectionAdapter.js",
  "src/network/NodeNetwork.js","src/network/TrafficEngine.js","src/camera/CameraEngine.js","src/visual/VisualEngine.js",
  "src/views/GlobeView.js","src/views/WorldView.js","src/views/CountryView.js"
];

test("architecture V1 présente", async()=>{for(const rel of required) await access(new URL(rel,root));});

test("App n'active plus répulsion, halo ou parallaxe pointeur", async()=>{
  const app=await readFile(new URL("src/core/App.js",root),"utf8");
  assert.equal(app.includes("PointerController"),false);
  assert.equal(app.includes("ParallaxController"),false);
  const css=await readFile(new URL("style.css",root),"utf8");
  assert.equal(css.includes("pointer-halo"),false);
});
