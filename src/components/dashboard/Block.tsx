// FIX 4: Block — one glass card per block: 20px padding, 16px radius, a single
// title row in sentence case (Space Grotesk 600), an optional action area, and
// optional sticky/collapsible variants. State panels reuse the same component.
import type { ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import "./system.css";

export type BlockTone = "info" | "warn" | "danger";

export interface BlockProps {
  /** Sentence-case title; omit for chrome-less blocks (filter bar, grids). */
  title?: ReactNode;
  /** Optional right-aligned action area on the title row. */
  action?: ReactNode;
  /** Optional icon before the title (state panels, notices). */
  icon?: LucideIcon;
  tone?: BlockTone;
  /** Sticks under the nav with a solid navy underlay. */
  sticky?: boolean;
  /** Collapsible <details> block, closed by default. */
  collapsible?: boolean;
  headBaseline?: boolean;
  className?: string;
  id?: string;
  ariaLabel?: string;
  role?: "alert" | "status" | "region";
  children?: ReactNode;
}

export default function Block({
  title,
  action,
  icon: Icon,
  tone,
  sticky = false,
  collapsible = false,
  headBaseline = false,
  className = "",
  id,
  ariaLabel,
  role,
  children,
}: BlockProps) {
  const iconColour =
    tone === "danger"
      ? "var(--bm-danger)"
      : tone === "warn"
        ? "var(--bm-warning)"
        : tone === "info"
          ? "var(--bm-info)"
          : undefined;
  const head = (
    <>
      {Icon ? (
        <Icon size={18} aria-hidden="true" className="bm-block__icon" style={iconColour ? { color: iconColour } : undefined} />
      ) : null}
      {title ? <h2 className="bm-block__title">{title}</h2> : null}
      {action ? <span className="bm-block__action">{action}</span> : null}
      {collapsible ? <ChevronDown size={16} aria-hidden="true" className="bm-block__chevron" /> : null}
    </>
  );

  if (collapsible) {
    return (
      <details
        id={id}
        aria-label={ariaLabel}
        className={`bm-block bm-glass bm-glass--text${tone ? ` bm-block--tone-${tone}` : ""}${className ? ` ${className}` : ""}`}
      >
        <summary className={`bm-block__summary${headBaseline ? " bm-block__head--baseline" : ""}`}>{head}</summary>
        <div className="bm-block__body">{children}</div>
      </details>
    );
  }

  return (
    <section
      id={id}
      role={role}
      aria-label={ariaLabel}
      className={`bm-block bm-glass bm-glass--text${sticky ? " bm-block--sticky" : ""}${tone ? ` bm-block--tone-${tone}` : ""}${className ? ` ${className}` : ""}`}
    >
      {title || Icon ? <div className={`bm-block__head${headBaseline ? " bm-block__head--baseline" : ""}`}>{head}</div> : null}
      <div className="bm-block__body">{children}</div>
    </section>
  );
}
