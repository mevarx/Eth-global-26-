// Explainer landmarks: one explainer per landmark slot, complete sections, no finance wording.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SLOTS } from "../../src/components/city/slots";
import { EXPLAINERS, EXPLAINER_IDS, explainerForLandmark } from "../../src/components/city/explainers";

const landmarkSlots = SLOTS.filter((s) => s.role === "landmark");

test("every landmark slot has exactly one explainer", () => {
  assert.equal(landmarkSlots.length, EXPLAINER_IDS.length);
  for (const s of landmarkSlots) {
    if (s.role !== "landmark") continue;
    const matches = EXPLAINER_IDS.filter((id) => EXPLAINERS[id].landmark === s.landmark);
    assert.equal(matches.length, 1, s.landmark);
    assert.equal(explainerForLandmark(s.landmark).id, matches[0]);
  }
});

test("all four sections are non-empty and the id keys match", () => {
  for (const id of EXPLAINER_IDS) {
    const e = EXPLAINERS[id];
    assert.equal(e.id, id);
    assert.equal(e.tag, "EXPLAINER");
    assert.ok(e.title.trim());
    assert.ok(e.whatItIs.trim());
    assert.ok(e.whyWeUseIt.trim());
    assert.ok(e.doesNotProve.length > 0 && e.doesNotProve.every((t) => t.trim()));
    assert.ok(e.whereYouSeeIt.trim());
  }
});

test("no finance or payment wording outside the required reminder", () => {
  const banned = /\b(usdt|coins?|receipts?|paid|balances?|savings|cash flow|funds?|funded|payments?)\b/i;
  for (const id of EXPLAINER_IDS) {
    const e = EXPLAINERS[id];
    const text = [e.title, e.whatItIs, e.whyWeUseIt, ...e.doesNotProve, e.whereYouSeeIt, ...(e.steps ?? []).map((s) => `${s.name} ${s.text}`)].join("\n");
    assert.doesNotMatch(text, banned, id);
  }
  assert.match(EXPLAINERS["how-it-works"].reminder ?? "", /unfunded/);
  assert.match(EXPLAINERS["how-it-works"].reminder ?? "", /never holds or moves funds/);
  for (const id of EXPLAINER_IDS) {
    if (id !== "how-it-works") assert.equal(EXPLAINERS[id].reminder, undefined);
  }
});
