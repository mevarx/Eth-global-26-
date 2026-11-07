"use client";
// FIX 4: PageShell — the one dashboard page rhythm: 1200px wide, 24px side
// padding, 16px vertical gaps between blocks, on every dashboard route.
// Also keeps --opp-nav-h (real top-bar height) accurate for sticky offsets.
//
// FIX 5 root cause: the dev CSS pipeline (Turbopack + lightningcss with stale
// browser targets) downgrades every plain `backdrop-filter` declaration that
// passes through it to the `-webkit-`-only form, which current Chromium no
// longer applies — so page text scrolled through the top bar and sticky filter
// bar unblurred. A raw <style> tag is delivered unprocessed, so the two sticky
// bars get their real blur here; everything else stays in system.css.
import { useEffect, useRef } from "react";
import "./system.css";

const FIX5_BLUR = `
.bm-dashboard .topbar.topbar, .bm-dashboard .topbar.topbar:focus-within {
  backdrop-filter: blur(18px) saturate(1.15);
}
.bm-block--sticky {
  backdrop-filter: blur(18px) saturate(1.15);
}
`;

export default function PageShell({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const bar = document.querySelector(".topbar");
    if (!bar) return;
    const apply = () =>
      host.style.setProperty("--opp-nav-h", `${Math.round(bar.getBoundingClientRect().height)}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="bm-page">
      <style id="bm-fix5-sticky-blur" dangerouslySetInnerHTML={{ __html: FIX5_BLUR }} />
      {children}
    </div>
  );
}
