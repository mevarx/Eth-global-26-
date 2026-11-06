"use client";
// Independent opportunity reader, works while the BriefMint API is stopped.
// Takes an explicit Arkiv access key (operator-provided public rate-limit key,
// never committed) and no backend session. Failed reads are distinct from an
// empty catalogue.
import { useState } from "react";
import { readOpportunitiesIndependent, readOpportunityIndependent, RABDI_PUBLIC_RPC } from "@/lib/arkiv/opportunities-independent";
import type { Hex, OpportunityView } from "@/lib/shared/briefmint";
import { ChevronDown, CircleAlert, Terminal } from "lucide-react";
import { OpportunityStatusChip } from "@/components/opportunities/OpportunityCard";
import { StatusChip } from "@/components/opportunities/StatusChip";
import "@/components/opportunities/opportunities.css";

export default function OpportunityReader() {
  const [accessKey, setAccessKey] = useState("");
  const [category, setCategory] = useState<"writing" | "design" | "all">("all");
  const [status, setStatus] = useState<"open" | "closed" | "all">("open");
  const [rows, setRows] = useState<OpportunityView[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entityKey, setEntityKey] = useState("");
  const [single, setSingle] = useState<OpportunityView | null>(null);

  const read = async () => {
    setBusy(true);
    setError(null);
    try {
      const list = await readOpportunitiesIndependent(
        { accessKey },
        {
          ...(category === "all" ? {} : { category }),
          status: status === "all" ? "all" : status,
        },
      );
      setRows(list);
    } catch {
      setRows(null);
      setError("Independent Arkiv query failed, the reader, key, or RPC is unavailable. This does not prove records were deleted.");
    } finally {
      setBusy(false);
    }
  };

  const readOne = async () => {
    setError(null);
    setSingle(null);
    const key = entityKey.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
      setError("Enter a 32-byte entity key.");
      return;
    }
    setBusy(true);
    try {
      const row = await readOpportunityIndependent({ accessKey }, key as Hex);
      setSingle(row);
      if (!row) setError("No live opportunity record at that key (missing, expired, or different schema).");
    } catch {
      setError("Independent single-record read failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="opp-reader bm-glass bm-glass--text">
      <summary className="opp-reader__summary">
        <Terminal size={16} aria-hidden="true" />
        <span>Developer: independent reader (no backend needed)</span>
        <ChevronDown size={16} aria-hidden="true" className="opp-reader__chevron" />
      </summary>
      <div className="opp-reader__body">
        <p className="bm-secondary bm-measure">
          Why it exists: it proves public data can be read straight from Arkiv, without the BriefMint API or a wallet session.
          No private data is involved.
        </p>
        <p className="bm-muted">RPC: <span className="bm-mono">{RABDI_PUBLIC_RPC}</span></p>
        <div className="opp-field">
          <label htmlFor="reader-key">Arkiv access key (public rate-limit key; never committed)</label>
          <input id="reader-key" type="password" className="bm-input" value={accessKey} onChange={(e) => setAccessKey(e.target.value)} disabled={busy} autoComplete="off" placeholder="Paste operator-provided key" />
          <p className="bm-muted">Held in this page&apos;s memory only: never logged, stored or committed.</p>
        </div>
        <div className="opp-reader__row">
          <div className="opp-field">
            <label htmlFor="reader-category">Category</label>
            <select id="reader-category" className="bm-input" value={category} onChange={(e) => setCategory(e.target.value as "writing" | "design" | "all")} disabled={busy}><option value="all">All</option><option value="writing">Writing</option><option value="design">Design</option></select>
          </div>
          <div className="opp-field">
            <label htmlFor="reader-status">Status</label>
            <select id="reader-status" className="bm-input" value={status} onChange={(e) => setStatus(e.target.value as "open" | "closed" | "all")} disabled={busy}><option value="open">Open</option><option value="closed">Closed</option><option value="all">All</option></select>
          </div>
          <button type="button" className="bm-btn bm-btn--primary" onClick={read} disabled={busy}>{busy ? "Reading…" : "Read opportunities"}</button>
        </div>
        {error && <p className="opp-note opp-note--danger" role="alert"><CircleAlert size={16} aria-hidden="true" />{error}</p>}
        {rows && <p className="bm-secondary" role="status">{rows.length === 0 ? "No public records returned (empty catalogue)." : `${rows.length} public record(s) returned.`}</p>}
        {rows && rows.length > 0 && (
          <ul className="opp-reader__list">
            {rows.map((o) => (
              <li key={o.entityKey}>
                <div className="opp-card__chips">
                  <StatusChip tone="info">{o.category === "design" ? "Design" : "Writing"}</StatusChip>
                  <OpportunityStatusChip opportunity={o} />
                </div>
                <strong>{o.title}</strong>
                <span className="bm-mono bm-muted">{o.entityKey} · r{o.revision}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="opp-field">
          <label htmlFor="reader-entity">Single entity key</label>
          <input id="reader-entity" type="text" className="bm-input bm-mono" value={entityKey} onChange={(e) => setEntityKey(e.target.value)} disabled={busy} placeholder="0x…" />
        </div>
        <div>
          <button type="button" className="bm-btn" onClick={readOne} disabled={busy}>Read single record</button>
        </div>
        {single && <p className="opp-note opp-note--info" role="status">Found: {single.title} ({single.status}, r{single.revision}), owner <span className="bm-mono">{single.ownerAddress}</span>.</p>}
      </div>
    </details>
  );
}
