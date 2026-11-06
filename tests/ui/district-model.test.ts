// Living districts model: counts, caps, ordering, stale/unavailable, signed-out, determinism.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { BriefView, OpportunityView } from "../../src/lib/shared/briefmint";
import {
  NOTICE_STALE,
  NOTICE_UNAVAILABLE,
  UNTITLED_BRIEF,
  buildDistrictModel,
  deriveBriefState,
  overflowAnchor,
  plotAriaLabel,
  type DistrictInput,
} from "../../src/components/city/district-model";
import { HOUSE_SLOTS, HOUSE_SLOT_COUNT, TOWER_SLOTS, TOWER_SLOT_COUNT, VACANT_LOT_COUNT, rectContains } from "../../src/components/city/slots";

let seq = 0;
function brief(over: Record<string, unknown> = {}): BriefView {
  seq++;
  const n = String(seq).padStart(4, "0");
  return {
    id: `brief-${n}`,
    createdAt: `2026-01-01T00:${String(seq % 60).padStart(2, "0")}:00.000Z`,
    executionStatus: "ready",
    draftRevision: 1,
    editedDraft: null,
    publicParameters: { title: `Brief ${n}` },
    inputSegments: [{ id: "s1", text: "PRIVATE NOTE TEXT" }],
    immutableModelResult: { secret: "MODEL OUTPUT" },
    review: { status: "unreviewed", approval: null },
    publication: { status: "unpublished", freshness: "fresh", confirmed: null, pending: null },
    ...over,
  } as unknown as BriefView;
}
function opp(over: Record<string, unknown> = {}): OpportunityView {
  seq++;
  const n = String(seq).padStart(4, "0");
  return {
    entityKey: `0x${n}`,
    title: `Opportunity ${n}`,
    status: "open",
    deadline: "2026-03-01T00:00:00.000Z",
    observedAt: "2026-01-01T00:00:00.000Z",
    fetchedAt: "2026-01-01T00:00:00.000Z",
    freshness: "fresh",
    ...over,
  } as unknown as OpportunityView;
}
const input = (over: Partial<DistrictInput> = {}): DistrictInput => ({
  briefs: [],
  opportunities: [],
  freshness: "fresh",
  signedIn: true,
  ...over,
});
const confirmed = { entityKey: "0xabc", expiresAtBlock: "99", observedAt: "2026-01-02T00:00:00.000Z" };
const approval = (rev: number) => ({ status: "approved", approval: { draftRevision: rev } });

test("empty input: no plots, both vacant lots, no notice", () => {
  const m = buildDistrictModel(input());
  assert.equal(m.houses.length, 0);
  assert.equal(m.towers.length, 0);
  assert.equal(m.houseOverflow, 0);
  assert.equal(m.towerOverflow, 0);
  assert.equal(m.vacant.length, VACANT_LOT_COUNT);
  assert.deepEqual(m.vacant.map((v) => v.district), ["brief-house", "opportunity-tower"]);
  assert.deepEqual(m.towerDistrict, { dimmed: false, notice: null });
});

test("one plot per record, assigned in slot order", () => {
  const m = buildDistrictModel(input({ briefs: [brief(), brief(), brief()], opportunities: [opp(), opp()] }));
  assert.equal(m.houses.length, 3);
  assert.equal(m.towers.length, 2);
  m.houses.forEach((h, i) => assert.equal(h.slot, HOUSE_SLOTS[i]));
  m.towers.forEach((t, i) => assert.equal(t.slot, TOWER_SLOTS[i]));
  assert.ok(m.houses.every((h) => h.kind === "brief-house"));
  assert.ok(m.towers.every((t) => t.kind === "opportunity-tower"));
});

test("caps at the slot plan count and reports overflow", () => {
  const briefs = Array.from({ length: HOUSE_SLOT_COUNT + 3 }, () => brief());
  const opps = Array.from({ length: TOWER_SLOT_COUNT + 5 }, () => opp());
  const m = buildDistrictModel(input({ briefs, opportunities: opps }));
  assert.equal(m.houses.length, HOUSE_SLOT_COUNT);
  assert.equal(m.houseOverflow, 3);
  assert.equal(m.towers.length, TOWER_SLOT_COUNT);
  assert.equal(m.towerOverflow, 5);
  const exact = buildDistrictModel(input({ briefs: briefs.slice(0, HOUSE_SLOT_COUNT) }));
  assert.equal(exact.houseOverflow, 0);
});

