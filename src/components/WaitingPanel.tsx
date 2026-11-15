"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import type { DealPosition, PartyRole } from "@/lib/midpoint";
import type { PublicNegotiationView } from "@/lib/store";
import { CopyButton } from "./CopyButton";

interface WaitingPanelProps {
  id: string;
  ownerToken: string;
  projectTitle: string;
  currency: CurrencyCode;
  viewerRole: PartyRole;
  positionA: DealPosition;
  onRevealed: (
    data: Extract<PublicNegotiationView, { status: "revealed" }>
  ) => void;
}

export function WaitingPanel({
  id,
  ownerToken,
  projectTitle,
  currency,
  viewerRole,
  positionA,
  onRevealed,
}: WaitingPanelProps) {
  const [origin, setOrigin] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      window.localStorage.setItem(`midpoint_role_${id}`, viewerRole);
    } catch {
      // Ignore storage errors
    }
  }, [id, viewerRole]);

  const checkStatus = useCallback(
    async (manual = false) => {
      if (manual) setChecking(true);
      const startedAt = Date.now();
      let revealedNow = false;
      try {
        const res = await fetch(
          `/api/negotiations/${id}?t=${encodeURIComponent(ownerToken)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as PublicNegotiationView;
        if (data.status === "revealed") {
          revealedNow = true;
          onRevealed(data);
        }
      } catch {
        // Ignore transient poll errors
      } finally {
        if (manual && !revealedNow) {
          const remaining = 550 - (Date.now() - startedAt);
          if (remaining > 0) {
            await new Promise((resolve) => setTimeout(resolve, remaining));
          }
          setChecking(false);
        } else if (manual) {
          setChecking(false);
        }
      }
    },
    [id, ownerToken, onRevealed]
  );

  useEffect(() => {
    const timer = setInterval(() => {
      void checkStatus(false);
    }, 3000);
    return () => clearInterval(timer);
  }, [checkStatus]);

  const shareUrl = origin ? `${origin}/r/${id}` : `/r/${id}`;
  const counterpartyLabel =
    viewerRole === "developer" ? "Client" : "Freelance Developer";
  const selfLabel =
    viewerRole === "developer" ? "Freelance Developer" : "Client";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <section className="dsq-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#5661FF]/50 bg-[#161B3A] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#C4CBFF]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5661FF] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#5661FF]" />
            </span>
            Waiting for {counterpartyLabel}
          </span>

          <button
            type="button"
            onClick={() => void checkStatus(true)}
            disabled={checking}
            className="inline-flex min-w-[132px] items-center justify-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] hover:border-white/25 px-3.5 py-1.5 text-xs font-medium text-[#B4B8C8] hover:text-white transition-colors cursor-pointer disabled:cursor-wait"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`}
            />
            <span>{checking ? "Checking..." : "Check status"}</span>
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5661FF]">
            {projectTitle}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Your terms are locked. Send this link to the {counterpartyLabel}.
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="dsq-recessed flex-1 rounded-full px-5 py-3 text-xs sm:text-sm font-victor text-[#F1F1F1] truncate select-all">
            {shareUrl}
          </div>
          <CopyButton
            text={shareUrl}
            label="Copy share link"
            copiedLabel="Link copied!"
            variant="cta"
            className="sm:w-auto w-full"
          />
        </div>
      </section>

      {/* Locked Multi-Parameter Summary Card */}
      <section className="dsq-card p-6 space-y-4">
        <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#989898]">
          YOUR LOCKED TERMS ({selfLabel})
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="dsq-tile rounded-xl p-3.5">
            <span className="block text-[10px] uppercase tracking-[0.12em] text-[#989898]">
              Budget / Quote
            </span>
            <span className="mt-1 block text-lg font-semibold text-white font-victor">
              {formatMoney(positionA.budget, currency)}
            </span>
          </div>
          <div className="dsq-tile rounded-xl p-3.5">
            <span className="block text-[10px] uppercase tracking-[0.12em] text-[#989898]">
              Scope Hours
            </span>
            <span className="mt-1 block text-lg font-semibold text-white font-victor">
              {positionA.hours} hrs
            </span>
          </div>
          <div className="dsq-tile rounded-xl p-3.5">
            <span className="block text-[10px] uppercase tracking-[0.12em] text-[#989898]">
              Upfront Deposit
            </span>
            <span className="mt-1 block text-lg font-semibold text-white font-victor">
              {positionA.depositPct}%
            </span>
          </div>
          <div className="dsq-tile rounded-xl p-3.5">
            <span className="block text-[10px] uppercase tracking-[0.12em] text-[#989898]">
              Payment Terms
            </span>
            <span className="mt-1 block text-lg font-semibold text-white font-victor">
              Net {positionA.netDays}
            </span>
          </div>
          <div className="dsq-tile rounded-xl p-3.5">
            <span className="block text-[10px] uppercase tracking-[0.12em] text-[#989898]">
              Revisions
            </span>
            <span className="mt-1 block text-lg font-semibold text-white font-victor">
              {positionA.revisions} rounds
            </span>
          </div>
          <div className="dsq-tile rounded-xl p-3.5">
            <span className="block text-[10px] uppercase tracking-[0.12em] text-[#989898]">
              Channel Fee
            </span>
            <span className="mt-1 block text-lg font-semibold text-white font-victor">
              {positionA.platformFeePct}%
            </span>
          </div>
        </div>

        <p className="text-xs text-[#989898] leading-relaxed pt-1">
          “{positionA.reason}”
        </p>
      </section>
    </div>
  );
}
