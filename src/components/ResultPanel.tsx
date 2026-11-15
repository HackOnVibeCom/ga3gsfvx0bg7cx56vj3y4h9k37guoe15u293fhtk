"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronDown, Download, Loader2, Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import {
  buildFallbackMediationCopy,
  isLegacyMediationRationale,
  stripLongDashes,
} from "@/lib/mediation-copy";
import type { ConfidenceTier, PartyRole } from "@/lib/midpoint";
import type { PublicNegotiationView } from "@/lib/store";
import { CopyButton } from "./CopyButton";

type RevealedData = Extract<PublicNegotiationView, { status: "revealed" }>;

interface ResultPanelProps {
  data: RevealedData;
}

const CONFIDENCE_THEME: Record<
  ConfidenceTier,
  {
    label: string;
    badgeClass: string;
    accentColor: string;
    cardBackground: string;
    ambientGlow: string;
    dotShadow: string;
  }
> = {
  close: {
    label: "CLOSE ALIGNMENT",
    badgeClass: "border-[#39D98A]/35 bg-[#39D98A]/15 text-[#39D98A]",
    accentColor: "#39D98A",
    cardBackground:
      "linear-gradient(135deg, #0D2921, #10131C)",
    ambientGlow:
      "radial-gradient(circle at 18% 15%, rgba(57, 217, 138, 0.28) 0%, rgba(57, 217, 138, 0.06) 45%, transparent 75%)",
    dotShadow: "0 0 14px rgba(57, 217, 138, 0.85)",
  },
  moderate: {
    label: "MODERATE GAP",
    badgeClass: "border-[#FFB800]/35 bg-[#FFB800]/15 text-[#FFB800]",
    accentColor: "#FFB800",
    cardBackground:
      "linear-gradient(135deg, #2B1D0B, #10131C)",
    ambientGlow:
      "radial-gradient(circle at 18% 15%, rgba(255, 184, 0, 0.3) 0%, rgba(255, 184, 0, 0.08) 45%, transparent 75%)",
    dotShadow: "0 0 14px rgba(255, 184, 0, 0.85)",
  },
  wide: {
    label: "WIDE GAP",
    badgeClass: "border-[#FF006D]/40 bg-[#FF006D]/15 text-[#FF006D]",
    accentColor: "#FF006D",
    cardBackground:
      "linear-gradient(135deg, #2E0C20, #141226, #101219)",
    ambientGlow:
      "radial-gradient(circle at 18% 15%, rgba(255, 0, 109, 0.3) 0%, rgba(86, 97, 255, 0.12) 48%, transparent 78%)",
    dotShadow: "0 0 14px rgba(255, 0, 109, 0.85)",
  },
  no_overlap: {
    label: "NO OVERLAP",
    badgeClass: "border-[#FF006D]/40 bg-[#FF006D]/15 text-[#FF006D]",
    accentColor: "#FF006D",
    cardBackground:
      "linear-gradient(135deg, #2E0C20, #141226, #101219)",
    ambientGlow:
      "radial-gradient(circle at 18% 15%, rgba(255, 0, 109, 0.3) 0%, rgba(86, 97, 255, 0.12) 48%, transparent 78%)",
    dotShadow: "0 0 14px rgba(255, 0, 109, 0.85)",
  },
};

