"use client";
// DraftForm: local draft → api.createJob(workshopEntityKey, text).
// Local validation mirrors shared/validation; server assigns segment IDs.
import { useState } from "react";
import { api, isApiError } from "@/lib/client/api-client";
import type { Hex, JobView } from "@/lib/shared/domain";
import { devFixturesEnabled } from "@/lib/shared/fixtures";
import { MAX_CHARS, MAX_SEGMENTS, MAX_WORDS, countWords, splitSegments, validateJobText } from "@/lib/shared/validation";

interface DraftFormProps {
  workshopEntityKey: Hex | null;
  onCreated: (job: JobView) => void;
}

const DEMO_TEXT = "Good morning. The workshop opens at sunrise.\n\nPlease translate this notice for our visitors.";

export default function DraftForm({ workshopEntityKey, onCreated }: DraftFormProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const words = countWords(text);
  const chars = text.trim().length;
  const segments = splitSegments(text);
  const validation = validateJobText(text);
  const tooManySegments = segments.length >= MAX_SEGMENTS && text.split(/\n\s*\n/).filter((s) => s.trim()).length > MAX_SEGMENTS;
  const clientError = !validation.ok
    ? validation.message
    : tooManySegments
      ? `Text has more than ${MAX_SEGMENTS} paragraphs (segments).`
      : null;

  const submit = async () => {
    setError(null);
    if (!workshopEntityKey) {
      setError("Select a supported workshop before creating a job.");
      return;
    }
    if (clientError) {
      setError(clientError);
      return;
    }
    setBusy(true);
    try {
      const job = await api.createJob(workshopEntityKey, text.trim());
      setText("");
      onCreated(job);
    } catch (e) {
      if (isApiError(e) && e.status === 401) setError("Sign in with your wallet first, then create the job.");
      else setError(isApiError(e) ? `${e.code}: ${e.message}` : "Could not create the job. Retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h3>New translation draft</h3>
      <p className="tc-muted">
        English → Hindi, recommended 100–250 words. Source and accepted terms become immutable once the job is
        created, to change the source, make a new unpaid job.
      </p>
      <div className="form-field">
        <label htmlFor="draft-text">Draft text (blank line = new segment)</label>
        <textarea
          id="draft-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
          aria-describedby="draft-counts"
        />
      </div>
      <div className="counts" id="draft-counts">
        <span>Words: {words}/{MAX_WORDS}</span>
        <span>Chars: {chars}/{MAX_CHARS}</span>
        <span>Segments: {segments.length}/{MAX_SEGMENTS}</span>
      </div>
      {clientError && text.trim() && <p className="error" role="alert">{clientError}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={busy || !workshopEntityKey || !!clientError} onClick={submit}>
          {busy ? "Creating…" : "Create job"}
        </button>
        {devFixturesEnabled() && (
          <button type="button" className="btn" disabled={busy} onClick={() => setText(DEMO_TEXT)}>
            Load demo text (fixture, not live)
          </button>
        )}
      </div>
      {!workshopEntityKey && <p className="tc-muted">No supported workshop selected.</p>}
    </div>
  );
}
