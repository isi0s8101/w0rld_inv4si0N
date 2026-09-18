import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { EventBus } from "../src/core/EventBus.js";
import { StateManager } from "../src/core/StateManager.js";
import { EventEngine } from "../src/core/EventEngine.js";
import { TransitionManager } from "../src/core/TransitionManager.js";
import { SiteInteractionAPI } from "../src/core/SiteInteractionAPI.js";
import { WorldEngine } from "../src/world/WorldEngine.js";

const load = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

function transitionFixtures() {
  const bus = new EventBus();
  const state = new StateManager(bus); state.setRuntime({time:0,delta:0,elapsed:0});
  const nodeNetwork={setState(){},surge(){},pickNode(){return null},get(){return null}};
  const traffic={pickRoute(){return null},startFromEvent(){}};
  const events=new EventEngine(bus,state,nodeNetwork,traffic);
  const camera={toWorld(){},toGlobe(){},focusCountry(){}};
  return {bus,state,events,transitions:new TransitionManager(bus,state,events,camera)};
}

test("contrat SiteInteractionAPI V1 complet", () => {
  const methods = ["toGlobe","toWorld","selectCountry","clearCountry","highlightCountry","highlightRegion","focusRegion","focusNode","setIntensity","setMode","reset","on","off"];
  for (const name of methods) assert.equal(typeof SiteInteractionAPI.prototype[name], "function", name);
});

test("LOD 0/1/2 existe réellement et LOD2 est plus dense", async () => {
  const nodes=await load("../src/data/nodes.json");
  const counts=[0,1,2].map(lod=>nodes.filter(n=>n.minLod<=lod).length);
  assert.ok(counts[0] > 0);
  assert.ok(counts[1] > counts[0]);
  assert.ok(counts[2] > counts[1]);
});

test("hover géographique retrouve la France pour Paris", async () => {
  const world=await load("../src/data/world.geojson");
  const e=new WorldEngine(); e.geojson=world; e.features=world.features; e.byCode=new Map(world.features.map(f=>[f.properties.iso2,f]));
  assert.equal(e.findCountry(2.3522,48.8566)?.properties.iso2,"FR");
});

test("Country France utilise un focus métropolitain exploitable", async () => {
  const world=await load("../src/data/world.geojson");
  const fr=world.features.find(f=>f.properties.iso2==="FR");
  assert.ok(fr.properties.focusBounds[0] > -10);
  assert.ok(fr.properties.focusBounds[2] < 15);
});

test("clear country revient à WORLD puis WORLD peut revenir à GLOBE", () => {
  const {state,transitions}=transitionFixtures();
  state.setView("WORLD"); state.get().runtime.elapsed=0;
  transitions.selectCountry("FR"); state.get().runtime.elapsed=1; transitions.update();
  assert.equal(state.get().view,"COUNTRY");
  transitions.clearCountry(); state.get().runtime.elapsed=2; transitions.update();
  assert.equal(state.get().view,"WORLD");
  transitions.toGlobe(); state.get().runtime.elapsed=4; transitions.update();
  assert.equal(state.get().view,"GLOBE");
});

test("reduced-motion raccourcit la transition sans casser la navigation", () => {
  const {state,transitions}=transitionFixtures();
  transitions.setReducedMotion(true); state.setView("GLOBE"); state.get().runtime.elapsed=1;
  transitions.toWorld();
  assert.ok(transitions.current.duration <= 0.3);
  state.get().runtime.elapsed=1.5; transitions.update();
  assert.equal(state.get().view,"WORLD");
});

test("renderers ne génèrent pas leurs propres événements aléatoires", async () => {
  const files=["ParticleRenderer.js","CoastlineRenderer.js","NodeRenderer.js","TrafficRenderer.js","EventRenderer.js","GlowRenderer.js","ScanRenderer.js","VisualEngine.js"];
  for(const file of files){const src=await readFile(new URL(`../src/visual/${file}`,import.meta.url),"utf8");assert.equal(src.includes("Math.random"),false,file);}
});

test("responsive, reduced-motion et navigation DOM sont présents", async () => {
  const [css,html,app]=await Promise.all([
    readFile(new URL("../style.css",import.meta.url),"utf8"),
    readFile(new URL("../index.html",import.meta.url),"utf8"),
    readFile(new URL("../src/core/App.js",import.meta.url),"utf8")
  ]);
  assert.match(css,/max-width:\s*1099px/); assert.match(css,/max-width:\s*699px/); assert.match(css,/prefers-reduced-motion/);
  assert.match(html,/cyber-a11y-nav/); assert.match(html,/data-country-select/); assert.match(app,/tabIndex\s*=\s*0/); assert.match(app,/role",\s*"application/);
});

test("génération terrain haute qualité reste bornée", async () => {
  const [world,countries]=await Promise.all([load("../src/data/world.geojson"),load("../src/data/countries.json")]);
  const e=new WorldEngine(); e.geojson=world; e.features=world.features; e.countries=countries; e.byCode=new Map(world.features.map(f=>[f.properties.iso2,f]));
  const t0=performance.now(); const points=e.terrainPoints(5200); const elapsed=performance.now()-t0;
  assert.equal(points.length,5200); assert.ok(elapsed < 1000, `terrain ${elapsed.toFixed(1)}ms`);
});

test("COUNTRY est rendu sur le canvas principal et la mini-vue devient World", async () => {
  const visual=await readFile(new URL("../src/visual/VisualEngine.js",import.meta.url),"utf8");
  const worldView=await readFile(new URL("../src/views/WorldView.js",import.meta.url),"utf8");
  assert.match(visual,/state\.view==="COUNTRY"\s*&&\s*state\.selectedCountry\)\s*this\.renderCountry\(this\.ctx/);
  assert.match(visual,/state\.selectedCountry\|\|state\.view==="COUNTRY"\)\s*this\.renderWorld\(ctx,state,1,\{mini:true\}\)/);
  assert.match(visual,/t\.type==="select-country"[\s\S]*this\.renderCountry\(this\.ctx,state,t\.meta\.to,p\)/);
  assert.match(worldView,/return s\.view==="WORLD"&&!s\.transition\.active/);
});
