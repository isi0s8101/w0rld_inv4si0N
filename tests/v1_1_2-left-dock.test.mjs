import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Navigator est docké à gauche pour ne pas empiéter sur la zone principale", async () => {
  const css = await readFile(new URL("../style.css", import.meta.url), "utf8");
  assert.match(css, /\.cyber-mini-nav\s*\{[\s\S]*left:\s*clamp\(24px,\s*2\.1vw,\s*36px\)/);
  assert.match(css, /\.cyber-mini-nav\s*\{[\s\S]*top:\s*clamp\(24px,\s*7vh,\s*72px\)/);
  assert.match(css, /\.cyber-mini-nav\.is-visible\s*\{[\s\S]*translateX\(0\)\s*scale\(1\)/);
  assert.match(css, /@media \(max-width: 699px\)\s*\{[\s\S]*\.cyber-mini-nav\s*\{[\s\S]*left:\s*12px;[\s\S]*top:\s*12px;/);
  assert.match(css, /\.cyber-focus-info\s*\{[\s\S]*overflow:\s*auto/);
});
