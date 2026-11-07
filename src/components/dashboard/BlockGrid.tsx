// FIX 4: BlockGrid — equal-width and equal-height cards per row via CSS grid.
import type { ReactNode } from "react";

export interface BlockGridProps {
  /** Render as a semantic list (ul) or a plain grid (div). */
  as?: "div" | "ul";
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
}

export default function BlockGrid({ as = "div", className = "", ariaLabel, children }: BlockGridProps) {
  const El = as;
  const extra = as === "ul" ? { "aria-label": ariaLabel ?? "Results" } : ariaLabel ? { "aria-label": ariaLabel } : {};
  return <El className={`bm-blockgrid${className ? ` ${className}` : ""}`} {...extra}>{children}</El>;
}
