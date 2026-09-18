import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("display polish enrichit profondeur de fond et cadre visuel sans interaction pointeur globale", async () => {
  const [html, css, glow] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../style.css", import.meta.url), "utf8"),
    readFile(new URL("../src/visual/GlowRenderer.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /cyber-ambient/);
  assert.match(html, /cyber-frame/);
  assert.match(css, /\.cyber-frame/);
  assert.match(css, /backdrop-filter:\s*blur\(12px\)/);
  assert.match(glow, /globalCompositeOperation\s*=\s*"screen"/);
  assert.doesNotMatch(css, /cursor-halo|pointer-glow|mouse-repel/i);
});

test("Focus Panel améliore hiérarchie et lisibilité du statut moteur", async () => {
  const [panel, css, app] = await Promise.all([
    readFile(new URL("../src/ui/FocusPanel.js", import.meta.url), "utf8"),
    readFile(new URL("../style.css", import.meta.url), "utf8"),
    readFile(new URL("../src/core/App.js", import.meta.url), "utf8")
  ]);
  assert.match(panel, /row\.dataset\.key = label/);
  assert.match(panel, /is-engine/);
  assert.match(panel, /is-activity-/);
  assert.match(css, /grid-template-columns/);
  assert.match(css, /is-activity-high/);
  assert.match(app, /width:\s*304,\s*height:\s*174/);
  assert.match(app, /aria-live/);
});
