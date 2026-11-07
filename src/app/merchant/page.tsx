"use client";
// Merchant console: wallet-signed publication / update / withdrawal via a
// dynamic @/lib/arkiv/write import with the connected wallet transport,
// plus the verified-settlements table and server CSV download.
// This view covers verified app purchases only, not an exhaustive chain index.
import { useCallback, useEffect, useState } from "react";
import type { Transport } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import AppShell from "@/components/app/AppShell";
import PurchaseTable from "@/components/merchant/PurchaseTable";
import WorkshopCard from "@/components/workshop/WorkshopCard";
import WorkshopEditor, { type WorkshopInput } from "@/components/workshop/WorkshopEditor";
import { getWorkshop, listWorkshops } from "@/lib/arkiv/read";
import { api, isApiError } from "@/lib/client/api-client";
import type { Address, MerchantPurchase, PublicConfig, WorkshopView } from "@/lib/shared/domain";
import { sameAddress } from "@/lib/shared/validation";

export default function MerchantPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [existing, setExisting] = useState<WorkshopView | null>(null);
  const [listingNote, setListingNote] = useState<string | null>(null);
  const [writeBusy, setWriteBusy] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeNote, setWriteNote] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<MerchantPurchase[]>([]);
  const [purchLoading, setPurchLoading] = useState(true);
  const [purchError, setPurchError] = useState<string | null>(null);

  const loadPurchases = useCallback(async () => {
    setPurchLoading(true);
    setPurchError(null);
    try {
      setPurchases(await api.merchantPurchases());
    } catch (e) {
      if (isApiError(e) && e.status === 401) setPurchError("Sign in with the merchant wallet to view settlements.");
      else if (isApiError(e) && e.status === 403) setPurchError("FORBIDDEN: this wallet is not the merchant.");
      else setPurchError(isApiError(e) ? `${e.code}: ${e.message}` : "Could not load settlements.");
    } finally {
      setPurchLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await api.config();
        if (cancelled) return;
        setConfig(cfg);
        try {
          const list = await listWorkshops(cfg);
          if (cancelled) return;
          setExisting(address ? (list.find((w) => sameAddress(w.ownerAddress, address)) ?? null) : null);
          setListingNote(`Loaded ${list.length} listing(s) from Arkiv.`);
        } catch {
          if (!cancelled) setListingNote("Arkiv query failed, listing state unknown.");
        }
      } catch {
        if (!cancelled) setListingNote("Public config unavailable.");
      }
      await loadPurchases();
    })();
    return () => { cancelled = true; };
  }, [address, loadPurchases]);

  const refreshListing = async (cfg: PublicConfig, entityKey: WorkshopView["entityKey"]) => {
    try {
      const fresh = await getWorkshop(cfg, entityKey);
      setExisting(fresh);
      if (config) void listWorkshops(config).then(() => {}).catch(() => {});
    } catch {
      setListingNote("Write broadcast; refresh the listing to confirm.");
    }
  };

  const write = async (kind: "publish" | "update" | "withdraw", input?: WorkshopInput & { active?: boolean }) => {
    setWriteError(null);
    setWriteNote(null);
    if (!walletClient?.transport || !address) {
      setWriteError("Connect the merchant wallet first.");
      return;
    }
    if (!config) {
      setWriteError("Public config not loaded yet.");
      return;
    }
    setWriteBusy(true);
    try {
      // Browser-only writes: dynamic import keeps the wallet/SDK path out of SSR.
      const mod = await import("@/lib/arkiv/write");
      const transport = walletClient.transport as unknown as Transport;
      const account = address as Address;
      if (kind === "publish") {
        if (!input) throw new Error("title and description are required");
        const receipt = await mod.createWorkshop(transport, account, config, { title: input.title, description: input.description });
        setWriteNote(`Published entity ${receipt.entityKey} (tx ${receipt.txHash}).`);
        await refreshListing(config, receipt.entityKey);
      } else {
        if (!existing) throw new Error("no listing to update");
        const receipt = kind === "update"
          ? await mod.updateWorkshop(transport, account, config, existing.entityKey, {
              title: input?.title,
              description: input?.description,
              active: input?.active,
            })
          : await mod.withdrawWorkshop(transport, account, config, existing.entityKey);
        setWriteNote(kind === "update" ? `Update broadcast (tx ${receipt.txHash}).` : `Withdrawal broadcast as active=false (tx ${receipt.txHash}).`);
        await refreshListing(config, receipt.entityKey);
      }
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : "Wallet write failed. A declined signature is recoverable, no listing changed.");
    } finally {
      setWriteBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="tc-page">
        <h1>Merchant console</h1>
        <p className="tc-muted">
          Connected wallet: <span className="tc-mono">{address ?? "not connected"}</span>
        </p>
        {listingNote && <p className="tc-muted">{listingNote}</p>}
        {existing && <WorkshopCard workshop={existing} />}
        {writeNote && <p className="notice">{writeNote}</p>}
        <WorkshopEditor
          existing={existing}
          busy={writeBusy}
          error={writeError}
          onPublish={(input) => void write("publish", input)}
          onUpdate={(input) => void write("update", input)}
          onWithdraw={() => void write("withdraw")}
        />
        <h2>Settlements</h2>
        <p className="tc-muted">
          Verified app purchases only, settlements confirmed by the server after onchain verification. This table
          never shows buyer drafts or translations, and it is not an exhaustive chain index.
        </p>
        <div className="btn-row">
          <a className="btn" href={api.merchantCsvUrl()} download>
            Download CSV
          </a>
        </div>
        <PurchaseTable purchases={purchases} loading={purchLoading} error={purchError} onRetry={loadPurchases} />
      </div>
    </AppShell>
  );
}
