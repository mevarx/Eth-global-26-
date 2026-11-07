"use client";
// Structured review: the immutable model result stays intact; edits save as a
// new editable draft revision (complete candidate replacement with optimistic
// concurrency). Exports use the latest SAVED draft, falling back to a
// candidate projected from the saved model output. No fake completions.
import { useMemo, useState } from "react";
import { isApiError } from "@/lib/client/briefmint-api";
import { briefmintApi } from "@/lib/client/briefmint-api";
import { useSession } from "@/lib/client/use-session";
import { useSaveDraft } from "@/lib/client/use-briefs";
import { currentSessionGeneration, isCurrentSessionGeneration } from "@/lib/client/session-generation";
import type { BriefCandidate, BriefView } from "@/lib/shared/briefmint";

interface BriefReviewProps {
  brief: BriefView;
  onSaved: (brief: BriefView) => void;
}

type SectionKey = "deliverables" | "acceptanceCriteria" | "exclusions" | "openQuestions";
const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: "deliverables", label: "Deliverables" },
  { key: "acceptanceCriteria", label: "Acceptance criteria" },
  { key: "exclusions", label: "Exclusions / out of scope" },
  { key: "openQuestions", label: "Open questions" },
];

/** Candidate projected from the immutable model result (plain strings). */
function candidateFromModel(brief: BriefView): BriefCandidate | null {
  const m = brief.immutableModelResult;
  if (!m) return null;
  const strings = (key: SectionKey) => m[key].map((i) => i.text);
  return {
    parameters: { ...brief.publicParameters },
    sections: {
      deliverables: strings("deliverables"),
      acceptanceCriteria: strings("acceptanceCriteria"),
      exclusions: strings("exclusions"),
      openQuestions: strings("openQuestions"),
    },
    status: "open",
  };
}

function savedCandidate(brief: BriefView): BriefCandidate | null {
  return brief.editedDraft ?? candidateFromModel(brief);
}

export function briefResultText(brief: BriefView): string {
  const d = savedCandidate(brief);
  if (!d) return "";
  const parts: string[] = [];
  for (const s of SECTIONS) {
    const items = d.sections[s.key];
    if (items.length > 0) parts.push(`${s.label}:\n${items.map((t) => `- ${t}`).join("\n")}`);
  }
  return parts.join("\n\n");
}

