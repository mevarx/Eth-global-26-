// Pure-helper tests for the BriefMint glass panel: PRD §10 pipeline states (incl. stale and
// unavailable), readiness, public footprint, opportunity list states, chips and tabs. (Glass look is fixed; the settings helpers are gone.)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRIGHTEST_SCENE_HEX,
  CITY_MIN_TEXT_GLASS_OPACITY,
  GLASS_TINT_ALPHA,
  GLASS_UNDERLAY_ALPHA,
  GLASS_WELL_ALPHA,
  activeStage,
  briefStateChips,
  deriveReadiness,
  derivePipeline,
  derivePublicFootprint,
  nextTabIndex,
  opportunitiesViewState,
  recentBriefs,
  sessionLabel,
  type PipelineStage,
} from "../../src/components/hud/briefmint-panel-data";
import { NO_BRIEF_INPUT, type CityStateInput } from "../../src/components/city/city-state";
import { composite, contrastRatio, TEXT_PRIMARY_HEX, TEXT_SECONDARY_HEX, GLASS_PANEL_HEX } from "../../src/lib/ui/contrast";
import type { BriefSummary, BriefmintConfig, OpportunityView } from "../../src/lib/shared/briefmint";

const input = (patch: Partial<CityStateInput>): CityStateInput => ({ ...NO_BRIEF_INPUT, briefId: "0xabc", ...patch });
const states = (s: PipelineStage[]) => s.map((x) => `${x.id}:${x.state}`).join(" ");
const READY = { execution: "ready" as const };
const APPROVED = { ...READY, review: "approved" as const, approvalCurrent: true };

test("pipeline: four stages in order, never a percentage", () => {
  const s = derivePipeline(NO_BRIEF_INPUT);
  assert.deepEqual(s.map((x) => x.label), ["Compile", "Review", "Approve", "Publish"]);
  for (const x of s) assert.doesNotMatch(x.detail, /%/);
});

test("pipeline: no brief, draft, running", () => {
  assert.equal(states(derivePipeline(NO_BRIEF_INPUT)), "compile:upcoming review:upcoming approve:upcoming publish:upcoming");
  assert.equal(states(derivePipeline(input({ execution: "draft" }))), "compile:current review:upcoming approve:upcoming publish:upcoming");
  const running = derivePipeline(input({ execution: "running" }));
  assert.equal(running[0].state, "current");
  assert.match(running[0].detail, /No time estimate/);
});

test("pipeline: failed and interrupted compilation need attention and block later stages", () => {
  for (const execution of ["failed", "interrupted"] as const) {
    const s = derivePipeline(input({ execution }));
    assert.equal(states(s), "compile:blocked review:upcoming approve:upcoming publish:upcoming");
    assert.equal(activeStage(s)?.id, "compile");
  }
});

test("pipeline: ready but unreviewed waits at Review", () => {
  const s = derivePipeline(input(READY));
  assert.equal(states(s), "compile:done review:current approve:upcoming publish:upcoming");
  assert.equal(activeStage(s)?.id, "review");
});

test("pipeline: approval of an older revision does not count (edited after approval)", () => {
  const s = derivePipeline(input({ ...READY, review: "approved", approvalCurrent: false }));
  assert.equal(states(s), "compile:done review:current approve:upcoming publish:upcoming");
  assert.match(s[1].detail, /Edited since/);
});

test("pipeline: approved current revision is ready to publish", () => {
  const s = derivePipeline(input(APPROVED));
  assert.equal(states(s), "compile:done review:done approve:done publish:current");
  assert.match(s[3].detail, /Ready to publish/);
});

test("pipeline: pending publication waits and is not live", () => {
  const s = derivePipeline(input({ ...APPROVED, publication: "pending" }));
  assert.equal(s[3].state, "current");
  assert.match(s[3].detail, /Not live until confirmed/);
});

