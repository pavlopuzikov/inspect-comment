// Node's built-in runner, so the repo keeps zero dependencies of any kind:
//
//   node --test
//
// These cover the contrast maths specifically, because it is the one part of
// the tool that produces a verdict rather than a description. A wrong selector
// is visibly wrong to whoever reads the note. A wrong contrast ratio is a
// confident number that nobody re-checks.

import { test } from "node:test";
import assert from "node:assert/strict";

import { blend, contrastRatio, wcagRequirement } from "../src/inspect-comment.js";

const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };

/** Contrast of a possibly translucent foreground against an opaque backdrop. */
const against = (fg, bg) => contrastRatio(blend(fg, bg), bg);
const round = (n) => Math.round(n * 100) / 100;

test("the two anchors of the scale", () => {
  assert.equal(round(contrastRatio(BLACK, WHITE)), 21);
  assert.equal(round(contrastRatio(WHITE, WHITE)), 1);
});

test("ratio is symmetric", () => {
  const a = { r: 40, g: 74, b: 92, a: 1 };
  assert.equal(contrastRatio(a, WHITE), contrastRatio(WHITE, a));
});

// The regression this whole file exists for. Dropping the alpha reported these
// as pure black, i.e. 21:1, which passes AA at any size. Two of the three
// actually fail.
test("translucent text is composited, not read as opaque", () => {
  const cases = [
    // [css alpha, expected ratio on white, passes AA at body size]
    [0.54, 4.59, true],
    [0.38, 2.68, false],
    [0.26, 1.88, false],
  ];
  for (const [a, expected, passes] of cases) {
    const ratio = against({ ...BLACK, a }, WHITE);
    assert.equal(round(ratio), expected, `alpha ${a}`);
    assert.equal(ratio >= 4.5, passes, `alpha ${a} AA verdict`);
    assert.ok(ratio < 21, `alpha ${a} must not read as opaque black`);
  }
});

test("rgba(0,0,0,0.38) on white fails AA, the case that used to pass", () => {
  const ratio = against({ ...BLACK, a: 0.38 }, WHITE);
  assert.ok(ratio < wcagRequirement(16, "400"), "should fail at body size");
  assert.ok(ratio < wcagRequirement(30, "400"), "should fail even at large size");
});

test("alpha 1 is left exactly alone", () => {
  const c = { r: 17, g: 24, b: 39, a: 1 };
  assert.deepEqual(blend(c, WHITE), { r: 17, g: 24, b: 39, a: 1 });
});

test("fully transparent foreground becomes the backdrop, giving 1:1", () => {
  assert.equal(round(against({ ...BLACK, a: 0 }, WHITE)), 1);
});

test("blend is linear at the midpoint", () => {
  const mid = blend({ ...BLACK, a: 0.5 }, WHITE);
  assert.equal(round(mid.r), 127.5);
  assert.equal(mid.a, 1);
});

test("a translucent backdrop layer changes the answer", () => {
  // White text on a black scrim over a white page. Reading the scrim as opaque
  // black says 21:1; at 50% the scrim is mid-grey and the real answer is ~4:1.
  const scrim = blend({ ...BLACK, a: 0.5 }, WHITE);
  const ratio = contrastRatio(WHITE, scrim);
  assert.ok(ratio > 3.9 && ratio < 4.1, `expected ~4:1, got ${ratio}`);
  assert.ok(ratio < 21);
});

test("AA thresholds follow the size and weight rule", () => {
  assert.equal(wcagRequirement(16, "400"), 4.5);
  assert.equal(wcagRequirement(23.9, "400"), 4.5);
  assert.equal(wcagRequirement(24, "400"), 3, "24px is large text");
  assert.equal(wcagRequirement(18.66, "700"), 3, "18.66px bold is large text");
  assert.equal(wcagRequirement(18.66, "400"), 4.5, "not large unless bold");
  assert.equal(wcagRequirement(18.65, "700"), 4.5, "just under the bold cutoff");
});

test("weight is accepted as a number or a string", () => {
  assert.equal(wcagRequirement(20, 700), wcagRequirement(20, "700"));
});
