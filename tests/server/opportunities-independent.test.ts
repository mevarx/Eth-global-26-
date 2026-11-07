import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectPublicOpportunity, type OpportunityRecord } from "../../src/lib/shared/briefs";

const list = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/arkiv/briefmint/read", () => ({
  createArkivBriefmintReader: () => ({ list, get }),
}));

import { readOpportunitiesIndependent, readOpportunityIndependent } from "../../src/lib/arkiv/opportunities-independent";

// Synthetic public records and an isolated adapter double; no RPC or wallet.
const record: OpportunityRecord = {
  entityKey: `0x${"a".repeat(64)}`,
  ownerAddress: `0x${"1".repeat(40)}`,
  expiresAtBlock: "2000",
  observedAtBlock: "1000",
  observedAt: "2026-11-06T00:00:00.000Z",
  payload: projectPublicOpportunity({
    parameters: { title: "Synthetic brief", summary: "Public summary", category: "writing", language: "en", budgetUsdCents: null, deadline: "2026-11-07T00:00:00.000Z", contactUrl: null },
    sections: { deliverables: ["One explainer"], acceptanceCriteria: ["Readable text"], exclusions: ["No code"], openQuestions: ["Who reviews?"] },
    status: "open",
  }, 1),
};

describe("browser independent discovery — offline adapter double", () => {
  beforeEach(() => { list.mockReset(); get.mockReset(); });

  it("filters indexed category/status and advertised budget while distinguishing empty and failed queries", async () => {
    list.mockResolvedValueOnce({ records: [record, { ...record, entityKey: `0x${"b".repeat(64)}`, payload: { ...record.payload, budgetUsdCents: 500 } }], nextCursor: null });
    const rows = await readOpportunitiesIndependent({ accessKey: "" }, { category: "writing", status: "open", budget: "with" });
    expect(rows).toHaveLength(1); expect(rows[0].budgetUsdCents).toBe(500);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ language: "en", category: "writing", status: "open" }));
    list.mockResolvedValueOnce({ records: [], nextCursor: null });
    expect(await readOpportunitiesIndependent({ accessKey: "" }, { status: "closed" })).toEqual([]);
    list.mockRejectedValueOnce(new Error("Synthetic RPC unavailable"));
    await expect(readOpportunitiesIndependent({ accessKey: "" }, { status: "open" })).rejects.toThrow(/RPC unavailable/);
  });

  it("does not show a natively expired direct record as a live opportunity", async () => {
    const key = record.entityKey as `0x${string}`;
    get.mockResolvedValueOnce(record);
    expect(await readOpportunityIndependent({ accessKey: "" }, key)).toMatchObject({ entityKey: key, revision: 1 });
    get.mockResolvedValueOnce({ ...record, expiresAtBlock: record.observedAtBlock });
    expect(await readOpportunityIndependent({ accessKey: "" }, key)).toBeNull();
    get.mockRejectedValueOnce(new Error("Synthetic RPC unavailable"));
    await expect(readOpportunityIndependent({ accessKey: "" }, key)).rejects.toThrow(/RPC unavailable/);
  });

  it("continues empty pages, deduplicates overlap and preserves full public brief sections", async () => {
    list.mockResolvedValueOnce({ records: [], nextCursor: "50" })
      .mockResolvedValueOnce({ records: [record], nextCursor: "100" })
      .mockResolvedValueOnce({ records: [record], nextCursor: null });
    const rows = await readOpportunitiesIndependent({ accessKey: "" }, { status: "open" });
    expect(list).toHaveBeenCalledTimes(3);
    expect(list.mock.calls.map(([input]) => input.cursor)).toEqual([undefined, "50", "100"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      summary: record.payload.summary,
      deliverables: record.payload.deliverables,
      acceptanceCriteria: record.payload.acceptanceCriteria,
      exclusions: record.payload.exclusions,
      openQuestions: record.payload.openQuestions,
    });
  });

  it("rejects nonadvancing cursors instead of looping or presenting a partial catalogue", async () => {
    list.mockResolvedValueOnce({ records: [record], nextCursor: "50" })
      .mockResolvedValueOnce({ records: [], nextCursor: "50" });
    await expect(readOpportunitiesIndependent({ accessKey: "" }, { status: "open" })).rejects.toThrow(/pagination/);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("bounds a never-ending catalogue and reports failure instead of silent truncation", async () => {
    list.mockImplementation(async ({ cursor }: { cursor?: string }) => ({ records: [], nextCursor: String(Number(cursor ?? 0) + 50) }));
    await expect(readOpportunitiesIndependent({ accessKey: "" }, { status: "open" })).rejects.toThrow(/pagination/);
    expect(list).toHaveBeenCalledTimes(20);
  });
});
