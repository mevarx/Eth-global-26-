import type { ReactNode } from "react";
import DashboardFrame from "@/components/app/DashboardFrame";

export default function DashboardRouteLayout({ children }: { children: ReactNode }) {
  return <DashboardFrame>{children}</DashboardFrame>;
}