test("pipeline: 'live' without confirmed entity evidence is still pending", () => {
  const s = derivePipeline(input({ ...APPROVED, publication: "live", publicationConfirmed: false }));
  assert.equal(s[3].state, "current");
  assert.doesNotMatch(s[3].detail, /^Live/);
});

test("pipeline: confirmed live, closed and expired are done", () => {
  const base = { ...APPROVED, publicationConfirmed: true, observedAt: "2026-01-01T00:00:00Z" };
  const live = derivePipeline(input({ ...base, publication: "live" }));
  assert.equal(states(live), "compile:done review:done approve:done publish:done");
  assert.match(live[3].detail, /^Live on Arkiv/);
  assert.match(derivePipeline(input({ ...base, publication: "closed" }))[3].detail, /Closed on Arkiv/);
  assert.match(derivePipeline(input({ ...base, publication: "expired" }))[3].detail, /Expired on Arkiv/);
});

test("pipeline: live record edited since publication stays done but says edits are unpublished", () => {
  const s = derivePipeline(input({
    ...READY, review: "unreviewed", approvalCurrent: false, publication: "live", publicationConfirmed: true,
  }));
  assert.equal(s[3].state, "done");
  assert.match(s[3].detail, /Edits stay unpublished/);
  assert.equal(s[1].state, "current");
});

test("pipeline: stale and unavailable registry reads never imply closure or expiry", () => {
  const base = { ...APPROVED, publication: "live" as const, publicationConfirmed: true };
  const stale = derivePipeline(input({ ...base, freshness: "stale" }));
  assert.equal(stale[3].state, "stale");
  assert.match(stale[3].detail, /not closure or expiry/);
  assert.match(stale[3].detail, /Last confirmed status: live/);
  const gone = derivePipeline(input({ ...base, freshness: "unavailable" }));
  assert.equal(gone[3].state, "unavailable");
  assert.match(gone[3].detail, /unavailable/);
  assert.equal(activeStage(gone)?.id, "publish");
});

const cfg = (a: boolean, c: boolean, k: boolean): BriefmintConfig =>
  ({
    auth: { readiness: { available: a, reason: a ? null : "Signer offline" } },
    compilation: { available: c, reason: c ? null : null },
    arkiv: { readiness: { available: k, reason: k ? null : "RPC down" } },
  }) as unknown as BriefmintConfig;

test("readiness: real ok/unavailable from config, with reasons", () => {
  const r = deriveReadiness(cfg(true, false, false), null);
  assert.deepEqual(r.map((x) => `${x.id}:${x.state}`), ["sign-in:ok", "compilation:unavailable", "arkiv:unavailable"]);
  assert.match(r[1].detail, /Reported unavailable/);
  assert.equal(r[2].detail, "RPC down");
});

test("readiness: failed config read is unavailable, pending read is checking", () => {
  assert.ok(deriveReadiness(null, "BriefMint config unavailable.").every((x) => x.state === "unavailable"));
  assert.ok(deriveReadiness(null, null).every((x) => x.state === "checking"));
});

test("session label", () => {
  assert.equal(sessionLabel(null, false), "Not signed in");
  assert.equal(sessionLabel(null, true), "Checking sign-in…");
  assert.equal(sessionLabel("0x1234567890abcdef1234567890abcdef12345678", false), "Signed in as 0x1234…5678");
});

const OWNER = "0xAaaaAaaaAaaaAaaaAaaaAaaaAaaaAaaaAaaaAaaa";
const opp = (n: number, status: "open" | "closed", owner = OWNER, freshness: "fresh" | "stale" = "fresh") =>
  ({ entityKey: `0x${n}`, ownerAddress: owner, status, category: "writing", freshness }) as unknown as OpportunityView;
const fp = (patch: Partial<Parameters<typeof derivePublicFootprint>[0]>) =>
  derivePublicFootprint({
    ownerAddress: OWNER,
    opportunities: [],
    loading: false,
    error: null,
    stale: false,
    lastRefreshedAt: "2026-01-01T00:00:00Z",
    filters: { status: "all" },
    ...patch,
  });

