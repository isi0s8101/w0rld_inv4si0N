import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('P0 UI readability manager is integrated',()=>{
  const main=read('src/main.js');
  const mgr=read('src/ui/UIReadabilityManager.js');
  assert.match(main,/UIReadabilityManager/);
  assert.match(mgr,/scale:\s*1\.1/);
  assert.match(mgr,/density:\s*'STANDARD'/);
  assert.match(mgr,/mapLabels:\s*'LARGE'/);
  assert.match(mgr,/MAP FIRST/);
  assert.match(mgr,/localStorage/);
});

test('readability CSS defines scalable typography and large hit targets',()=>{
  const css=read('style.css');
  for(const token of ['--wi-font-xs','--wi-font-sm','--wi-font-md','--wi-font-lg','--wi-control-h','--wi-hit','--wi-left-w','--wi-right-w','--wi-map-label-scale']) assert.ok(css.includes(token),token);
  assert.match(css,/min-height:\s*var\(--wi-control-h\)/);
  assert.match(css,/data-high-contrast/);
  assert.match(css,/data-reduce-noise/);
  assert.match(css,/is-left-collapsed/);
  assert.match(css,/is-right-collapsed/);
});

test('map labels have a floor and an outline for legibility',()=>{
  const labels=read('src/map/LabelManager.js');
  assert.match(labels,/Math\.max\(11/);
  assert.match(labels,/strokeText/);
  assert.match(labels,/--wi-map-label-scale/);
});

test('infrastructure and traffic symbols are enlarged',()=>{
  const infra=read('src/visual/InfrastructureRenderer.js');
  const mobile=read('src/visual/MobileEntityRenderer.js');
  assert.match(infra,/country'\?19:15/);
  assert.match(infra,/700 14px/);
  assert.match(mobile,/country'\?24:mode==='world'\?18:12/);
});

test('viewport supports safe modern responsive rendering',()=>{
  const html=read('index.html');
  assert.match(html,/viewport-fit=cover/);
  assert.match(html,/V1\.3\.1 UI Readability/);
});
