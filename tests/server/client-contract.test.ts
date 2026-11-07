import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../src/lib/client/api-client";
import { briefmintApi } from "../../src/lib/client/briefmint-api";

const requests: Array<{ url: string; init?: RequestInit }> = [];

function mockFetch(data: unknown) {
  requests.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  requests.length = 0;
});

describe("BriefMint browser API contract", () => {
  it("requests a BriefMint-chain challenge while preserving the legacy default", async () => {
    mockFetch({ challengeId: "local-test", message: "synthetic", expiresAt: "2026-11-06T00:00:00.000Z" });
    await api.challenge("0x1234", "briefmint");
    expect(new URL(requests[0]!.url, "http://local.test").searchParams.get("purpose")).toBe("briefmint");

    await api.challenge("0x1234", "legacy");
    expect(new URL(requests[1]!.url, "http://local.test").searchParams.has("purpose")).toBe(false);
  });

  it("blocks private requests without a wallet-bound owner before sending notes", async () => {
    mockFetch({});
    await expect(briefmintApi.createBrief({ notes: "private", publicParameters: {} } as never, null)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(requests).toHaveLength(0);
  });

  it("places export format and audience in the GET query string", async () => {
    mockFetch({ filename: "brief-public-r1.json", mediaType: "application/json", content: "{}" });
    const id = `0x${"a".repeat(64)}`;
    await briefmintApi.exportBrief(id, { format: "json", audience: "public" }, `0x${"1".repeat(40)}`);
    expect(requests[0]!.url).toBe(`/api/briefs/${id}/export?format=json&audience=public`);
    expect(requests[0]!.init?.method).toBe("GET");
    expect(requests[0]!.init?.body).toBeUndefined();
    expect(new Headers(requests[0]!.init?.headers).get("x-briefmint-owner")).toBe(`0x${"1".repeat(40)}`);
  });
});
