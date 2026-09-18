import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeClock } from "../src/core/RuntimeClock.js";

test("RuntimeClock conserve elapsed après resume",()=>{
  const c=new RuntimeClock(); c.start(1000); c.tick(1020); const before=c.elapsed;
  c.resume(5000); c.tick(5020);
  assert.ok(c.elapsed > before);
  assert.ok(c.elapsed < before + 0.05);
});