test("briefs are ordered by createdAt then id, independent of input order", () => {
  const a = brief({ id: "b-b", createdAt: "2026-01-01T00:00:00.000Z" });
  const b = brief({ id: "b-a", createdAt: "2026-01-01T00:00:00.000Z" });
  const c = brief({ id: "b-0", createdAt: "2026-02-01T00:00:00.000Z" });
  const ids = (list: BriefView[]) => buildDistrictModel(input({ briefs: list })).houses.map((h) => h.id);
  assert.deepEqual(ids([c, a, b]), ["b-a", "b-b", "b-0"]);
  assert.deepEqual(ids([b, c, a]), ["b-a", "b-b", "b-0"]);
});

test("towers: open before closed, then deadline, then entity key; overflow drops closed first", () => {
  const closed = opp({ entityKey: "0x01", status: "closed", deadline: "2026-01-01T00:00:00.000Z" });
  const late = opp({ entityKey: "0x02", deadline: "2026-09-01T00:00:00.000Z" });
  const soon = opp({ entityKey: "0x03", deadline: "2026-02-01T00:00:00.000Z" });
  const tie = opp({ entityKey: "0x00", deadline: "2026-02-01T00:00:00.000Z" });
  const m = buildDistrictModel(input({ opportunities: [closed, late, soon, tie] }));
  assert.deepEqual(m.towers.map((t) => t.id), ["0x00", "0x03", "0x02", "0x01"]);
  assert.deepEqual(m.towers.map((t) => t.state), ["open", "open", "open", "closed"]);

  const many = [...Array.from({ length: TOWER_SLOT_COUNT }, () => opp()), opp({ status: "closed" })];
  const capped = buildDistrictModel(input({ opportunities: many }));
  assert.ok(capped.towers.every((t) => t.state === "open"));
  assert.equal(capped.towerOverflow, 1);
});

test("duplicate ids are shown once", () => {
  const b = brief();
  const o = opp();
  const m = buildDistrictModel(input({ briefs: [b, b], opportunities: [o, o] }));
  assert.equal(m.houses.length, 1);
  assert.equal(m.towers.length, 1);
});

test("signed out: no houses even when briefs are supplied; towers still show", () => {
  const m = buildDistrictModel(input({ signedIn: false, briefs: [brief(), brief()], opportunities: [opp()] }));
  assert.equal(m.houses.length, 0);
  assert.equal(m.houseOverflow, 0);
  assert.equal(m.loaded.houses, false);
  assert.equal(m.towers.length, 1);
  assert.equal(m.vacant.length, VACANT_LOT_COUNT);
});

test("unavailable read: no towers, notice, dimmed (never empty)", () => {
  const m = buildDistrictModel(input({ freshness: "unavailable", opportunities: [opp()] }));
  assert.equal(m.towers.length, 0);
  assert.equal(m.towerOverflow, 0);
  assert.equal(m.towerDistrict.notice, NOTICE_UNAVAILABLE);
  assert.equal(m.towerDistrict.dimmed, true);
  assert.equal(m.loaded.towers, false);
});

test("stale read: last confirmed towers kept, dimmed, labelled", () => {
  const m = buildDistrictModel(input({ freshness: "stale", opportunities: [opp(), opp()] }));
  assert.equal(m.towers.length, 2);
  assert.deepEqual(m.towerDistrict, { dimmed: true, notice: NOTICE_STALE });
  const none = buildDistrictModel(input({ freshness: "stale", opportunities: null }));
  assert.equal(none.towers.length, 0);
  assert.equal(none.towerDistrict.notice, NOTICE_UNAVAILABLE);
});

test("not yet loaded (null): no plots, no notice, not loaded", () => {
  const m = buildDistrictModel(input({ briefs: null, opportunities: null }));
  assert.equal(m.houses.length + m.towers.length, 0);
  assert.deepEqual(m.towerDistrict, { dimmed: false, notice: null });
  assert.deepEqual(m.loaded, { houses: false, towers: false });
});

