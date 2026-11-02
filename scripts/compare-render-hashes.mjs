import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const [reference, candidate] = process.argv
  .slice(2)
  .map((p) => JSON.parse(readFileSync(p, "utf8")));
assert.equal(
  Object.keys(reference).length,
  168,
  "Expected all 168 reference fixtures",
);
assert.deepEqual(
  candidate,
  reference,
  "Visual fixtures must be byte-identical",
);
console.log("PASS: 168 byte-identical PNG fixtures");
