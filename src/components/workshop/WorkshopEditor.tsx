"use client";
// WorkshopEditor: merchant-owned listing form (title/description/active only).
// Financial terms are never editable here; writes are signed by the merchant
// wallet through the parent page (dynamic @/lib/arkiv/write import).
import { useState } from "react";
import type { WorkshopView } from "@/lib/shared/domain";

export interface WorkshopInput {
  title: string;
  description: string;
}

interface WorkshopEditorProps {
  existing: WorkshopView | null;
  busy: boolean;
  error: string | null;
  onPublish: (input: WorkshopInput) => void;
  onUpdate: (input: WorkshopInput & { active: boolean }) => void;
  onWithdraw: () => void;
}

export default function WorkshopEditor({ existing, busy, error, onPublish, onUpdate, onWithdraw }: WorkshopEditorProps) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const valid = title.trim().length > 0 && description.trim().length > 0;

  const submit = (kind: "publish" | "update") => {
    if (!valid) {
      setLocalError("Title and description must both be non-empty.");
      return;
    }
    setLocalError(null);
    if (kind === "publish") onPublish({ title: title.trim(), description: description.trim() });
    else onUpdate({ title: title.trim(), description: description.trim(), active });
  };

  return (
    <div className="card">
      <h3>{existing ? "Update workshop listing" : "Publish workshop listing"}</h3>
      <p className="tc-muted">
        Only title, description and active status are editable. Checkout address, service, language pair and
        terms reference must match the configured service, there is no editable price.
      </p>
      <div className="form-field">
        <label htmlFor="ws-title">Title</label>
        <input id="ws-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
      </div>
      <div className="form-field">
        <label htmlFor="ws-desc">Description</label>
        <textarea id="ws-desc" value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
      </div>
      {existing && (
        <div className="form-field">
          <label>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={busy} />{" "}
            Active listing
          </label>
        </div>
      )}
      {(localError || error) && <p className="error" role="alert">{localError ?? error}</p>}
      <div className="btn-row">
        {!existing ? (
          <button type="button" className="btn btn-primary" disabled={busy || !valid} onClick={() => submit("publish")}>
            {busy ? "Publishing…" : "Publish with wallet"}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-primary" disabled={busy || !valid} onClick={() => submit("update")}>
              {busy ? "Saving…" : "Save update with wallet"}
            </button>
            {confirmWithdraw ? (
              <>
                <button type="button" className="btn btn-danger" disabled={busy} onClick={onWithdraw}>
                  {busy ? "Withdrawing…" : "Confirm withdrawal (active=false)"}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => setConfirmWithdraw(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-danger" disabled={busy} onClick={() => setConfirmWithdraw(true)}>
                Withdraw listing…
              </button>
            )}
          </>
        )}
      </div>
      {existing && (
        <p className="tc-muted">
          Withdrawal is an explicit owner-signed <span className="tc-mono">active=false</span> update. Existing paid
          jobs remain accessible after withdrawal.
        </p>
      )}
    </div>
  );
}
