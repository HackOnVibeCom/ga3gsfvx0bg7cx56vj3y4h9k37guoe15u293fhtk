"use client";

import { Activity, AlertTriangle, CheckCircle2, Gauge } from "lucide-react";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import {
  computeClientFeasibility,
  computeDeveloperRisk,
  computeEffectiveHourlyRate,
  type PartyRole,
} from "@/lib/midpoint";

interface LiveDealAsideProps {
  role: PartyRole;
  currency: CurrencyCode;
  budget: number;
  hours: number;
  depositPct: number;
  netDays: number;
  revisions: number;
  platformFeePct: number;
  targetHourlyRate?: number;
  maxBudgetCeiling?: number;
  flags: string[];
}

export function LiveDealAside({
  role,
  currency,
  budget,
  hours,
  depositPct,
  netDays,
  revisions,
  platformFeePct,
  targetHourlyRate,
  maxBudgetCeiling,
  flags,
}: LiveDealAsideProps) {
  if (role === "developer") {
    const econ = computeEffectiveHourlyRate({
      budget,
      hours,
      revisions,
      platformFeePct,
    });
    const risk = computeDeveloperRisk({
      depositPct,
      netDays,
      revisions,
      flags,
    });

    const hasTarget = typeof targetHourlyRate === "number" && targetHourlyRate > 0;
    const diffPct =
      hasTarget && econ.effectiveRate > 0
        ? ((econ.effectiveRate - targetHourlyRate) / targetHourlyRate) * 100
        : 0;

    const riskBadgeClass =
      risk.tier === "HIGH RISK"
        ? "border-[#FF006D]/35 bg-[#FF006D]/15 text-[#FF006D]"
        : risk.tier === "MEDIUM RISK"
          ? "border-[#FFB800]/35 bg-[#FFB800]/15 text-[#FFB800]"
          : "border-[#39D98A]/35 bg-[#39D98A]/15 text-[#39D98A]";

    return (
      <aside className="space-y-4 lg:sticky lg:top-6">
        {/* Live Effective Hourly Rate Card */}
        <div className="dsq-card p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5661FF] flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" />
              LIVE DEVELOPER ECONOMICS
            </span>
            {hasTarget && budget > 0 && hours > 0 && (
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold font-victor ${
                  diffPct >= 0
                    ? "border-[#39D98A]/35 bg-[#39D98A]/15 text-[#39D98A]"
                    : "border-[#FF006D]/35 bg-[#FF006D]/15 text-[#FF006D]"
                }`}
              >
                {diffPct >= 0 ? "+" : ""}
                {diffPct.toFixed(1)}% vs target
              </span>
            )}
          </div>

          <div>
            <p className="text-xs text-[#989898]">
              Projected effective hourly rate (net of fees &amp; buffer)
            </p>
            <div className="mt-1 text-3xl sm:text-4xl font-semibold text-white font-victor">
              {formatMoney(econ.effectiveRate, currency, 2)}
              <span className="text-sm font-normal text-[#989898]">/hr</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/[0.07]">
            <div className="dsq-tile rounded-xl p-3">
              <span className="block text-[10px] uppercase tracking-[0.12em] text-[#989898]">
                Net Payout
              </span>
              <span className="mt-1 block text-sm font-semibold text-white font-victor">
                {formatMoney(Math.round(econ.netBudget), currency)}
              </span>
            </div>
            <div className="dsq-tile rounded-xl p-3">
              <span className="block text-[10px] uppercase tracking-[0.12em] text-[#989898]">
                Adjusted Hours
              </span>
              <span className="mt-1 block text-sm font-semibold text-white font-victor">
                {Math.round(econ.adjustedHours)} hrs
              </span>
            </div>
          </div>
          <p className="text-[11px] text-[#989898] leading-relaxed">
            Includes {platformFeePct}% channel fee, 10% scoping overhead, and{" "}
            {econ.revisionBufferPct}% extra revision buffer.
          </p>
        </div>

        {/* Live Client Risk Meter (Streamlined high-signal view) */}
        <div className="dsq-card p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#989898]">
              LIVE CLIENT RISK
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${riskBadgeClass}`}
            >
              {risk.tier}
            </span>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-semibold text-white font-victor">
              {risk.score}
            </span>
            <span className="text-sm text-[#989898] font-victor">/ 100</span>
          </div>

          {/* 3-segment risk track */}
          <div className="relative h-2.5 rounded-full overflow-hidden flex bg-[#1C202E]">
            <div className="w-1/3 h-full bg-[#39D98A]" />
            <div className="w-1/3 h-full bg-[#FFB800]" />
            <div className="w-1/3 h-full bg-[#FF006D]" />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-1.5 h-4 rounded-full bg-white shadow-[0_0_8px_#fff] transition-all duration-200"
              style={{ left: `calc(${Math.min(97, Math.max(2, risk.score))}% - 3px)` }}
            />
          </div>

          {risk.factors.length === 0 ? (
            <div className="dsq-tile rounded-xl px-3.5 py-2.5 flex items-center gap-2 text-xs font-medium text-[#39D98A]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>No risk flags</span>
            </div>
          ) : (
            <div className="space-y-1.5 pt-0.5">
              {risk.factors.map((f) => {
                const shortTitle =
                  f.label === "Upfront deposit"
                    ? `${depositPct}% deposit`
                    : f.label === "Payment terms"
                      ? `Net ${netDays} terms`
                      : f.label === "Revision cap"
                        ? `${revisions >= 5 ? "5+" : revisions} revisions`
                        : f.label;
                return (
                  <div
                    key={`${f.label}-${f.detail}`}
                    className="dsq-tile rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-medium text-[#F1F1F1] truncate">
                      {shortTitle}
                    </span>
                    <span className="font-victor text-[#FF006D] font-semibold shrink-0">
                      +{f.points}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    );
  }

  // Client Mode Live Cashflow & Feasibility Meter
  const feasibility = computeClientFeasibility({
    budget,
    hours,
    depositPct,
    netDays,
    revisions,
    maxBudgetCeiling,
    flags,
  });

  const tierBadgeClass =
    feasibility.tier === "STRONG FIT"
      ? "border-[#39D98A]/35 bg-[#39D98A]/15 text-[#39D98A]"
      : feasibility.tier === "BALANCED"
        ? "border-[#FFB800]/35 bg-[#FFB800]/15 text-[#FFB800]"
        : "border-[#FF006D]/35 bg-[#FF006D]/15 text-[#FF006D]";

  return (
    <aside className="space-y-4 lg:sticky lg:top-6">
      <div className="dsq-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF006D] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            LIVE CASHFLOW PREVIEW
          </span>
          <span className="text-[11px] font-victor text-[#989898]">
            {formatMoney(feasibility.impliedHourlyRate, currency, 2)}/hr implied
          </span>
        </div>

        <div>
          <p className="text-xs text-[#989898]">Upfront kickoff deposit</p>
          <div className="mt-1 text-3xl sm:text-4xl font-semibold text-white font-victor">
            {formatMoney(feasibility.upfrontOutlay, currency)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/[0.07]">
          <div className="dsq-tile rounded-xl p-3">
            <span className="block text-[10px] uppercase tracking-[0.12em] text-[#989898]">
              Completion Balance
            </span>
            <span className="mt-1 block text-sm font-semibold text-white font-victor">
              {formatMoney(feasibility.completionBalance, currency)}
            </span>
          </div>
          <div className="dsq-tile rounded-xl p-3">
            <span className="block text-[10px] uppercase tracking-[0.12em] text-[#989898]">
              Payment Cycle
            </span>
            <span className="mt-1 block text-sm font-semibold text-white font-victor">
              Net {netDays} days
            </span>
          </div>
        </div>
      </div>

      <div className="dsq-card p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#989898]">
            DEAL FEASIBILITY SCORE
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${tierBadgeClass}`}
          >
            {feasibility.tier}
          </span>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-semibold text-white font-victor">
            {feasibility.score}
          </span>
          <span className="text-sm text-[#989898] font-victor">/ 100</span>
        </div>

        <div className="relative h-2.5 rounded-full overflow-hidden flex bg-[#1C202E]">
          <div className="w-1/3 h-full bg-[#FF006D]" />
          <div className="w-1/3 h-full bg-[#FFB800]" />
          <div className="w-1/3 h-full bg-[#39D98A]" />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-4 rounded-full bg-white shadow-[0_0_8px_#fff] transition-all duration-200"
            style={{
              left: `calc(${Math.min(97, Math.max(2, feasibility.score))}% - 3px)`,
            }}
          />
        </div>

        <div className="space-y-1.5 pt-0.5">
          {feasibility.notes.map((n) => (
            <div
              key={`${n.label}-${n.detail}`}
              className="dsq-tile rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs"
            >
              <span className="font-medium text-[#F1F1F1] truncate flex items-center gap-1.5">
                {n.impact.startsWith("-") ? (
                  <AlertTriangle className="w-3 h-3 text-[#FFB800] shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 text-[#39D98A] shrink-0" />
                )}
                <span className="truncate">{n.label}</span>
              </span>
              <span
                className={`font-victor font-semibold shrink-0 ${
                  n.impact.startsWith("-") ? "text-[#FFB800]" : "text-[#39D98A]"
                }`}
              >
                {n.impact}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
