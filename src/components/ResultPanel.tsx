"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronDown, Download } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import {
  buildFallbackMediationCopy,
  isLegacyMediationRationale,
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
  const [notesOpen, setNotesOpen] = useState(false);
  const [mathOpen, setMathOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [storedRole, setStoredRole] = useState<PartyRole | null>(null);

  async function handleDownloadPdf() {
    if (exportingPdf) return;
    setExportingPdf(true);
    setPdfError(null);
    try {
      const { downloadMediationPdf } = await import("@/lib/export-pdf");
      await downloadMediationPdf(data, shareUrl);
    } catch {
      setPdfError("Failed to generate PDF. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      if (data.viewerRole) {
        window.localStorage.setItem(`midpoint_role_${data.id}`, data.viewerRole);
      } else {
        const saved = window.localStorage.getItem(`midpoint_role_${data.id}`);
        if (saved === "developer" || saved === "client") {
          setStoredRole(saved);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [data.id, data.viewerRole]);

  const { developer, client, summary, currency, projectTitle, viewerRole } = data;
  const activeViewerRole: PartyRole | null = viewerRole ?? storedRole;
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
  const verdictText = cleanCopy ? cleanCopy.rationale : data.rationale;
  const sowDraftText = cleanCopy ? cleanCopy.draftMessage : data.draftMessage;

  const theme = CONFIDENCE_THEME[summary.budget.confidence];
  const gapPctFormatted = `${(summary.budget.gapPct * 100).toFixed(
    summary.budget.gapPct === 0 ? 0 : 1
  )}%`;
  const shareUrl = origin ? `${origin}/r/${data.id}` : `/r/${data.id}`;

  const fmtRounds = (n: number) => `${n} ${n === 1 ? "round" : "rounds"}`;
  const fmtDays = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
  const fmtHours = (n: number) => `${n} ${n === 1 ? "hr" : "hrs"}`;

  const summaryClipboard = `MidPoint Deal Verdict — ${projectTitle}
Mediated Budget: ${formatMoney(summary.budget.midpoint, currency)} (${theme.label})
Scope Effort: ${fmtHours(summary.hours.midpoint)} (${formatMoney(summary.mediatedEconomics.effectiveRate, currency, 2)}/hr effective net)
Upfront Deposit: ${summary.depositPct.midpoint}% (${formatMoney(summary.depositAmount, currency)})
Payment Terms: Net ${fmtDays(summary.netDays.midpoint)}
Revision Cap: ${fmtRounds(summary.revisions.midpoint)}

${verdictText}`;

  const rows = [
    {
      label: "Project Budget",
      dev: formatMoney(developer.budget, currency),
      client: formatMoney(client.budget, currency),
      spread: gapPctFormatted,
      midpoint: formatMoney(summary.budget.midpoint, currency),
      highlight: true,
    },
    {
      label: "Estimated Scope",
      dev: fmtHours(developer.hours),
      client: fmtHours(client.hours),
      spread: fmtHours(Math.abs(developer.hours - client.hours)),
      midpoint: fmtHours(summary.hours.midpoint),
      highlight: false,
    },
    {
      label: "Effective Rate (Net)",
      dev: `${formatMoney(summary.developerEconomics.effectiveRate, currency, 2)}/hr`,
      client: `${formatMoney(summary.clientEconomics.effectiveRate, currency, 2)}/hr`,
      spread: `${summary.platformFeePct}% fee`,
      midpoint: `${formatMoney(summary.mediatedEconomics.effectiveRate, currency, 2)}/hr`,
      highlight: true,
    },
    {
      label: "Upfront Deposit",
      dev: `${developer.depositPct}%`,
      client: `${client.depositPct}%`,
      spread: `${Math.abs(developer.depositPct - client.depositPct)} pts`,
      midpoint: `${summary.depositPct.midpoint}% (${formatMoney(
        summary.depositAmount,
        currency
      )})`,
      highlight: false,
    },
    {
      label: "Payment Terms",
      dev: `Net ${developer.netDays}`,
      client: `Net ${client.netDays}`,
      spread: fmtDays(Math.abs(developer.netDays - client.netDays)),
      midpoint: `Net ${fmtDays(summary.netDays.midpoint)}`,
      highlight: false,
    },
    {
      label: "Revision Cap",
      dev: fmtRounds(developer.revisions),
      client: fmtRounds(client.revisions),
      spread: fmtRounds(Math.abs(developer.revisions - client.revisions)),
      midpoint: fmtRounds(summary.revisions.midpoint),
      highlight: false,
    },
  ];

  const guardrails = [
    `Lock ${summary.depositPct.midpoint}% upfront deposit (${formatMoney(
      summary.depositAmount,
      currency
    )}) prior to kickoff.`,
    `Cap scope at ${summary.hours.midpoint} engineering ${summary.hours.midpoint === 1 ? "hour" : "hours"} and ${summary.revisions.midpoint} revision ${summary.revisions.midpoint === 1 ? "round" : "rounds"}.`,
    `Settle remaining balance on Net ${summary.netDays.midpoint} day invoice terms.`,
    `Sign a Scope of Work (SOW) referencing the ${formatMoney(
      summary.budget.midpoint,
      currency
    )} mediated price.`,
  ];

  const isExactBudgetMatch = developer.budget === client.budget;
  const lowSide = developer.budget <= client.budget ? "DEVELOPER" : "CLIENT";
  const highSide = developer.budget <= client.budget ? "CLIENT" : "DEVELOPER";
  const lowVal = Math.min(developer.budget, client.budget);
  const highVal = Math.max(developer.budget, client.budget);

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <p className="text-xs text-[#B4B8C8]">
                    Fair Mediated Budget
                  </p>
                  <div className="text-4xl sm:text-5xl font-semibold tracking-tight text-white font-victor mt-1">
                    {formatMoney(summary.budget.midpoint, currency)}
                  </div>
                </div>

                <div className="sm:text-right">
                  <p className="text-xs text-[#989898]">
                    Mediated Effective Rate (Net)
                  </p>
                  <div className="text-2xl sm:text-3xl font-semibold text-[#F1F1F1] font-victor mt-0.5">
                    {formatMoney(summary.mediatedEconomics.effectiveRate, currency, 2)}
                    <span className="text-sm font-normal text-[#989898]">
                      /hr
                    </span>
                  </div>
                </div>
              </div>

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
                          row.highlight ? "text-[#39D98A]" : "text-white"
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
                  <p className="text-xs text-[#F1F1F1]/85 leading-relaxed break-words whitespace-pre-wrap">
                    “{developer.reason}”
                  </p>
                </div>
                <div className="dsq-tile rounded-xl p-4 space-y-1.5">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#B4B8C8]">
                    Client Budget Context
                  </span>
                  <p className="text-xs text-[#F1F1F1]/85 leading-relaxed break-words whitespace-pre-wrap">
                    “{client.reason}”
                  </p>
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
                  Spread: {formatMoney(highVal - lowVal, currency)}
                </span>
              </div>

              {isExactBudgetMatch ? (
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
                    Exact match at {formatMoney(summary.budget.midpoint, currency)}
                  </p>
                </div>
              ) : (
                <div className="pt-6 pb-8 relative">
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 text-center">
                    <span
                      className="block text-[10px] font-bold uppercase tracking-[0.12em]"
                      style={{ color: theme.accentColor }}
                    >
                      FAIR MIDPOINT
                    </span>
                    <span className="block text-xs font-bold text-white font-victor whitespace-nowrap">
                      {formatMoney(summary.budget.midpoint, currency)}
                    </span>
                  </div>

                  <div className="relative h-1.5 rounded-full bg-white/10 mt-3">
                    <div
                      className="absolute top-0 bottom-0 left-[12%] right-[12%] rounded-full opacity-55"
                      style={{ backgroundColor: theme.accentColor }}
                    />
                    <div className="absolute left-[12%] top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#07090D] border-2 border-[#B4B8C8]" />
                    <div
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2"
                      style={{
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
              label="How this mediated deal & effective rate were computed"
              open={mathOpen}
              onToggle={() => setMathOpen((prev) => !prev)}
            >
              <div className="dsq-recessed rounded-xl p-4 space-y-2.5 text-xs text-[#B4B8C8]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Deterministic Budget Midpoint</span>
                  <code className="font-victor text-white">
                    round(({formatMoney(developer.budget, currency)} +{" "}
                    {formatMoney(client.budget, currency)}) / 2) ={" "}
                    {formatMoney(summary.budget.midpoint, currency)}
                  </code>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Net Budget (after {summary.platformFeePct}% fee)</span>
                  <code className="font-victor text-white">
                    {formatMoney(Math.round(summary.mediatedEconomics.netBudget), currency)}
                  </code>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Adjusted Hours (10% overhead + {summary.mediatedEconomics.revisionBufferPct}% rev. buffer)</span>
                  <code className="font-victor text-white">
                    {summary.hours.midpoint} hrs →{" "}
                    {Math.round(summary.mediatedEconomics.adjustedHours)} adj. hrs
                  </code>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                  <span>Mediated Effective Rate</span>
                  <code className="font-victor text-[#39D98A] font-semibold">
                    {formatMoney(summary.mediatedEconomics.effectiveRate, currency, 2)}/hr
                  </code>
                </div>
              </div>
            </DisclosureAccordion>
          </section>
        </div>

        {/* RIGHT COLUMN (2fr): Guardrails + Ready-to-Send SOW Draft + Sharing */}
        <div className="space-y-6 lg:sticky lg:top-6">
          {/* Contract Guardrails (Vetly Require Before You Start) */}
          <section className="dsq-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B4B8C8]">
                REQUIRE BEFORE KICKOFF
              </span>
              <span className="text-[11px] font-victor text-[#989898]">
                Risk {summary.mediatedRisk.score}/100
              </span>
            </div>

            <ul className="space-y-3">
              {guardrails.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#F1F1F1]/90 leading-relaxed">
                  <span className="mt-0.5 w-5 h-5 rounded-full border border-[#FFB800]/45 bg-[#FFB800]/12 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-[#FFB800]" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Ready-to-Send SOW / Agreement Draft */}
          <section className="dsq-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B4B8C8]">
                READY-TO-SEND SOW DRAFT
              </span>
            </div>

            <div className="dsq-recessed rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
                <span className="text-xs font-medium text-[#B4B8C8]">
                  Agreement summary message
                </span>
                <CopyButton
                  text={sowDraftText}
                  label="Copy message"
                  copiedLabel="Copied!"
                />
              </div>

              <p className="text-xs sm:text-sm text-[#F1F1F1] leading-relaxed whitespace-pre-line">
                {sowDraftText}
              </p>
            </div>
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