function DisclosureAccordion({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-white/[0.08] pt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-xs font-semibold text-[#B4B8C8] hover:text-white transition-colors cursor-pointer text-left"
      >
        <span>{label}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-[#989898] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        aria-hidden={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          open
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0 pointer-events-none"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function ResultPanel({ data }: ResultPanelProps) {
  const { developer, client, summary, currency, projectTitle, viewerRole } = data;
  const hasLegacyCopy = isLegacyMediationRationale(data.rationale);
  const cleanCopy = hasLegacyCopy
    ? buildFallbackMediationCopy({
        projectTitle,
        currency,
        developer,
        client,
        summary,
      })
    : null;
  const verdictText = stripLongDashes(
    cleanCopy ? cleanCopy.rationale : data.rationale
  );
  const initialDraftText = stripLongDashes(
    cleanCopy ? cleanCopy.draftMessage : data.draftMessage
  );

  const [notesOpen, setNotesOpen] = useState(false);
  const [mathOpen, setMathOpen] = useState(false);
  const [bridgeOptionsOpen, setBridgeOptionsOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [storedRole, setStoredRole] = useState<PartyRole | null>(null);
  const [storedDraftToken, setStoredDraftToken] = useState<string | null>(
    data.draftToken ?? null
  );
  const [draftText, setDraftText] = useState(initialDraftText);
  const [draftingAi, setDraftingAi] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftGeneratedOnce, setDraftGeneratedOnce] = useState(false);
  const [dealAccepted, setDealAccepted] = useState(false);

  const activeViewerRole: PartyRole | null = viewerRole ?? storedRole;
  const canGenerateAiDraft = Boolean(storedDraftToken);
  const shareUrl = origin ? `${origin}/r/${data.id}` : `/r/${data.id}`;

  async function handleAcceptDeal() {
    setDealAccepted(true);
    try {
      window.localStorage.setItem(`midpoint_accepted_${data.id}`, "1");
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(draftText);
      }
    } catch {
      // Ignore clipboard or storage errors
    }
  }

  async function handleDownloadPdf() {
    if (exportingPdf) return;
    setExportingPdf(true);
    setPdfError(null);
    try {
      const { downloadMediationPdf } = await import("@/lib/export-pdf");
      await downloadMediationPdf(
        {
          ...data,
          rationale: verdictText,
          draftMessage: draftText,
        },
        shareUrl
      );
    } catch {
      setPdfError("Failed to generate PDF. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleGenerateAiDraft() {
    if (draftingAi) return;
    setDraftingAi(true);
    setDraftError(null);
    try {
      const params = new URLSearchParams(window.location.search);
      const token =
        params.get("t") ||
        storedDraftToken ||
        window.localStorage.getItem(`midpoint_draft_token_${data.id}`);
      const res = await fetch(`/api/negotiations/${data.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viewerRole: activeViewerRole,
          token,
        }),
      });
      const payload = (await res.json()) as {
        draftMessage?: string;
        error?: string;
      };
      if (!res.ok || !payload.draftMessage) {
        setDraftError(
          payload.error ?? "Failed to generate draft. Please try again."
        );
        return;
      }
      setDraftText(stripLongDashes(payload.draftMessage));
      setDraftGeneratedOnce(true);
    } catch {
      setDraftError("Network error while drafting message. Please try again.");
    } finally {
      setDraftingAi(false);
    }
  }

  useEffect(() => {
    setDraftText(initialDraftText);
  }, [data.id, initialDraftText]);

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("t");
      const tokenToPersist = urlToken || data.draftToken;
      if (tokenToPersist) {
        window.localStorage.setItem(
          `midpoint_draft_token_${data.id}`,
          tokenToPersist
        );
        setStoredDraftToken(tokenToPersist);
      } else {
        const savedToken = window.localStorage.getItem(
          `midpoint_draft_token_${data.id}`
        );
        if (savedToken) {
          setStoredDraftToken(savedToken);
        }
      }

      if (data.viewerRole) {
        window.localStorage.setItem(`midpoint_role_${data.id}`, data.viewerRole);
      } else {
        const saved = window.localStorage.getItem(`midpoint_role_${data.id}`);
        if (saved === "developer" || saved === "client") {
          setStoredRole(saved);
        }
      }

      if (window.localStorage.getItem(`midpoint_accepted_${data.id}`) === "1") {
        setDealAccepted(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, [data.id, data.viewerRole, data.draftToken]);

  const confidenceKey: ConfidenceTier =
    summary.confidence ?? summary.budget.confidence ?? "moderate";
  const theme = CONFIDENCE_THEME[confidenceKey];
  const settledBudget = summary.budget.midpoint;
  const mediatedEcon = summary.mediatedEconomics;
  const hasOverlap =
    summary.hasZopa && settledBudget !== null && mediatedEcon !== null;

  const publicGap =
    summary.bridgeOptions?.publicGap ??
    Math.round(Math.abs(developer.budget - client.budget));
  const recommendedBudget =
    summary.bridgeOptions?.recommendedBudget ??
    Math.round((developer.budget + client.budget) / 2);
  const recommendedHours =
    summary.bridgeOptions?.recommendedHours ??
    Math.max(
      1,
      Math.round(
        client.budget /
          Math.max(1, developer.budget / Math.max(1, developer.hours))
      )
    );

  const gapPctFormatted = `${(summary.budget.gapPct * 100).toFixed(
    summary.budget.gapPct === 0 ? 0 : 1
  )}%`;

  const fmtRounds = (n: number) => `${n} ${n === 1 ? "round" : "rounds"}`;
  const fmtDays = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
  const fmtHours = (n: number) => `${n} ${n === 1 ? "hr" : "hrs"}`;

  const summaryClipboard =
    hasOverlap && settledBudget !== null && mediatedEcon !== null
      ? `MidPoint Deal Verdict: ${projectTitle}
Mediated Budget: ${formatMoney(settledBudget, currency)} (${theme.label})
Scope Effort: ${fmtHours(summary.hours.midpoint)} (${formatMoney(mediatedEcon.effectiveRate, currency, 2)}/hr effective net)
Upfront Deposit: ${summary.depositPct.midpoint}% (${formatMoney(summary.depositAmount, currency)})
Payment Terms: Net ${fmtDays(summary.netDays.midpoint)}
Revision Cap: ${fmtRounds(summary.revisions.midpoint)}

${verdictText}`
      : `MidPoint Deal Verdict: ${projectTitle}
Status: ${theme.label} (Public Offer Spread: ${formatMoney(publicGap, currency)})
Developer Offer: ${formatMoney(developer.budget, currency)} (${fmtHours(developer.hours)})
Client Offer: ${formatMoney(client.budget, currency)} (${fmtHours(client.hours)})
Bridge Path 1 (Full Scope): ~${formatMoney(recommendedBudget, currency)} for ${fmtHours(summary.hours.midpoint)}
Bridge Path 2 (Cap Scope): ${formatMoney(client.budget, currency)} capped at ${fmtHours(recommendedHours)}

${verdictText}`;

  const rows = [
    {
      label: "Project Budget",
      dev: formatMoney(developer.budget, currency),
      client: formatMoney(client.budget, currency),
      spread: gapPctFormatted,
      midpoint:
        hasOverlap && settledBudget !== null
          ? formatMoney(settledBudget, currency)
          : "No overlap",
      highlight: true,
    },
    {
      label: "Estimated Scope",
      dev: fmtHours(developer.hours),
      client: fmtHours(client.hours),
      spread: fmtHours(Math.abs(developer.hours - client.hours)),
      midpoint: hasOverlap ? fmtHours(summary.hours.midpoint) : "Pending",
      highlight: false,
    },
    {
      label: "Effective Rate (Net)",
      dev: `${formatMoney(summary.developerEconomics.effectiveRate, currency, 2)}/hr`,
      client: `${formatMoney(summary.clientEconomics.effectiveRate, currency, 2)}/hr`,
      spread: `${summary.platformFeePct}% fee`,
      midpoint:
        hasOverlap && mediatedEcon !== null
          ? `${formatMoney(mediatedEcon.effectiveRate, currency, 2)}/hr`
          : "Pending",
      highlight: true,
    },
    {
      label: "Upfront Deposit",
      dev: `${developer.depositPct}%`,
      client: `${client.depositPct}%`,
      spread: `${Math.abs(developer.depositPct - client.depositPct)} pts`,
      midpoint: hasOverlap
        ? `${summary.depositPct.midpoint}% (${formatMoney(
            summary.depositAmount,
            currency
          )})`
        : "Pending",
      highlight: false,
    },
    {
      label: "Payment Terms",
      dev: `Net ${developer.netDays}`,
      client: `Net ${client.netDays}`,
      spread: fmtDays(Math.abs(developer.netDays - client.netDays)),
      midpoint: hasOverlap ? `Net ${fmtDays(summary.netDays.midpoint)}` : "Pending",
      highlight: false,
    },
    {
      label: "Revision Cap",
      dev: fmtRounds(developer.revisions),
      client: fmtRounds(client.revisions),
      spread: fmtRounds(Math.abs(developer.revisions - client.revisions)),
      midpoint: hasOverlap ? fmtRounds(summary.revisions.midpoint) : "Pending",
      highlight: false,
    },
  ];

  const actionPlan = summary.actionPlan ?? {
    tone: hasOverlap
      ? summary.mediatedRisk.tier === "HIGH RISK"
        ? "high_risk"
        : summary.mediatedRisk.tier === "MEDIUM RISK"
        ? "conditional"
        : "ready"
      : "bridge",
    badge: hasOverlap
      ? summary.mediatedRisk.tier === "HIGH RISK"
        ? "HIGH EXPOSURE WARNING"
        : summary.mediatedRisk.tier === "MEDIUM RISK"
        ? "CONDITIONAL APPROVAL"
        : "READY FOR KICKOFF"
      : "WAYS TO BRIDGE THIS GAP",
    title: hasOverlap
      ? summary.mediatedRisk.tier === "HIGH RISK"
        ? "Mandatory Risk Countermeasures"
        : summary.mediatedRisk.tier === "MEDIUM RISK"
        ? "Recommended Contract Guardrails"
        : "Next Steps to Finalize"
      : "Paths to Unlock an Agreement",
    subtitle: hasOverlap
      ? `Commercial terms and risk profile (${summary.mediatedRisk.score}/100) evaluated for contract execution:`
      : `Current boundaries do not intersect across the ${formatMoney(
          publicGap,
          currency
        )} offer spread. Choose one of these trade-offs:`,
    items:
      summary.guardrails && summary.guardrails.length > 0
        ? summary.guardrails
        : hasOverlap && settledBudget !== null
        ? [
            summary.depositPct.midpoint > 0
              ? `Issue Invoice #1 for the ${summary.depositPct.midpoint}% upfront deposit (${formatMoney(
                  summary.depositAmount,
                  currency
                )}) prior to kickoff.`
              : `Split the ${formatMoney(
                  settledBudget,
                  currency
                )} total into milestone invoices on Net ${summary.netDays.midpoint} terms.`,
            `Cap scope at ${summary.hours.midpoint} engineering ${
              summary.hours.midpoint === 1 ? "hour" : "hours"
            } and ${summary.revisions.midpoint} revision ${
              summary.revisions.midpoint === 1 ? "round" : "rounds"
            }.`,
            `Sign a Scope of Work (SOW) referencing the ${formatMoney(
              settledBudget,
              currency
            )} mediated price.`,
          ]
        : [
            `Option A (Full Scope Compromise): Meet near ${formatMoney(
              recommendedBudget,
              currency
            )} for the ${summary.hours.midpoint}-hour scope.`,
            `Option B (Cap Scope to Client Budget): Hold budget at ${formatMoney(
              client.budget,
              currency
            )} by capping Phase 1 scope at ${recommendedHours} estimated hours.`,
            `Option C (Phased Milestone Split): Lock Core MVP now and price remaining hours as Phase 2.`,
          ],
  };

  const isExactBudgetMatch = developer.budget === client.budget;
  const lowSide = developer.budget <= client.budget ? "DEVELOPER" : "CLIENT";
  const highSide = developer.budget <= client.budget ? "CLIENT" : "DEVELOPER";
  const lowVal = Math.min(developer.budget, client.budget);
  const highVal = Math.max(developer.budget, client.budget);
  const settledRatio =
    hasOverlap && settledBudget !== null && highVal > lowVal
      ? Math.min(1, Math.max(0, (settledBudget - lowVal) / (highVal - lowVal)))
      : 0.5;
  const settledTrackPct = Math.round((12 + settledRatio * 76) * 10) / 10;
  const settledLabelPct = Math.min(82, Math.max(18, settledTrackPct));

  return (
    <div className="space-y-6">
      {/* Project Title & Role Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {projectTitle}
        </h1>
        <span className="rounded-full border border-white/12 bg-[#0E0E13] px-3.5 py-1.5 text-xs font-medium text-[#B4B8C8]">
          {activeViewerRole ? (
            <>
              Viewing as{" "}
              <strong className="text-white">
                {activeViewerRole === "developer"
                  ? "Freelance Developer"
                  : "Client"}
              </strong>
            </>
          ) : (
            <>
              Shared Result ·{" "}
              <strong className="text-white">Public View</strong>
            </>
          )}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 items-start">
        {/* LEFT COLUMN (3fr): Verdict + Vetly Comparison Table + Visualizer + Math */}
        <div className="space-y-6">
          {/* 1. Mediated Verdict Card */}
          <section
            className="relative overflow-hidden rounded-[20px] border border-white/12 p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            style={{ background: theme.cardBackground }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ background: theme.ambientGlow }}
            />

            <div className="relative space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B4B8C8]">
                    MEDIATED VERDICT
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${theme.badgeClass}`}
                  >
                    {theme.label}
                  </span>
                </div>
                <CopyButton text={summaryClipboard} label="Copy result" />
              </div>

              {hasOverlap && settledBudget !== null && mediatedEcon !== null ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div>
                    <p className="text-xs text-[#B4B8C8]">
                      Fair Mediated Budget
                    </p>
                    <div className="text-4xl sm:text-5xl font-semibold tracking-tight text-white font-victor mt-1">
                      {formatMoney(settledBudget, currency)}
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-xs text-[#989898]">
                      Mediated Effective Rate (Net)
                    </p>
                    <div className="text-2xl sm:text-3xl font-semibold text-[#F1F1F1] font-victor mt-0.5">
                      {formatMoney(mediatedEcon.effectiveRate, currency, 2)}
                      <span className="text-sm font-normal text-[#989898]">
                        /hr
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div>
                      <p className="text-xs text-[#B4B8C8]">
                        Public Offer Spread
                      </p>
                      <div className="text-4xl sm:text-5xl font-semibold tracking-tight text-white font-victor mt-1">
                        {formatMoney(publicGap, currency)}
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-xs text-[#989898]">
                        Submitted Quotes
                      </p>
                      <div className="text-lg sm:text-xl font-semibold text-[#F1F1F1] font-victor mt-1">
                        {formatMoney(lowVal, currency)}{" "}
                        <span className="text-xs font-normal text-[#989898]">
                          vs
                        </span>{" "}
                        {formatMoney(highVal, currency)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-[#090B10]/55 px-4 py-3">
                      <span className="block text-[11px] font-medium text-[#989898]">
                        Path 1 · Full-Scope Target
                      </span>
                      <div className="flex items-baseline justify-between gap-2 mt-1">
                        <span className="text-lg font-semibold text-white font-victor">
                          ~{formatMoney(recommendedBudget, currency)}
                        </span>
                        <span className="text-xs text-[#B4B8C8] font-victor whitespace-nowrap">
                          {summary.hours.midpoint} hrs scope
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#090B10]/55 px-4 py-3">
                      <span className="block text-[11px] font-medium text-[#989898]">
                        Path 2 · Budget-Capped MVP
                      </span>
                      <div className="flex items-baseline justify-between gap-2 mt-1">
                        <span className="text-lg font-semibold text-white font-victor">
                          {recommendedHours} hrs
                        </span>
                        <span className="text-xs text-[#B4B8C8] font-victor whitespace-nowrap">
                          at {formatMoney(client.budget, currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-sm sm:text-[15px] text-[#F1F1F1]/90 leading-relaxed">
                {verdictText}
              </p>
            </div>
          </section>

          {/* 2. Multi-Parameter Comparison Table (Vetly Table Style) */}
          <section className="dsq-card p-6 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B4B8C8]">
                DEAL BREAKDOWN MATRIX
              </p>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold font-victor ${theme.badgeClass}`}
              >
                {gapPctFormatted} budget gap
              </span>
            </div>

            <div className="overflow-x-auto no-scrollbar -mx-2 px-2">
              <table className="w-full text-left border-collapse min-w-[520px]">
                <thead>
                  <tr className="border-b border-white/[0.08] text-[10px] font-bold uppercase tracking-[0.14em] text-[#989898]">
                    <th className="py-3 pr-3">Parameter</th>
                    <th className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5">
                        Developer
                        {activeViewerRole === "developer" && (
                          <span className="rounded bg-[#5661FF]/25 text-[#A88FFF] px-1.5 py-0.5 text-[9px]">
                            YOU
                          </span>
                        )}
                      </span>
                    </th>
                    <th className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5">
                        Client
                        {activeViewerRole === "client" && (
                          <span className="rounded bg-[#FF006D]/25 text-[#FF85B8] px-1.5 py-0.5 text-[9px]">
                            YOU
                          </span>
                        )}
                      </span>
                    </th>
                    <th className="py-3 px-3">Spread</th>
                    <th className="py-3 pl-3 text-right text-white">
                      Fair MidPoint
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-xs sm:text-sm">
                  {rows.map((row) => (
                    <tr
                      key={row.label}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 pr-3 font-medium text-[#B4B8C8]">
                        {row.label}
                      </td>
                      <td className="py-3.5 px-3 font-victor text-[#F1F1F1]">
                        {row.dev}
                      </td>
                      <td className="py-3.5 px-3 font-victor text-[#F1F1F1]">
                        {row.client}
                      </td>
                      <td className="py-3.5 px-3 font-victor text-xs text-[#989898]">
                        {row.spread}
                      </td>
                      <td
                        className={`py-3.5 pl-3 text-right font-victor font-semibold ${
                          row.highlight
                            ? hasOverlap
                              ? "text-[#39D98A]"
                              : "text-[#FF85B8]"
                            : hasOverlap
                              ? "text-white"
                              : "text-[#989898]"
                        }`}
                      >
                        {row.midpoint}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Expandable Party Notes Accordion */}
            <DisclosureAccordion
              label="Developer scope notes & client budget context"
              open={notesOpen}
              onToggle={() => setNotesOpen((prev) => !prev)}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="dsq-tile rounded-xl p-4 space-y-1.5">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#B4B8C8]">
                    Developer Scope Notes
                  </span>
                  {developer.reason.trim() ? (
                    <p className="text-xs text-[#F1F1F1]/85 leading-relaxed break-words whitespace-pre-wrap">
                      “{developer.reason}”
                    </p>
                  ) : (
                    <p className="text-xs text-[#989898] italic">
                      No notes added.
                    </p>
                  )}
                </div>
                <div className="dsq-tile rounded-xl p-4 space-y-1.5">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#B4B8C8]">
                    Client Budget Context
                  </span>
                  {client.reason.trim() ? (
                    <p className="text-xs text-[#F1F1F1]/85 leading-relaxed break-words whitespace-pre-wrap">
                      “{client.reason}”
                    </p>
                  ) : (
                    <p className="text-xs text-[#989898] italic">
                      No notes added.
                    </p>
                  )}
                </div>
              </div>
            </DisclosureAccordion>

            {/* Comparison Visualizer Track */}
            <div className="dsq-tile rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#B4B8C8]">
                  Budget Comparison Visualizer
                </span>
                <span className="text-[11px] font-victor text-[#989898]">
                  {hasOverlap
                    ? `Spread: ${formatMoney(highVal - lowVal, currency)}`
                    : `Offer spread: ${formatMoney(publicGap, currency)}`}
                </span>
              </div>

              {!hasOverlap || settledBudget === null ? (
                <div className="pt-6 pb-8 relative">
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 text-center">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#FF006D]">
                      NO OVERLAP
                    </span>
                    <span className="block text-xs font-bold text-white font-victor whitespace-nowrap">
                      Offer Spread: {formatMoney(publicGap, currency)}
                    </span>
                  </div>

                  <div className="relative h-1.5 mt-3">
                    <div className="absolute left-[12%] right-[58%] top-0 bottom-0 rounded-full bg-white/20" />
                    <div className="absolute left-[58%] right-[12%] top-0 bottom-0 rounded-full bg-white/20" />
                    <div className="absolute left-[12%] top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#07090D] border-2 border-[#B4B8C8]" />
                    <div
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-0.5 border-t border-dashed border-[#FF006D]/75"
                      aria-hidden="true"
                    />
                    <div className="absolute left-[88%] top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#07090D] border-2 border-[#B4B8C8]" />
                  </div>

                  <div className="relative mt-3 min-h-9">
                    <div className="absolute left-0 translate-x-0 text-left sm:left-[12%] sm:-translate-x-1/2 sm:text-center">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#989898]">
                        {lowSide} OFFER
                      </span>
                      <span className="block text-xs font-semibold text-[#B4B8C8] font-victor whitespace-nowrap">
                        {formatMoney(lowVal, currency)}
                      </span>
                    </div>

                    <div className="absolute right-0 translate-x-0 text-right sm:right-auto sm:left-[88%] sm:-translate-x-1/2 sm:text-center">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#989898]">
                        {highSide} OFFER
                      </span>
                      <span className="block text-xs font-semibold text-[#B4B8C8] font-victor whitespace-nowrap">
                        {formatMoney(highVal, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : isExactBudgetMatch ? (
                <div className="py-4 text-center space-y-2">
                  <div className="relative h-1.5 rounded-full bg-white/10">
                    <div
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white"
                      style={{
                        backgroundColor: theme.accentColor,
                        boxShadow: theme.dotShadow,
                      }}
                    />
                  </div>
                  <p className="text-xs font-medium text-[#39D98A] font-victor">
                    Exact match at {formatMoney(settledBudget, currency)}
                  </p>
                </div>
              ) : (
                <div className="pt-6 pb-8 relative">
                  <div
                    className="absolute -translate-x-1/2 top-0 text-center transition-all duration-300"
                    style={{ left: `${settledLabelPct}%` }}
                  >
                    <span
                      className="block text-[10px] font-bold uppercase tracking-[0.12em] whitespace-nowrap"
                      style={{ color: theme.accentColor }}
                    >
                      SETTLED DEAL
                    </span>
                    <span className="block text-xs font-bold text-white font-victor whitespace-nowrap">
                      {formatMoney(settledBudget, currency)}
                    </span>
                  </div>

                  <div className="relative h-1.5 rounded-full bg-white/10 mt-3">
                    <div
                      className="absolute top-0 bottom-0 left-[12%] right-[12%] rounded-full opacity-55"
                      style={{ backgroundColor: theme.accentColor }}
                    />
                    <div className="absolute left-[12%] top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#07090D] border-2 border-[#B4B8C8]" />
                    <div
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 transition-all duration-300"
                      style={{
                        left: `${settledTrackPct}%`,
                        borderColor: theme.accentColor,
                        boxShadow: theme.dotShadow,
                      }}
                    />
                    <div className="absolute left-[88%] top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#07090D] border-2 border-[#B4B8C8]" />
                  </div>

                  <div className="relative mt-3 min-h-9">
                    <div className="absolute left-0 translate-x-0 text-left sm:left-[12%] sm:-translate-x-1/2 sm:text-center">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#989898]">
                        {lowSide}
                      </span>
                      <span className="block text-xs font-semibold text-[#B4B8C8] font-victor whitespace-nowrap">
                        {formatMoney(lowVal, currency)}
                      </span>
                    </div>

                    <div className="absolute right-0 translate-x-0 text-right sm:right-auto sm:left-[88%] sm:-translate-x-1/2 sm:text-center">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#989898]">
                        {highSide}
                      </span>
                      <span className="block text-xs font-semibold text-[#B4B8C8] font-victor whitespace-nowrap">
                        {formatMoney(highVal, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Expandable Math Accordion */}
            <DisclosureAccordion
              label={
                hasOverlap
                  ? "How this mediated deal & effective rate were computed"
                  : "How this overlap check was computed"
              }
              open={mathOpen}
              onToggle={() => setMathOpen((prev) => !prev)}
            >
              {hasOverlap && settledBudget !== null && mediatedEcon !== null ? (
                <div className="dsq-recessed rounded-xl p-4 space-y-2.5 text-xs text-[#B4B8C8]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Settled Budget (Overlap Balance)</span>
                    <code className="font-victor text-white">
                      {formatMoney(settledBudget, currency)}
                    </code>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Net Budget (after {summary.platformFeePct}% fee)</span>
                    <code className="font-victor text-white">
                      {formatMoney(Math.round(mediatedEcon.netBudget), currency)}
                    </code>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Adjusted Hours (10% overhead + {mediatedEcon.revisionBufferPct}% rev. buffer)</span>
                    <code className="font-victor text-white">
                      {summary.hours.midpoint} hrs →{" "}
                      {Math.round(mediatedEcon.adjustedHours)} adj. hrs
                    </code>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Risk &amp; Cashflow Balance Shift</span>
                    <code className="font-victor text-white">
                      {summary.termAdjustmentTotal
                        ? `${summary.termAdjustmentTotal > 0 ? "+" : ""}${summary.termAdjustmentTotal}% weight`
                        : "Balanced 50/50 split"}
                    </code>
                  </div>
                  {summary.termAdjustmentFactors &&
                    summary.termAdjustmentFactors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {summary.termAdjustmentFactors.map((f) => (
                          <span
                            key={f.label}
                            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-victor text-[#B4B8C8]"
                          >
                            <span>{f.label}</span>
                            <span
                              className={
                                f.deltaPct > 0
                                  ? "text-[#FFB800]"
                                  : "text-[#39D98A]"
                              }
                            >
                              {f.deltaPct > 0 ? `+${f.deltaPct}%` : `${f.deltaPct}%`}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                    <span>Mediated Effective Rate</span>
                    <code className="font-victor text-[#39D98A] font-semibold">
                      {formatMoney(mediatedEcon.effectiveRate, currency, 2)}/hr
                    </code>
                  </div>
                </div>
              ) : (
                <div className="dsq-recessed rounded-xl p-4 space-y-2.5 text-xs text-[#B4B8C8]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Private Range Check</span>
                    <code className="font-victor text-[#FF85B8]">
                      No overlapping range
                    </code>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Public Offer Spread</span>
                    <code className="font-victor text-white">
                      {formatMoney(publicGap, currency)} ({formatMoney(lowVal, currency)} vs {formatMoney(highVal, currency)})
                    </code>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Compromise Full-Scope Target ({summary.hours.midpoint} hrs)</span>
                    <code className="font-victor text-white">
                      ~{formatMoney(recommendedBudget, currency)}
                    </code>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Scope Cap at Client Budget ({formatMoney(client.budget, currency)})</span>
                    <code className="font-victor text-[#39D98A] font-semibold">
                      {recommendedHours} estimated hrs
                    </code>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                    <span>Effective Rate Check</span>
                    <code className="font-victor text-white">
                      Dev {formatMoney(summary.developerEconomics.effectiveRate, currency, 2)}/hr · Client{" "}
                      {formatMoney(summary.clientEconomics.effectiveRate, currency, 2)}/hr
                    </code>
                  </div>
                </div>
              )}
            </DisclosureAccordion>
          </section>
        </div>

        {/* RIGHT COLUMN (2fr): Dynamic 4-State Action Plan + Ready-to-Send SOW Draft + Sharing */}
        <div className="space-y-6 lg:sticky lg:top-6">
          {/* Dynamic Context-Aware Action Plan Card */}
          <section className="dsq-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {actionPlan.tone === "bridge" ? (
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B4B8C8]">
                  {actionPlan.badge}
                </span>
              ) : (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    actionPlan.tone === "ready"
                      ? "border-[#39D98A]/35 bg-[#39D98A]/15 text-[#39D98A]"
                      : actionPlan.tone === "conditional"
                      ? "border-[#FFB800]/35 bg-[#FFB800]/15 text-[#FFB800]"
                      : "border-[#FF006D]/40 bg-[#FF006D]/15 text-[#FF006D]"
                  }`}
                >
                  {actionPlan.badge}
                </span>
              )}
              <span className="text-[11px] font-victor text-[#989898]">
                {hasOverlap
                  ? `Risk ${summary.mediatedRisk.score}/100`
                  : `Spread ${formatMoney(publicGap, currency)}`}
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">
                {actionPlan.title}
              </h2>
              <p className="text-xs text-[#B4B8C8] leading-relaxed">
                {actionPlan.subtitle}
              </p>
            </div>

            {actionPlan.tone === "bridge" ? (
              <DisclosureAccordion
                label={
                  bridgeOptionsOpen
                    ? `Hide ${actionPlan.items.length} ways to bridge this gap`
                    : `Show ${actionPlan.items.length} ways to bridge this gap`
                }
                open={bridgeOptionsOpen}
                onToggle={() => setBridgeOptionsOpen((prev) => !prev)}
              >
                <ul className="space-y-3">
                  {actionPlan.items.map((item, idx) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-xs sm:text-sm text-[#F1F1F1]/90 leading-relaxed"
                    >
                      <span className="mt-0.5 w-5 h-5 rounded-full border border-[#5661FF]/45 bg-[#5661FF]/15 text-[#8C94FF] flex items-center justify-center shrink-0 text-[10px] font-bold font-victor">
                        {idx + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </DisclosureAccordion>
            ) : (
              <ul className="space-y-3 pt-1">
                {actionPlan.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-xs sm:text-sm text-[#F1F1F1]/90 leading-relaxed"
                  >
                    <span
                      className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 text-[10px] font-bold font-victor ${
                        actionPlan.tone === "ready"
                          ? "border-[#39D98A]/45 bg-[#39D98A]/12 text-[#39D98A]"
                          : actionPlan.tone === "conditional"
                          ? "border-[#FFB800]/45 bg-[#FFB800]/12 text-[#FFB800]"
                          : "border-[#FF006D]/45 bg-[#FF006D]/12 text-[#FF006D]"
                      }`}
                    >
                      <Check className="w-3 h-3" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}

            {hasOverlap && (
              <div className="pt-2 border-t border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => void handleAcceptDeal()}
                  className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    dealAccepted
                      ? "border border-[#39D98A]/50 bg-[#39D98A]/15 text-[#39D98A]"
                      : "btn-dsq-primary"
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {dealAccepted
                      ? "Deal Accepted · SOW Copied to Clipboard"
                      : "Accept Mediated Deal & Copy SOW"}
                  </span>
                </button>
              </div>
            )}
          </section>

          {/* Ready-to-Send SOW / Follow-Up Draft */}
          <section className="dsq-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B4B8C8]">
                {hasOverlap ? "READY-TO-SEND SOW DRAFT" : "SUGGESTED FOLLOW-UP MESSAGE"}
              </span>
            </div>

            <div className="dsq-recessed rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
                <span className="text-xs font-medium text-[#B4B8C8]">
                  {hasOverlap ? "Agreement summary message" : "Follow-up message to counterparty"}
                </span>
                <CopyButton
                  text={draftText}
                  label="Copy message"
                  copiedLabel="Copied!"
                />
              </div>

              <p className="text-xs sm:text-sm text-[#F1F1F1] leading-relaxed whitespace-pre-line">
                {draftText}
              </p>
            </div>

            {canGenerateAiDraft ? (
              <button
                type="button"
                onClick={handleGenerateAiDraft}
                disabled={draftingAi}
                className="btn-dsq-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-xs sm:text-sm w-full cursor-pointer disabled:opacity-70 disabled:cursor-wait"
              >
                {draftingAi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Drafting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {draftGeneratedOnce
                        ? "Regenerate with AI"
                        : "Generate with AI"}
                    </span>
                  </>
                )}
              </button>
            ) : (
              <p className="text-[11px] text-[#989898] text-center">
                Only verified session participants can regenerate AI drafts.
              </p>
            )}

            {draftError && (
              <p className="text-xs text-[#EF4444]" role="alert">
                {draftError}
              </p>
            )}
          </section>

          {/* Sharing */}
          <section className="dsq-card p-6 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B4B8C8]">
              SHARING
            </p>

            <CopyButton
              text={shareUrl}
              label="Copy shared result link"
              copiedLabel="Shared link copied!"
              variant="tile"
              className="w-full py-3"
            />

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={exportingPdf}
              className="btn-dsq-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-xs sm:text-sm w-full cursor-pointer disabled:opacity-70 disabled:cursor-wait"
            >
              <Download className="w-4 h-4" />
              <span>{exportingPdf ? "Generating PDF..." : "Download PDF"}</span>
            </button>

            {pdfError && (
              <p className="text-xs text-[#EF4444]" role="alert">
                {pdfError}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