test("footprint: counts only the owner's records, case-insensitive", () => {
  const f = fp({ opportunities: [opp(1, "open"), opp(2, "open"), opp(3, "closed"), opp(4, "open", "0xBbbb")], ownerAddress: OWNER.toLowerCase() });
  assert.deepEqual(f.live, { kind: "count", value: 2, stale: false, scope: null });
  assert.deepEqual(f.closed, { kind: "count", value: 1, stale: false, scope: null });
});

test("footprint: signed out, never read and failed read are unavailable, never zero", () => {
  assert.equal(fp({ ownerAddress: null }).live.kind, "unavailable");
  assert.equal(fp({ lastRefreshedAt: null, error: "failed" }).closed.kind, "unavailable");
  assert.equal(fp({ lastRefreshedAt: null, loading: true }).live.kind, "checking");
});

test("footprint: stale list is flagged; status filter hides the other bucket", () => {
  const stale = fp({ opportunities: [opp(1, "open")], stale: true, error: "x" });
  assert.equal(stale.live.kind === "count" && stale.live.stale, true);
  const open = fp({ opportunities: [opp(1, "open")], filters: { status: "open" } });
  assert.equal(open.live.kind, "count");
  assert.equal(open.closed.kind, "unavailable");
  const closed = fp({ opportunities: [opp(3, "closed")], filters: { status: "closed" } });
  assert.equal(closed.live.kind, "unavailable");
  assert.equal(closed.closed.kind, "count");
});

test("footprint: category filter marks counts as scoped; non-fresh records mark stale", () => {
  const f = fp({ opportunities: [opp(1, "open", OWNER, "stale")], filters: { status: "all", category: "design" } });
  assert.equal(f.live.kind === "count" && f.live.scope, "design only");
  assert.equal(f.live.kind === "count" && f.live.stale, true);
});

test("opportunity list states are distinct", () => {
  const base = { loading: false, error: null, stale: false, total: 0, shown: 0, hasRead: true };
  assert.equal(opportunitiesViewState({ ...base, loading: true }).kind, "loading");
  assert.equal(opportunitiesViewState({ ...base, error: "Arkiv query failed" }).kind, "failed");
  assert.equal(opportunitiesViewState({ ...base }).kind, "empty");
  assert.equal(opportunitiesViewState({ ...base, hasRead: false }).kind, "loading");
  assert.equal(opportunitiesViewState({ ...base, total: 4, shown: 4, stale: true, error: "x" }).kind, "stale");
  assert.equal(opportunitiesViewState({ ...base, total: 4, shown: 0 }).kind, "no-match");
  const ready = opportunitiesViewState({ ...base, total: 4, shown: 2, loading: true });
  assert.deepEqual(ready, { kind: "ready", refreshing: true });
});

test("brief chips: execution, approval and publication, with stale and unavailable reads", () => {
  const chips = (patch: Partial<Parameters<typeof briefStateChips>[0]>) =>
    briefStateChips({ executionStatus: "ready", reviewStatus: "approved", publicationStatus: "unpublished", freshness: "fresh", ...patch })
      .map((c) => `${c.key}:${c.label}:${c.tone}`);
  assert.deepEqual(chips({}), ["execution:Compiled:ok", "review:Approved:ok", "publication:Unpublished:muted"]);
  assert.equal(chips({ executionStatus: "failed" })[0], "execution:Compile failed:danger");
  assert.equal(chips({ executionStatus: "interrupted" })[0], "execution:Interrupted:warn");
  assert.equal(chips({ executionStatus: "draft", reviewStatus: "unreviewed" }).slice(0, 2).join(), "execution:Draft:muted,review:Not approved:muted");
  assert.equal(chips({ publicationStatus: "pending" })[2], "publication:Awaiting confirmation:warn");
  assert.equal(chips({ publicationStatus: "live" })[2], "publication:Live:ok");
  assert.equal(chips({ publicationStatus: "live", freshness: "stale" })[2], "publication:Live: stale read:warn");
  assert.equal(chips({ publicationStatus: "closed", freshness: "unavailable" })[2], "publication:Closed: read unavailable:warn");
  assert.equal(chips({ publicationStatus: "expired" })[2], "publication:Expired:muted");
});

