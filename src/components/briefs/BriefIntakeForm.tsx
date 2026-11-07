"use client";
// Home: private notes intake + explicit public parameters.
// Creates an owner-bound private brief via the canonical BriefMint API.
// Backend 503 renders `unavailable` honestly; fixtures are never live data.
// Canonical bounds: notes 250 words / 5000 chars / 20 paragraphs; title ≤120
// chars; summary ≤1000 chars; budget integer cents or null; https contact;
// deadline future within 7 days.
import { useSession } from "@/lib/client/use-session";
import { useState } from "react";
import { isApiError } from "@/lib/client/briefmint-api";
import { briefmintApi } from "@/lib/client/briefmint-api";
import { currentSessionGeneration, isCurrentSessionGeneration } from "@/lib/client/session-generation";
import {
  BRIEF_LIMITS,
  privateNotesSchema,
  publicParametersSchema,
  type BriefView,
} from "@/lib/shared/briefmint";
import {
  MAX_SUMMARY_CHARS,
  MAX_TITLE_CHARS,
  countWords,
  splitBriefSegments,
} from "@/lib/shared/briefmint-validation";

interface BriefIntakeFormProps {
  onCreated: (brief: BriefView) => void;
}

const DEMO_NOTES = "Community launch notes (fixture, not live).\n\nKeep private details out of the public draft.";

function firstIssue(message: string): string {
  return message;
}

export default function BriefIntakeForm({ onCreated }: BriefIntakeFormProps) {
  const { address } = useSession();
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<"writing" | "design">("writing");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [budgetOn, setBudgetOn] = useState(false);
  const [budgetCents, setBudgetCents] = useState("");
  const [contactUrl, setContactUrl] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const words = countWords(notes);
  const chars = notes.trim().length;
  const segments = splitBriefSegments(notes);

  const budgetValue = !budgetOn ? null : budgetCents.trim() === "" ? Number.NaN : Number(budgetCents);
  const paramsCheck = publicParametersSchema.safeParse({
    category,
    title: title.trim(),
    summary: summary.trim(),
    language: "en",
    budgetUsdCents: budgetValue,
    deadline: deadline.trim(),
    contactUrl: contactUrl.trim() ? contactUrl.trim() : null,
  });
  const notesCheck = privateNotesSchema.safeParse(notes);
  const tooManySegments =
    segments.length >= BRIEF_LIMITS.maxParagraphs &&
    notes.split(/\r?\n\s*\r?\n/u).filter((s) => s.trim()).length > BRIEF_LIMITS.maxParagraphs;
  const clientError = !notesCheck.success
    ? firstIssue(notesCheck.error.issues[0]?.message ?? "Private notes are invalid.")
    : tooManySegments
      ? `Notes have more than ${BRIEF_LIMITS.maxParagraphs} paragraphs.`
      : !paramsCheck.success
        ? firstIssue(paramsCheck.error.issues[0]?.message ?? "Public parameters are invalid.")
        : null;

  const submit = async () => {
    setError(null);
    setUnavailable(false);
    if (!address) { setError("Connect the owner wallet and sign in before saving private notes."); return; }
    if (clientError) {
      setError(clientError);
      return;
    }
    setBusy(true);
    const generation = currentSessionGeneration();
    try {
      const brief = await briefmintApi.createBrief({
        notes: notes.trim(),
        publicParameters: {
          category,
          title: title.trim(),
          summary: summary.trim(),
          language: "en",
          budgetUsdCents: budgetValue,
          deadline: deadline.trim(),
          contactUrl: contactUrl.trim() ? contactUrl.trim() : null,
        },
      }, address);
      if (!isCurrentSessionGeneration(generation)) return;
      setNotes("");
      onCreated(brief);
    } catch (e) {
      if (isApiError(e) && (e.status === 503 || e.code === "SERVICE_UNAVAILABLE")) {
        setUnavailable(true);
      } else if (isApiError(e) && e.status === 401) {
        setError("Connect your wallet and sign in first, then save the brief.");
      } else {
        setError(isApiError(e) ? `${e.code}: ${e.message}` : "Could not save the brief. Retry.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h3>Private notes intake</h3>
      <p className="tc-muted">
        Rough notes stay private to you and the backend. Only approved public fields may be published.
      </p>
      <details className="hud-learn">
        <summary>About credits and privacy</summary>
        <p className="tc-muted">
          Compilation is funded by promotional credits, no purchase, no bounty payout. Advertised budgets
          are unfunded: BriefMint never holds or moves funds. Source IDs and private details never leave
          the private brief; the public preview shows exactly what a publication would contain.
        </p>
      </details>
      <div className="form-field">
        <label htmlFor="brief-notes">Private notes (blank line = new segment)</label>
        <textarea id="brief-notes" aria-describedby="brief-notes-hint brief-notes-counts" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
        <p className="field-help" id="brief-notes-hint">Blank line starts a new segment. Keep private details out of the public fields below.</p>
      </div>
      <div className="counts" id="brief-notes-counts">
        <span>Words: {words}/{BRIEF_LIMITS.maxWords}</span>
        <span>Chars: {chars}/{BRIEF_LIMITS.maxChars}</span>
        <span>Segments: {segments.length}/{BRIEF_LIMITS.maxParagraphs}</span>
      </div>
      <div className="form-field">
        <label htmlFor="brief-category">Task category (public)</label>
        <select id="brief-category" value={category} onChange={(e) => setCategory(e.target.value as "writing" | "design")} disabled={busy}>
          <option value="writing">Writing</option>
          <option value="design">Design</option>
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="brief-title">Public title (≤ {MAX_TITLE_CHARS} chars)</label>
        <input id="brief-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
      </div>
      <div className="form-field">
        <label htmlFor="brief-summary">Public summary (≤ {MAX_SUMMARY_CHARS} chars, no private details)</label>
        <textarea id="brief-summary" value={summary} onChange={(e) => setSummary(e.target.value)} disabled={busy} />
      </div>
      <div className="form-field">
        <label>
          <input type="checkbox" checked={budgetOn} onChange={(e) => setBudgetOn(e.target.checked)} disabled={busy} />{" "}
          Advertise a budget (unfunded, USD cents)
        </label>
        {budgetOn && (
          <input type="text" inputMode="numeric" value={budgetCents} onChange={(e) => setBudgetCents(e.target.value)} disabled={busy} placeholder="e.g. 5000 (= $50.00)" aria-label="Advertised budget in USD cents" />
        )}
      </div>
      <div className="form-field">
        <label htmlFor="brief-contact">Public contact URL (optional https)</label>
        <input id="brief-contact" type="text" value={contactUrl} onChange={(e) => setContactUrl(e.target.value)} disabled={busy} placeholder="https://…" />
      </div>
      <div className="form-field">
        <label htmlFor="brief-deadline">Opportunity deadline (UTC, max 7 days)</label>
        <input id="brief-deadline" type="text" value={deadline} onChange={(e) => setDeadline(e.target.value)} disabled={busy} placeholder="2026-11-13T09:00:00.000Z" />
      </div>
      {clientError && notes.trim() && <p className="error" role="alert">{clientError}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {unavailable && (
        <p className="notice" role="status">
          BriefMint backend unavailable (503), the intake service is not deployed yet. Nothing was saved; no fixture was substituted.
        </p>
      )}
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={busy || !address || !!clientError} onClick={submit}>
          {busy ? "Saving…" : "Save private brief"}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => setNotes(DEMO_NOTES)} title="Fixture, never live evidence">
          Load demo notes (fixture)
        </button>
      </div>
    </div>
  );
}
