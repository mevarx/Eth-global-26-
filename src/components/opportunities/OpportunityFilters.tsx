"use client";
// Sticky filter bar: Category / Status / Budget segments, title/summary search, Reset and Refresh.
// Same semantics as before: category and status are re-queried, budget and search filter client-side.
import { useId } from "react";
import { RefreshCw, RotateCcw, Search } from "lucide-react";
import type { OpportunityFilters as Filters } from "../../lib/shared/briefmint";
import { DEFAULT_FILTERS, isDefaultFilters } from "./opportunity-format";
import "./opportunities.css";

interface Segment<T extends string> {
  value: T;
  label: string;
}

const CATEGORY: Segment<NonNullable<Filters["category"]>>[] = [
  { value: "all", label: "All" },
  { value: "writing", label: "Writing" },
  { value: "design", label: "Design" },
];
const STATUS: Segment<NonNullable<Filters["status"]>>[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];
const BUDGET: Segment<NonNullable<Filters["budget"]>>[] = [
  { value: "all", label: "All" },
  { value: "with", label: "Advertised" },
  { value: "without", label: "Not advertised" },
];

function SegmentGroup<T extends string>(props: {
  legend: string;
  name: string;
  options: Segment<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="opp-segment">
      <legend className="opp-segment__legend">{props.legend}</legend>
      <div className="opp-segment__options">
        {props.options.map((opt) => (
          <label key={opt.value} className="opp-segment__option">
            <input
              type="radio"
              name={props.name}
              value={opt.value}
              checked={props.value === opt.value}
              onChange={() => props.onChange(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export interface OpportunityFiltersProps {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  query: string;
  onQueryChange: (q: string) => void;
  onRefresh: () => void;
  loading: boolean;
  shownCount: number;
  totalCount: number;
}

export default function OpportunityFilters(p: OpportunityFiltersProps) {
  const uid = useId();
  const f = p.filters;
  const set = (patch: Partial<Filters>) => p.onFiltersChange({ ...f, ...patch });
  const pristine = isDefaultFilters(f, p.query);

  return (
    <section className="opp-filters bm-glass bm-glass--text" aria-label="Filter opportunities">
      <div className="opp-filters__groups">
        <SegmentGroup legend="Category" name={`${uid}-category`} options={CATEGORY} value={f.category ?? "all"} onChange={(category) => set({ category })} />
        <SegmentGroup legend="Status" name={`${uid}-status`} options={STATUS} value={f.status ?? "open"} onChange={(status) => set({ status })} />
        <SegmentGroup legend="Budget" name={`${uid}-budget`} options={BUDGET} value={f.budget ?? "all"} onChange={(budget) => set({ budget })} />
      </div>
      <div className="opp-filters__row">
        <div className="opp-search">
          <label htmlFor={`${uid}-q`} className="bm-sr-only">Search title and summary</label>
          <Search size={16} aria-hidden="true" className="opp-search__icon" />
          <input
            id={`${uid}-q`}
            type="search"
            className="bm-input opp-search__input"
            value={p.query}
            onChange={(e) => p.onQueryChange(e.target.value)}
            placeholder="Search title and summary"
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          className="bm-btn bm-btn--ghost"
          disabled={pristine}
          onClick={() => {
            p.onQueryChange("");
            if (!isDefaultFilters(f, "")) p.onFiltersChange({ ...DEFAULT_FILTERS });
          }}
        >
          <RotateCcw size={15} aria-hidden="true" /> Reset
        </button>
        <button type="button" className="bm-btn" onClick={p.onRefresh} disabled={p.loading}>
          <RefreshCw size={15} aria-hidden="true" className={p.loading ? "opp-spin" : undefined} />
          {p.loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <p className="opp-filters__count bm-muted" role="status" aria-live="polite">
        {p.loading ? "Querying Arkiv indexed records…" : `Showing ${p.shownCount} of ${p.totalCount} opportunities`}
      </p>
    </section>
  );
}
