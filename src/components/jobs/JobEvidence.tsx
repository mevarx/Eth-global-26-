"use client";
// JobEvidence: actual listing/payment/request references with honest labels.
// Null evidence means unavailable/not reported, never success.
// routerTeeVerified is a Router report, not independent verification.
import type { JobView } from "@/lib/shared/domain";
import { shortKey } from "@/components/workshop/WorkshopCard";

export default function JobEvidence({ job }: { job: JobView }) {
  const ev = job.evidence;
  return (
    <div className="card">
      <h3>Evidence</h3>
      <h4>Listing</h4>
      <dl>
        <div><dt>Workshop entity key</dt><dd className="tc-mono">{job.workshopEntityKey}</dd></div>
        <div><dt>Service ID</dt><dd className="tc-mono">{job.terms.serviceId}</dd></div>
        <div><dt>Terms hash</dt><dd className="tc-mono">{job.terms.termsHash}</dd></div>
      </dl>
      <h4>Payment</h4>
      {job.payment ? (
        <dl>
          <div><dt>Transaction</dt><dd className="tc-mono">{job.payment.txHash}</dd></div>
          <div><dt>Status</dt><dd>{job.payment.status}</dd></div>
          <div><dt>Block</dt><dd>{job.payment.blockNumber ?? "pending confirmations"}</dd></div>
          <div><dt>Verified at</dt><dd>{job.payment.verifiedAt ?? "not yet verified"}</dd></div>
        </dl>
      ) : (
        <p className="tc-muted">No payment submitted for this job.</p>
      )}
      <h4>Inference request</h4>
      {ev ? (
        <dl>
          <div><dt>Request ID</dt><dd className="tc-mono">{ev.requestId ?? "not reported"}</dd></div>
          <div><dt>Model</dt><dd className="tc-mono">{ev.modelId ?? "not reported"}</dd></div>
          <div><dt>Provider</dt><dd className="tc-mono">{ev.providerId ?? "not reported"}</dd></div>
          <div><dt>Routing tier</dt><dd>{ev.routingTier ?? "not reported"}</dd></div>
          <div><dt>TEE verification requested</dt><dd>{ev.verificationRequested ? "yes" : "no"}</dd></div>
          <div>
            <dt>Router-reported TEE verification</dt>
            <dd>
              {ev.routerTeeVerified === null || ev.routerTeeVerified === undefined ? (
                <span className="badge">not reported, not verified</span>
              ) : ev.routerTeeVerified ? (
                <span className="badge badge-ready">router reports verified</span>
              ) : (
                <span className="badge badge-bad">router reports unverified</span>
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="tc-muted">Inference evidence unavailable, not reported, not success.</p>
      )}
      <p className="tc-muted">
        Job <span className="tc-mono">{shortKey(job.id)}</span> · attempts used {job.attemptsUsed}
        {job.retryEligible ? " · retry eligible" : ""}.
      </p>
    </div>
  );
}