test("brief states come from persisted fields only", () => {
  assert.equal(deriveBriefState(brief({ executionStatus: "draft" })), "draft");
  assert.equal(deriveBriefState(brief({ executionStatus: "running" })), "compiling");
  assert.equal(deriveBriefState(brief({ executionStatus: "failed" })), "failed");
  assert.equal(deriveBriefState(brief({ executionStatus: "interrupted" })), "failed");
  assert.equal(deriveBriefState(brief({ executionStatus: "mystery" })), "unknown");
  assert.equal(deriveBriefState(brief()), "needs review");
  assert.equal(deriveBriefState(brief({ review: approval(1) })), "approved");
  // an approval of an older revision is not current
  assert.equal(deriveBriefState(brief({ review: approval(1), draftRevision: 2 })), "needs review");
  const pub = (status: string, freshness = "fresh", c: unknown = confirmed) => ({ status, freshness, confirmed: c, pending: null });
  assert.equal(deriveBriefState(brief({ publication: pub("pending", "fresh", null) })), "publishing");
  assert.equal(deriveBriefState(brief({ publication: pub("live") })), "live");
  assert.equal(deriveBriefState(brief({ publication: pub("closed") })), "closed");
  assert.equal(deriveBriefState(brief({ publication: pub("expired") })), "expired");
});

test("live needs reconciled evidence and a fresh read", () => {
  const pub = (status: string, freshness: string, c: unknown) => ({ status, freshness, confirmed: c, pending: null });
  assert.equal(deriveBriefState(brief({ publication: pub("live", "fresh", null) })), "publishing");
  assert.equal(deriveBriefState(brief({ publication: pub("live", "fresh", { entityKey: "0x1" }) })), "publishing");
  assert.equal(deriveBriefState(brief({ publication: pub("live", "stale", confirmed) })), "unknown");
  assert.equal(deriveBriefState(brief({ publication: pub("live", "unavailable", confirmed) })), "unknown");
  assert.equal(deriveBriefState(brief({ publication: pub("closed", "unavailable", confirmed) })), "unknown");
});

test("labels are public titles only; fallback is neutral; no private text leaks", () => {
  const edited = brief({ editedDraft: { parameters: { title: "Edited public title" }, sections: { deliverables: ["PRIVATE SECTION"] } } });
  const bare = brief({ publicParameters: { title: "   " } });
  const m = buildDistrictModel(input({ briefs: [edited, bare], opportunities: [opp({ title: "  " })] }));
  assert.equal(m.houses[0].label, "Edited public title");
  assert.equal(m.houses[1].label, UNTITLED_BRIEF);
  assert.equal(m.towers[0].label, "Untitled opportunity");
  assert.equal(plotAriaLabel(m.houses[0]), `Brief: Edited public title, ${m.houses[0].state}`);
  const dump = JSON.stringify({ houses: m.houses.map((h) => [h.label, h.state, h.glyph]), towers: m.towers });
  assert.ok(!dump.includes("PRIVATE") && !dump.includes("MODEL OUTPUT"));
  assert.equal(plotAriaLabel(m.towers[0]), "Opportunity: Untitled opportunity, open");
});

test("every plot has a glyph; open and closed towers differ", () => {
  const m = buildDistrictModel(input({ briefs: [brief()], opportunities: [opp(), opp({ status: "closed" })] }));
  assert.ok(m.houses.every((h) => h.glyph.length > 0));
  assert.notEqual(m.towers[0].glyph, m.towers[1].glyph);
  assert.notEqual(m.towers[0].state, m.towers[1].state);
});

test("deterministic and does not mutate its input", () => {
  const briefs = Array.from({ length: 10 }, () => brief()).reverse();
  const opps = Array.from({ length: 10 }, () => opp());
  const snapshot = JSON.stringify({ briefs, opps });
  const a = buildDistrictModel(input({ briefs, opportunities: opps }));
  const b = buildDistrictModel(input({ briefs, opportunities: opps }));
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify({ briefs, opps }), snapshot);
});

test("overflow anchors lie inside the last plot slot of each district", () => {
  const h = overflowAnchor("brief-house");
  const t = overflowAnchor("opportunity-tower");
  assert.ok(rectContains(HOUSE_SLOTS[HOUSE_SLOTS.length - 1].rect, h));
  assert.ok(rectContains(TOWER_SLOTS[TOWER_SLOTS.length - 1].rect, t));
});
