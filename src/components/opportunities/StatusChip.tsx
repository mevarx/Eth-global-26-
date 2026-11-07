import type { ReactNode } from "react";

export type StatusTone = "ok" | "warn" | "danger" | "info" | "muted";

export interface StatusChipProps {
  tone: StatusTone;
  icon?: ReactNode;
  children: ReactNode;
}

// Text is always rendered; the icon and tone only reinforce it.
export function StatusChip({ tone, icon, children }: StatusChipProps) {
  return (
    <span className={`bm-chip bm-chip--${tone}`}>
      {icon}
      <span>{children}</span>
    </span>
  );
}

export default StatusChip;
