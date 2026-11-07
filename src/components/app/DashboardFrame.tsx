"use client";
// Shared chrome for full-page dashboard routes (Opportunities, My Briefs): the cloud
// shader backdrop plus the fixed frosted glass tokens (nothing adjustable anymore).
// The city route never imports this.
import type { ReactNode } from "react";
import DashboardBackdrop from "@/components/background/DashboardBackdrop";
import "@/styles/dashboard.css";

export default function DashboardFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bm-dashboard" data-glass-scope="dashboard">
      <DashboardBackdrop />
      {children}
    </div>
  );
}