test("recent briefs: newest first, limited, input untouched", () => {
  const b = (id: string, updatedAt: string) => ({ id, updatedAt }) as unknown as BriefSummary;
  const list = [b("a", "2026-01-01T00:00:00Z"), b("c", "2026-03-01T00:00:00Z"), b("b", "2026-02-01T00:00:00Z"), b("d", "bad")];
  assert.deepEqual(recentBriefs(list, 3).map((x) => x.id), ["c", "b", "a"]);
  assert.deepEqual(list.map((x) => x.id), ["a", "c", "b", "d"]);
  assert.equal(recentBriefs(list, 0).length, 0);
});

test("tab keyboard model wraps and jumps", () => {
  assert.equal(nextTabIndex("ArrowRight", 3, 4), 0);
  assert.equal(nextTabIndex("ArrowLeft", 0, 4), 3);
  assert.equal(nextTabIndex("Home", 2, 4), 0);
  assert.equal(nextTabIndex("End", 0, 4), 3);
  assert.equal(nextTabIndex("Enter", 0, 4), null);
  assert.equal(nextTabIndex("ArrowRight", 0, 0), null);
});

test("glass: text-primary keeps 4.5:1 at the city minimum over the brightest scene colors", () => {
  // Mirrors the CSS recipe: --bm-bg-1 surface at opacity, optional .bm-glass--text underlay (alpha 0.35).
  const UNDERLAY = 0.35;
  for (const backdrop of [BRIGHTEST_SCENE_HEX, "#e9e2d0" /* sand */, "#ffffff"]) {
    const surface = composite(GLASS_PANEL_HEX, backdrop, CITY_MIN_TEXT_GLASS_OPACITY);
    const withUnderlay = composite(GLASS_PANEL_HEX, surface, UNDERLAY);
    assert.ok(contrastRatio(TEXT_PRIMARY_HEX, withUnderlay) >= 4.5, `underlay model over ${backdrop}`);
    if (backdrop !== "#ffffff") {
      assert.ok(contrastRatio(TEXT_PRIMARY_HEX, surface) >= 4.5, `conservative model over ${backdrop}`);
    }
  }
  // The owner's original 0.35 minimum would have failed the conservative check.
  const old = composite(GLASS_PANEL_HEX, BRIGHTEST_SCENE_HEX, 0.35);
  assert.ok(contrastRatio(TEXT_PRIMARY_HEX, old) < 4.5);
});

test("glass: secondary text inside a panel well keeps 4.5:1 at the city minimum", () => {
  // Bare glass uses text-primary only; secondary copy sits on `.bmg-well` (navy at GLASS_WELL_ALPHA).
  for (const backdrop of [BRIGHTEST_SCENE_HEX, "#e9e2d0", "#ffffff"]) {
    const surface = composite(GLASS_PANEL_HEX, backdrop, CITY_MIN_TEXT_GLASS_OPACITY);
    const underlay = composite(GLASS_PANEL_HEX, surface, GLASS_UNDERLAY_ALPHA);
    const tinted = composite("#7aa7d6", underlay, GLASS_TINT_ALPHA);
    const well = composite(GLASS_PANEL_HEX, tinted, GLASS_WELL_ALPHA);
    assert.ok(contrastRatio(TEXT_SECONDARY_HEX, well) >= 4.5, `secondary in well over ${backdrop}`);
    assert.ok(contrastRatio(TEXT_PRIMARY_HEX, tinted) >= 4.5, `primary on tinted glass over ${backdrop}`);
  }
});
