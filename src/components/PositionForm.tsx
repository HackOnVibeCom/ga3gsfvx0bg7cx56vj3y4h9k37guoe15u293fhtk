"use client";

import { ShieldCheck } from "lucide-react";
import type { CurrencyCode } from "@/lib/currency";
import type { PartyRole } from "@/lib/midpoint";
import type { PublicNegotiationView } from "@/lib/store";
import { DealWorkbench, type WorkbenchSubmitPayload } from "./DealWorkbench";

interface PositionFormProps {
  id: string;
  projectTitle: string;
  currency: CurrencyCode;
  viewerRole: PartyRole;
  creatorRole: PartyRole;
  platformFeeHint: number;
  onRevealed: (
    data: Extract<PublicNegotiationView, { status: "revealed" }>
  ) => void;
}

export function PositionForm({
  id,
  projectTitle,
  currency,
  viewerRole,
  creatorRole,
  platformFeeHint,
  onRevealed,
}: PositionFormProps) {
  async function handleRespond(payload: WorkbenchSubmitPayload) {
    const res = await fetch(`/api/negotiations/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.position),
    });

    const data = (await res.json()) as
      | (Extract<PublicNegotiationView, { status: "revealed" }> & {
          error?: never;
        })
      | { error?: string };

    if (!res.ok || !("status" in data) || data.status !== "revealed") {
      throw new Error(
        "error" in data && data.error
          ? data.error
          : "Failed to submit counterparty terms."
      );
    }

    try {
      window.localStorage.setItem(`midpoint_role_${id}`, viewerRole);
      if (data.draftToken) {
        window.localStorage.setItem(`midpoint_draft_token_${id}`, data.draftToken);
      }
    } catch {
      // Ignore storage errors
    }
    onRevealed(data);
  }

  const creatorLabel =
    creatorRole === "developer" ? "Freelance Developer" : "Client";
  const responderLabel =
    viewerRole === "developer" ? "Freelance Developer" : "Client";

  return (
    <div className="space-y-6">
      {/* Blind-Reveal Verification Header */}
      <section className="dsq-card p-6 sm:p-7 space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#39D98A]/35 bg-[#39D98A]/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#39D98A]">
          <ShieldCheck className="w-3.5 h-3.5" />
          Blind mediation active · You are the {responderLabel}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          {projectTitle}
        </h1>
        <p className="text-sm text-[#989898] leading-relaxed">
          The {creatorLabel} locked their terms. Submit yours blindly below to reveal the midpoint.
        </p>
      </section>

      <DealWorkbench
        mode="respond"
        lockedRole={viewerRole}
        lockedProjectTitle={projectTitle}
        lockedCurrency={currency}
        initialFeeHint={platformFeeHint}
        onSubmit={handleRespond}
      />
    </div>
  );
}
