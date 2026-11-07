"use client";
// FIX 4: detail panel for the selected opportunity. Desktop (>=1100px): sticky
// 480px column beside the grid. Below 1100px: a full-width sheet over the page
// with a close button, a focus trap and Escape. Content is split into separate
// Blocks (Summary, Key facts, Deliverables, Acceptance criteria, Exclusions,
// Open questions, Record notice, Technical details) that are omitted when empty.
import { useEffect, useMemo, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import Block from "@/components/dashboard/Block";
import type { OpportunityView } from "@/lib/shared/briefmint";
import { BudgetText, CopyButton, FreshnessChip, OpportunityStatusChip } from "./OpportunityCard";
import { StatusChip } from "./StatusChip";
import { checksumAddress, formatDeadline, formatRefresh, safeHttpsUrl } from "./opportunity-format";
import "./opportunities.css";

const SHEET_QUERY = "(max-width: 1099.98px)";

function FocusTrapSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!root.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", onKeyDown, true);
    return () => root.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return (
    <div className="opp-detail-scrim" onClick={onClose} aria-hidden="true">
      <div ref={ref} className="opp-detail-sheet">
        <button type="button" ref={closeRef} className="bm-btn bm-btn--ghost opp-detail-close" onClick={onClose}>
          <X size={18} aria-hidden="true" /> Close
        </button>
        {children}
      </div>
    </div>
  );
}

interface DetailProps {
  o: OpportunityView;
  freshness: "fresh" | "stale";
  lastRefreshedAt: number | null;
  onClose: () => void;
}

export default function OpportunityDetailPanel({ o, freshness, lastRefreshedAt, onClose }: DetailProps) {
  const owner = checksumAddress(o.ownerAddress);
  const contact = safeHttpsUrl(o.contactUrl);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(SHEET_QUERY);
    const update = () => setSheet(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!sheet) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheet]);

  const refresh = formatRefresh(lastRefreshedAt);

  const lists = useMemo(
    () => (
      [
        ["deliverables", "Deliverables"],
        ["acceptanceCriteria", "Acceptance criteria"],
        ["exclusions", "Exclusions"],
        ["openQuestions", "Open questions"],
      ] as const
    ).map(([key, label]) => ({ key, label, items: o[key] })),
    [o],
  );

  const body = (
    <>
      <Block title="Summary" ariaLabel="Selected opportunity summary">
        <div className="opp-card__chips">
          <StatusChip tone="info">{o.category === "design" ? "Design" : "Writing"}</StatusChip>
          <OpportunityStatusChip opportunity={o} />
          <FreshnessChip freshness={freshness} />
        </div>
        <h3 className="opp-detail-title">{o.title}</h3>
        <p className="opp-detail__summary">{o.summary}</p>
      </Block>

      <Block title="Key facts" ariaLabel="Key facts">
        <dl className="opp-card__facts">
          <div>
            <dt>Advertised budget (unfunded)</dt>
            <dd><BudgetText cents={o.budgetUsdCents} /></dd>
          </div>
          <div>
            <dt>Deadline</dt>
            <dd className="bm-num">{formatDeadline(o.deadline)}</dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd className="bm-num">r{o.revision}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>
              {contact
                ? <a className="opp-card__link" href={contact} target="_blank" rel="noopener noreferrer">{contact}<span className="bm-sr-only"> (opens in a new tab)</span></a>
                : (o.contactUrl ? "Not shown (not a valid HTTPS link)" : "None")}
            </dd>
          </div>
        </dl>
      </Block>

      {lists.filter((l) => l.items.length > 0).map(({ key, label, items }) => (
        <Block key={key} title={label} ariaLabel={label}>
          <ul className="opp-detail__list">
            {items.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
        </Block>
      ))}

      <Block
        tone="info"
        icon={Info}
        title="Record notice"
        ariaLabel="Record notice"
      >
        <p className="opp-detail__summary">
          Anyone may reuse the namespace tag; only the actual owner address can mutate this record. Content renders as untrusted text.
        </p>
      </Block>

      <Block
        collapsible
        title="Technical details"
        ariaLabel="Technical details"
      >
        <dl className="opp-card__facts opp-facts-mono">
          <div>
            <dt>Owner address</dt>
            <dd>
              <span className="bm-mono">{owner ?? "Address unavailable"}</span>
              {owner && <CopyButton value={owner} label="owner address" />}
            </dd>
          </div>
          <div>
            <dt>Entity key</dt>
            <dd>
              <span className="bm-mono">{o.entityKey}</span>
              <CopyButton value={o.entityKey} label="entity key" />
            </dd>
          </div>
          <div>
            <dt>Expires at block</dt>
            <dd className="bm-mono">{o.expiresAtBlock ?? "not reported"}</dd>
          </div>
          <div>
            <dt>Last refreshed</dt>
            <dd>{refresh}</dd>
          </div>
        </dl>
      </Block>
    </>
  );

  if (sheet) {
    return (
      <FocusTrapSheet onClose={onClose}>
        <div className="opp-detail__stack">{body}</div>
      </FocusTrapSheet>
    );
  }

  return (
    <aside className="opp-detail" aria-label="Selected opportunity details">
      <button type="button" className="bm-btn bm-btn--ghost opp-detail-close" onClick={onClose}>
        <X size={18} aria-hidden="true" /> Close
      </button>
      <div className="opp-detail__stack">{body}</div>
    </aside>
  );
}
