"use client";
// Shared chrome for full-page dashboard routes (Opportunities, My Briefs): the cloud
// shader backdrop plus the viewer's glass settings. The city route never imports this.
import type { ReactNode } from "react";
import DashboardBackdrop from "@/components/background/DashboardBackdrop";
import { GlassProvider } from "@/components/hud/glass-context";
import "@/styles/dashboard.css";

export default function DashboardFrame({ children }: { children: ReactNode }) {
  return (
    <GlassProvider scope="dashboard" className="bm-dashboard">
      <DashboardBackdrop />
      {children}
    </GlassProvider>
  );
}
