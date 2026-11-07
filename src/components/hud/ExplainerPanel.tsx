"use client";
// HUD content for the landmark explainers (Explain tab and explainer card). Static copy only:
// no state reads, no private data. Escape closes; the list shows when nothing is selected.
import { useId, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { BookOpen, ChevronRight, Hourglass, Info, Lock, ShieldHalf, X, type LucideIcon } from "lucide-react";
import { EXPLAINERS, EXPLAINER_IDS, type ExplainerId } from "../city/explainers";

export interface ExplainerPanelProps {
  explainerId: ExplainerId | null;
  onClose(): void;
  onSelect(id: ExplainerId): void;
}

const ICONS: Record<ExplainerId, LucideIcon> = {
  "private-compute": Lock,
  "native-expiry": Hourglass,
  boundary: ShieldHalf,
  "how-it-works": BookOpen,
};

const root: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--bm-space-4)",
  padding: "var(--bm-space-4)",
  borderRadius: "var(--bm-radius-lg)",
  color: "var(--bm-text-primary)",
  fontFamily: "var(--bm-font-body)",
  fontSize: "var(--bm-text-sm)",
  lineHeight: "var(--bm-leading)",
};
const head: CSSProperties = { display: "flex", alignItems: "flex-start", gap: "var(--bm-space-3)" };
const tagStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--bm-space-1)",
  padding: "2px var(--bm-space-2)",
  border: "1px solid var(--bm-line-strong)",
  borderRadius: "var(--bm-radius-sm)",
  color: "var(--bm-text-secondary)",
  font: "700 var(--bm-text-xs)/1.3 var(--bm-font-body)",
  letterSpacing: "0.08em",
};
const titleStyle: CSSProperties = { margin: 0, fontFamily: "var(--bm-font-heading)", fontSize: "var(--bm-text-lg)", lineHeight: 1.25 };
const sectionHead: CSSProperties = { margin: 0, color: "var(--bm-accent)", font: "700 var(--bm-text-xs)/1.3 var(--bm-font-body)", letterSpacing: "0.08em", textTransform: "uppercase" };
const para: CSSProperties = { margin: "var(--bm-space-1) 0 0", color: "var(--bm-text-primary)" };
const listStyle: CSSProperties = { margin: "var(--bm-space-1) 0 0", paddingLeft: "var(--bm-space-5)", display: "grid", gap: "var(--bm-space-1)" };
const rowButton: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--bm-space-3)",
  width: "100%",
  minHeight: "var(--bm-touch, 44px)",
  padding: "var(--bm-space-2) var(--bm-space-3)",
  border: "1px solid var(--bm-line-strong)",
  borderRadius: "var(--bm-radius-md)",
  background: "transparent",
  color: "var(--bm-text-primary)",
  font: "600 var(--bm-text-sm)/1.3 var(--bm-font-body)",
  textAlign: "left",
  cursor: "pointer",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 style={sectionHead}>{title}</h3>
      {children}
    </section>
  );
}

export default function ExplainerPanel({ explainerId, onClose, onSelect }: ExplainerPanelProps) {
  const headingId = useId();
  const explainer = explainerId ? EXPLAINERS[explainerId] : null;
  const onKeyDown = (ev: KeyboardEvent<HTMLElement>) => {
    if (ev.key === "Escape" && explainer) {
      ev.stopPropagation();
      onClose();
    }
  };

  return (
    <section role="region" aria-labelledby={headingId} className="bm-glass bm-glass--text" style={root} onKeyDown={onKeyDown}>
      {explainer ? (
        <>
          <header style={head}>
            {(() => {
              const Icon = ICONS[explainer.id];
              return <Icon size={20} aria-hidden="true" style={{ flex: "none", marginTop: 2, color: "var(--bm-accent)" }} />;
            })()}
            <div style={{ flex: 1, minWidth: 0, display: "grid", gap: "var(--bm-space-1)" }}>
              <span style={tagStyle}>
                <Info size={14} aria-hidden="true" />
                {explainer.tag}
              </span>
              <h2 id={headingId} style={titleStyle}>
                {explainer.title}
              </h2>
            </div>
            <button type="button" className="bm-btn bm-btn--ghost" onClick={onClose} aria-label="Close explainer" style={{ flex: "none", minWidth: "var(--bm-touch, 44px)", minHeight: "var(--bm-touch, 44px)", padding: 0, justifyContent: "center" }}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <Section title="What it is">
            <p style={para}>{explainer.whatItIs}</p>
            {explainer.steps ? (
              <ol style={listStyle}>
                {explainer.steps.map((s) => (
                  <li key={s.building}>
                    <strong>{s.name}</strong>: {s.text}
                  </li>
                ))}
              </ol>
            ) : null}
          </Section>
          <Section title="Why we use it">
            <p style={para}>{explainer.whyWeUseIt}</p>
          </Section>
          <Section title="What it does NOT prove">
            <ul style={listStyle}>
              {explainer.doesNotProve.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Section>
          <Section title="Where you see it in the app">
            <p style={para}>{explainer.whereYouSeeIt}</p>
          </Section>
          {explainer.reminder ? (
            <p style={{ ...para, margin: 0, padding: "var(--bm-space-2) var(--bm-space-3)", border: "1px solid var(--bm-line-strong)", borderRadius: "var(--bm-radius-md)", color: "var(--bm-text-secondary)" }}>
              {explainer.reminder}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <header style={head}>
            <Info size={20} aria-hidden="true" style={{ flex: "none", marginTop: 2, color: "var(--bm-accent)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 id={headingId} style={titleStyle}>
                Explainers
              </h2>
              <p style={{ ...para, color: "var(--bm-text-secondary)" }}>Pick a landmark in the city or choose one here.</p>
            </div>
          </header>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "var(--bm-space-2)" }}>
            {EXPLAINER_IDS.map((id) => {
              const Icon = ICONS[id];
              return (
                <li key={id}>
                  <button type="button" className="bm-focusable" style={rowButton} onClick={() => onSelect(id)}>
                    <Icon size={18} aria-hidden="true" style={{ flex: "none", color: "var(--bm-accent)" }} />
                    <span style={{ flex: 1 }}>{EXPLAINERS[id].title}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
