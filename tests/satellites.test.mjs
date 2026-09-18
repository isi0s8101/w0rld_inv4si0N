import test from "node:test";
import assert from "node:assert/strict";
import satellites from "../src/data/satellites.json" with { type: "json" };

test("Globe embarque 15 satellites stratégiques", () => {
  assert.equal(satellites.length, 15);
  assert.equal(satellites.filter((sat) => sat.type === "MILITARY").length, 5);
  assert.equal(satellites.filter((sat) => sat.type === "CIVIL").length, 5);
  assert.equal(satellites.filter((sat) => sat.type === "INTERNATIONAL").length, 5);
  assert.equal(new Set(satellites.map((sat) => sat.id)).size, satellites.length);
});
