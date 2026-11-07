"use client";
// PurchaseTable: verified merchant settlements only, never buyer drafts,
// model text or edits. CSV download comes from the server route.
import type { MerchantPurchase } from "@/lib/shared/domain";

interface PurchaseTableProps {
  purchases: MerchantPurchase[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export default function PurchaseTable({ purchases, loading, error, onRetry }: PurchaseTableProps) {
  if (loading) return <p className="tc-muted">Loading verified purchases…</p>;
  if (error) {
    return (
      <div>
        <p className="error" role="alert">{error}</p>
        <button type="button" className="btn" onClick={onRetry}>Retry</button>
      </div>
    );
  }
  if (purchases.length === 0) return <p className="tc-muted">No verified purchases yet.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Job</th>
            <th>Buyer</th>
            <th>Tx hash</th>
            <th>Block</th>
            <th>Amount (atomic)</th>
            <th>Verified at</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((p) => (
            <tr key={p.jobId}>
              <td className="tc-mono">{p.jobId.slice(0, 14)}…</td>
              <td className="tc-mono">{p.buyerAddress.slice(0, 10)}…{p.buyerAddress.slice(-6)}</td>
              <td className="tc-mono">{p.txHash.slice(0, 14)}…</td>
              <td className="num">{p.blockNumber}</td>
              <td className="num">{p.amountAtomic}</td>
              <td>{new Date(p.verifiedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