export default function BriefReview({ brief, onSaved }: BriefReviewProps) {
  const { address } = useSession();
  const base = useMemo(() => savedCandidate(brief), [brief]);
  const [texts, setTexts] = useState<Record<SectionKey, string[]>>(() => ({
    deliverables: base?.sections.deliverables ?? [],
    acceptanceCriteria: base?.sections.acceptanceCriteria ?? [],
    exclusions: base?.sections.exclusions ?? [],
    openQuestions: base?.sections.openQuestions ?? [],
  }));
  const [title, setTitle] = useState(base?.parameters.title ?? "");
  const [summary, setSummary] = useState(base?.parameters.summary ?? "");
  const [status, setStatus] = useState<"open" | "closed">(base?.status ?? "open");
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [audience, setAudience] = useState<"private" | "public">("private");
  const saveDraft = useSaveDraft();

  const baseKey = base ? JSON.stringify(base) : "";
  const [seenKey, setSeenKey] = useState(baseKey);
  if (seenKey !== baseKey) {
    setSeenKey(baseKey);
    setTexts({
      deliverables: base?.sections.deliverables ?? [],
      acceptanceCriteria: base?.sections.acceptanceCriteria ?? [],
      exclusions: base?.sections.exclusions ?? [],
      openQuestions: base?.sections.openQuestions ?? [],
    });
    setTitle(base?.parameters.title ?? "");
    setSummary(base?.parameters.summary ?? "");
    setStatus(base?.status ?? "open");
  }

  const editable = brief.executionStatus === "ready";
  const pending = saveDraft.isPending;

  const save = async () => {
    setError(null);
    if (!base) {
      setError("Nothing compiled to edit yet.");
      return;
    }
    const draft: BriefCandidate = {
      parameters: {
        ...base.parameters,
        title: title.trim(),
        summary: summary.trim(),
      },
      sections: {
        deliverables: texts.deliverables.map((t) => t.trim()).filter(Boolean),
        acceptanceCriteria: texts.acceptanceCriteria.map((t) => t.trim()).filter(Boolean),
        exclusions: texts.exclusions.map((t) => t.trim()).filter(Boolean),
        openQuestions: texts.openQuestions.map((t) => t.trim()).filter(Boolean),
      },
      status,
    };
    if (draft.sections.deliverables.length === 0) {
      setError("Deliverables must not be empty.");
      return;
    }
    const generation = currentSessionGeneration();
    try {
      const updated = await saveDraft.mutateAsync({ id: brief.id, req: { expectedRevision: brief.draftRevision, draft } });
      if (!isCurrentSessionGeneration(generation)) return;
      onSaved(updated);
    } catch (e) {
      if (isApiError(e) && e.status === 409) setError("CONFLICT: the brief changed, reload the saved revision before editing.");
      else setError(isApiError(e) ? `${e.code}: ${e.message}${e.retryable ? " (retryable)" : ""}` : "Could not save the draft.");
    }
  };

  const runExport = async (format: "txt" | "json") => {
    setError(null);
    setExporting(true);
    try {
      const res = await briefmintApi.exportBrief(brief.id, { format, audience }, address);
      const blob = new Blob([res.content], { type: res.mediaType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(isApiError(e) ? `${e.code}: ${e.message}` : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const model = brief.immutableModelResult;
  if (!model) return <p className="tc-muted">No compiled result yet. Start compilation at the AI Studio.</p>;

  return (
    <div>
      <h3>
        Review compiled brief{" "}
        {brief.editedDraft ? (
          <span className="badge badge-info">edited draft r{brief.draftRevision}</span>
        ) : (
          <span className="badge">model output r{brief.draftRevision}</span>
        )}
      </h3>
      <p className="tc-muted">Model output is immutable; your edits save as a new draft revision. Approval binds the exact saved revision.</p>
      <h4>Model suggestions (with source references)</h4>
      {SECTIONS.map((s) => (
        <div className="review-seg" key={`model-${s.key}`}>
          <strong>{s.label}</strong>
          {model[s.key].length === 0 ? (
            <p className="tc-muted">None.</p>
          ) : (
            <ul>
              {model[s.key].map((item, n) => (
                <li key={n}>
                  {item.text}{" "}
                  <span className="tc-mono tc-muted">
                    [{item.basis}
                    {item.sourceIds.length > 0 ? `: ${item.sourceIds.join(", ")}` : ""}]
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <h4>Editable draft (revision {brief.draftRevision} → {brief.draftRevision + 1} on save)</h4>
      <div className="form-field">
        <label htmlFor="draft-title">Public title</label>
        <input id="draft-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!address || pending || !editable} />
      </div>
      <div className="form-field">
        <label htmlFor="draft-summary">Public summary</label>
        <textarea id="draft-summary" value={summary} onChange={(e) => setSummary(e.target.value)} disabled={!address || pending || !editable} />
      </div>
      <div className="form-field">
        <label htmlFor="draft-status">Candidate status</label>
        <select id="draft-status" value={status} onChange={(e) => setStatus(e.target.value as "open" | "closed")} disabled={!address || pending || !editable}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      {SECTIONS.map((s) => (
        <div className="review-seg" key={s.key}>
          <strong>{s.label}</strong>
          {(texts[s.key] ?? []).map((text, n) => (
            <textarea
              key={n}
              value={text}
              onChange={(e) =>
                setTexts((d) => ({ ...d, [s.key]: d[s.key].map((t, i) => (i === n ? e.target.value : t)) }))
              }
              disabled={!address || pending || !editable}
              aria-label={`${s.label} item ${n + 1}`}
            />
          ))}
        </div>
      ))}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={!address || pending || !editable} onClick={save}>
          {pending ? "Saving…" : `Save draft (r${brief.draftRevision} → r${brief.draftRevision + 1})`}
        </button>
      </div>
      <h4>Export saved brief</h4>
      <div className="btn-row">
        <label>
          Audience{" "}
          <select value={audience} onChange={(e) => setAudience(e.target.value as "private" | "public")} disabled={!address || exporting}>
            <option value="private">Private</option>
            <option value="public">Public (approved projection only)</option>
          </select>
        </label>
        <button type="button" className="btn" disabled={!address || exporting} onClick={() => runExport("txt")}>
          {exporting ? "Exporting…" : "Export TXT"}
        </button>
        <button type="button" className="btn" disabled={!address || exporting} onClick={() => runExport("json")}>
          {exporting ? "Exporting…" : "Export JSON"}
        </button>
      </div>
      {!editable && <p className="tc-muted">Editing is available once compilation is ready. Exports use the saved version.</p>}
    </div>
  );
}
