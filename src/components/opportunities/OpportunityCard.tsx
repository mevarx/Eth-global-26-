"use client";
// Props-only opportunity card (also reused by the city HUD).
// All record text renders as plain text; contact links need a valid HTTPS URL.
// FIX 4: dashboard cards are summary cards only — chips, 2-line title, 2-line
// summary, budget, deadline, owner + entity key, "View details". A selected
// card gets the amber outline only; expansion happens in the detail panel.
// The compact variant (city HUD) keeps its previous structure.
import { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, CircleDashed, Clock, Copy, Check, Lock, LockOpen } from "lucide-react";
import type { OpportunityView } from "../../lib/shared/briefmint";
import { StatusChip, type StatusTone } from "./StatusChip";
import {
  deriveStatus,
  formatBudget,
  formatDeadline,
  formatRefresh,
  shortAddress,
  shortKey,
  checksumAddress,
  type Freshness,
} from "./opportunity-format";
import "./opportunities.css";

export interface OpportunityCardProps {
  opportunity: OpportunityView;
  freshness: Freshness;
  lastRefreshedAt?: number | null;
  selected?: boolean;
  onSelect?: (o: OpportunityView) => void;
  compact?: boolean;
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [result, setResult] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setResult("copied");
    } catch {
      setResult("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setResult("idle"), 2400);
  };

  return (
    <span className="opp-copy">
      <button type="button" className="bm-btn bm-btn--ghost opp-copy__btn" onClick={copy} aria-label={`Copy ${label}`}>
        {result === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </button>
      <span className="opp-copy__note" role="status" aria-live="polite">
        {result === "copied" ? "Copied" : result === "failed" ? "Copy failed" : ""}
      </span>
    </span>
  );
}

const FRESHNESS: Record<Freshness, { tone: StatusTone; label: string }> = {
  fresh: { tone: "ok", label: "Fresh" },
  stale: { tone: "warn", label: "Stale" },
  unavailable: { tone: "danger", label: "Unavailable" },
};

export function FreshnessChip({ freshness }: { freshness: Freshness }) {
  const { tone, label } = FRESHNESS[freshness];
  const Icon = freshness === "fresh" ? CircleCheck : freshness === "stale" ? Clock : CircleAlert;
  return <StatusChip tone={tone} icon={<Icon size={14} aria-hidden="true" />}>{label}</StatusChip>;
}

export function OpportunityStatusChip({ opportunity, confirmedExpired = false }: { opportunity: OpportunityView; confirmedExpired?: boolean }) {
  const status = deriveStatus(opportunity, confirmedExpired);
  if (status === "open") return <StatusChip tone="ok" icon={<LockOpen size={14} aria-hidden="true" />}>Open</StatusChip>;
  if (status === "closed") return <StatusChip tone="muted" icon={<Lock size={14} aria-hidden="true" />}>Closed</StatusChip>;
  return <StatusChip tone="warn" icon={<CircleDashed size={14} aria-hidden="true" />}>Expired</StatusChip>;
}

export function BudgetText({ cents }: { cents: number | null }) {
  const budget = formatBudget(cents);
  return <span className="bm-num">{budget ?? "None advertised"}</span>;
}

export default function OpportunityCard({
  opportunity: o,
  freshness,
  lastRefreshedAt = null,
  selected = false,
  onSelect,
  compact = false,
}: OpportunityCardProps) {
  const owner = shortAddress(o.ownerAddress);
  const ownerFull = checksumAddress(o.ownerAddress);

  const chips = (
    <div className="opp-card__chips">
      <StatusChip tone="info">{o.category === "design" ? "Design" : "Writing"}</StatusChip>
      <OpportunityStatusChip opportunity={o} />
      <FreshnessChip freshness={freshness} />
    </div>
  );

  if (compact) {
    return (
      <article className={`opp-card opp-card--compact bm-glass bm-glass--text${selected ? " opp-card--selected" : ""}`}>
        {chips}

        <h3 className="opp-card__title">
          {onSelect ? (
            <button type="button" className="opp-card__select" aria-pressed={selected} onClick={() => onSelect(o)}>
              {o.title}
            </button>
          ) : (
            o.title
          )}
        </h3>

        {/* Compact variant previously showed no summary text. */}
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
            <dt>Entity key</dt>
            <dd>
              <span className="bm-mono" title={o.entityKey}>{shortKey(o.entityKey)}</span>
              <CopyButton value={o.entityKey} label="entity key" />
            </dd>
          </div>
        </dl>

        <p className="opp-card__refreshed bm-muted">
          {freshness === "unavailable" ? "Arkiv unavailable. " : ""}
          {formatRefresh(lastRefreshedAt)}
        </p>
      </article>
    );
  }

  return (
    <article className={`opp-card bm-glass bm-glass--text${selected ? " opp-card--selected" : ""}`} aria-label={o.title}>
      {chips}

      <h3 className="opp-card__title opp-card__title--clamp">{o.title}</h3>

      <p className="opp-card__summary opp-card__summary--clamp">{o.summary}</p>

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
          <dt>Owner</dt>
          <dd>
            {owner && ownerFull ? (
              <>
                <span className="bm-mono" title={ownerFull}>{owner}</span>
                <CopyButton value={ownerFull} label="owner address" />
              </>
            ) : (
              <span className="bm-secondary">Address unavailable</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Entity key</dt>
          <dd>
            <span className="bm-mono" title={o.entityKey}>{shortKey(o.entityKey)}</span>
            <CopyButton value={o.entityKey} label="entity key" />
          </dd>
        </div>
      </dl>

      <div className="opp-card__footer">
        <p className="opp-card__refreshed bm-muted">
          {freshness === "unavailable" ? "Arkiv unavailable. " : ""}
          {formatRefresh(lastRefreshedAt)}
        </p>
        <button
          type="button"
          className="bm-btn opp-card__details-btn"
          aria-pressed={selected}
          onClick={() => onSelect?.(o)}
        >
          {selected ? "Hide details" : "View details"}
        </button>
      </div>
    </article>
  );
}
