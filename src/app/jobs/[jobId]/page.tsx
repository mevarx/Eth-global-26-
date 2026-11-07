"use client";
// Job detail: authorized status, ToolCityPay checkout, deliberate Start/Retry
// (POST run, user action only, never on mount), source-aligned review with
// export, and honest evidence. useJob polls ~2s while active; reopening a
// ready job simply loads the saved result.
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import AppShell from "@/components/app/AppShell";
import ToolCityPay from "@/components/checkout/ToolCityPay";
import JobEvidence from "@/components/jobs/JobEvidence";
import { StatusBadge } from "@/components/jobs/JobList";
import TranslationReview from "@/components/jobs/TranslationReview";
import { api, isApiError, queryKeys } from "@/lib/client/api-client";
import { useJob } from "@/lib/client/use-job";
import type { Hex, JobView } from "@/lib/shared/domain";
import { isBytes32 } from "@/lib/shared/validation";

export default function JobDetailPage() {
  const params = useParams();
  const raw = params.jobId;
  const jobId = Array.isArray(raw) ? raw[0] : raw;
  const valid = typeof jobId === "string" && isBytes32(jobId);
  const jobQ = useJob(valid ? (jobId as Hex) : undefined);
  const queryClient = useQueryClient();
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const cache = (job: JobView) => queryClient.setQueryData([...queryKeys.job(job.id)], job);

  const handleRun = async () => {
    const job = jobQ.data;
    if (!job) return;
    setRunBusy(true);
    setRunError(null);
    try {
      const result = await api.runJob(job.id);
      cache(result.job);
    } catch (e) {
      setRunError(isApiError(e) ? `${e.code}: ${e.message}${e.retryable ? " (retryable)" : ""}` : "Could not start the run. Retry.");
    } finally {
      setRunBusy(false);
    }
  };

  let body: React.ReactNode;
  if (!valid) {
    body = <p className="error" role="alert">BAD_INPUT: invalid job id.</p>;
  } else if (jobQ.isLoading) {
    body = <p className="tc-muted">Loading job…</p>;
  } else if (jobQ.error) {
    const e = jobQ.error;
    if (isApiError(e) && e.status === 401) {
      body = <p className="notice">Connect your wallet and sign in to open this job.</p>;
    } else if (isApiError(e) && e.status === 404) {
      // Never reveal whether another buyer owns the job.
      body = <p className="error" role="alert">NOT_FOUND: no such job for this buyer.</p>;
    } else {
      body = <p className="error" role="alert">{isApiError(e) ? `${e.code}: ${e.message}` : "Could not load the job."}</p>;
    }
  } else if (!jobQ.data) {
    body = <p className="error" role="alert">NOT_FOUND: no such job for this buyer.</p>;
  } else {
    const job = jobQ.data;
    const canStart = job.status === "paid";
    body = (
      <>
        <p>
          <StatusBadge status={job.status} /> <span className="tc-mono">{job.id}</span>
        </p>
        {job.error && <p className="error" role="alert">{job.error.code}: {job.error.message}</p>}
        {runError && <p className="error" role="alert">{runError}</p>}
        <div className="card">
          <h2>Source (en, immutable)</h2>
          {job.sourceSegments.map((s) => (
            <p key={s.id}><span className="tc-mono tc-muted">{s.id}</span>, {s.text}</p>
          ))}
        </div>
        <div className="card">
          <h2>Payment</h2>
          <ToolCityPay job={job} onJobChange={cache} />
        </div>
        {(canStart || job.retryEligible) && (
          <div className="card">
            <h2>{canStart ? "Start translation" : "Retry translation"}</h2>
            <p className="tc-muted">
              {canStart
                ? "Runs the paid job once. Maximum two dispatched attempts per job."
                : "Server reports this job retry-eligible (one manual retry)."}
            </p>
            <button type="button" className="btn btn-primary" disabled={runBusy} onClick={handleRun}>
              {runBusy ? "Working…" : canStart ? "Start translation" : "Retry translation"}
            </button>
          </div>
        )}
        <div className="card">
          <h2>Review & export</h2>
          <TranslationReview job={job} onSaved={cache} />
        </div>
        <JobEvidence job={job} />
      </>
    );
  }

  return (
    <AppShell>
      <div className="tc-page">
        <p><Link href="/jobs">← My Jobs</Link></p>
        <h1>Job detail</h1>
        {body}
      </div>
    </AppShell>
  );
}
