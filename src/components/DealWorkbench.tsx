"use client";

import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Check,
  ChevronDown,
  Code2,
  Loader2,
  Lock,
  Rocket,
} from "lucide-react";
import { CURRENCY_LIST, type CurrencyCode } from "@/lib/currency";
import type { DealPosition, PartyRole } from "@/lib/midpoint";
import {
  CLIENT_PRIORITIES,
  DEVELOPER_RED_FLAGS,
  FREELANCE_PRESETS,
  PLATFORM_FEE_PRESETS,
  type FreelancePreset,
} from "@/lib/presets";
import { LiveDealAside } from "./LiveDealAside";

export interface WorkbenchSubmitPayload {
  projectTitle: string;
  currency: CurrencyCode;
  role: PartyRole;
  position: DealPosition;
}

interface DealWorkbenchProps {
  mode: "create" | "respond";
  lockedRole?: PartyRole;
  lockedProjectTitle?: string;
  lockedCurrency?: CurrencyCode;
  initialFeeHint?: number;
  onSubmit: (payload: WorkbenchSubmitPayload) => Promise<void>;
}

const PRESET_ICONS = {
  rocket: Rocket,
  warning: AlertTriangle,
  building: Building2,
} as const;

export function DealWorkbench({
  mode,
  lockedRole = "developer",
  lockedProjectTitle = "",
  lockedCurrency = "USD",
  initialFeeHint = 3,
  onSubmit,
}: DealWorkbenchProps) {
  const [role, setRole] = useState<PartyRole>(lockedRole);
  const [projectTitle, setProjectTitle] = useState(
    lockedProjectTitle || "SaaS MVP Build — Auth, Billing & Dashboard"
  );
  const [currency, setCurrency] = useState<CurrencyCode>(lockedCurrency);

  const [budgetInput, setBudgetInput] = useState(
    lockedRole === "client" ? "6200" : "8000"
  );
  const [reservationInput, setReservationInput] = useState(
    lockedRole === "client" ? "8500" : "6500"
  );
  const [hoursInput, setHoursInput] = useState(
    lockedRole === "client" ? "100" : "120"
  );
  const [depositPct, setDepositPct] = useState(
    lockedRole === "client" ? 25 : 50
  );
  const [netDays, setNetDays] = useState(lockedRole === "client" ? 14 : 7);
  const [revisions, setRevisions] = useState(lockedRole === "client" ? 3 : 2);
  const [platformFeePct, setPlatformFeePct] = useState(
    mode === "respond" ? initialFeeHint : 3
  );
  const [targetRateInput, setTargetRateInput] = useState("60");
  const [flags, setFlags] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeRole = mode === "respond" ? lockedRole : role;
  const activeCurrency = mode === "respond" ? lockedCurrency : currency;

  function applyPreset(preset: FreelancePreset, forRole: PartyRole) {
    setActivePresetId(preset.id);
    if (mode === "create") {
      setProjectTitle(preset.projectTitle);
      setCurrency(preset.currency);
    }

    const p = forRole === "developer" ? preset.developer : preset.client;
    setBudgetInput(String(p.budget));
    setReservationInput(String(p.reservation));
    setHoursInput(String(p.hours));
    setDepositPct(p.depositPct);
    setNetDays(p.netDays);
    setRevisions(p.revisions);
    setPlatformFeePct(p.platformFeePct);
    if (p.targetHourlyRate !== undefined) {
      setTargetRateInput(String(p.targetHourlyRate));
    }
    setFlags(p.flags);
    setReason(p.reason);
    setError(null);
  }

  function handleRoleSwitch(nextRole: PartyRole) {
    if (mode === "respond" || nextRole === role) return;
    setRole(nextRole);
    setFlags([]);
    setError(null);

    if (activePresetId) {
      const matched = FREELANCE_PRESETS.find((p) => p.id === activePresetId);
      if (matched) {
        applyPreset(matched, nextRole);
        return;
      }
    }

    if (nextRole === "developer") {
      setBudgetInput("8000");
      setReservationInput("6500");
      setHoursInput("120");
      setDepositPct(50);
      setNetDays(7);
      setRevisions(2);
    } else {
      setBudgetInput("6200");
      setReservationInput("8500");
      setHoursInput("100");
      setDepositPct(25);
      setNetDays(14);
      setRevisions(3);
    }
  }

  function toggleFlag(flag: string) {
    setFlags((prev) =>
      prev.includes(flag) ? prev.filter((item) => item !== flag) : [...prev, flag]
    );
  }

  const parsedBudget = Math.max(0, Math.round(Number(budgetInput) || 0));
  const parsedReservation = Math.max(0, Math.round(Number(reservationInput) || 0));
  const parsedHours = Math.max(0, Math.round(Number(hoursInput) || 0));
  const parsedTargetRate = Math.max(0, Math.round(Number(targetRateInput) || 0));

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "create" && projectTitle.trim().length < 2) {
      setError("Please enter a short project title or scope summary.");
      return;
    }

    if (parsedBudget < 1) {
      setError("Please enter a project budget / quote greater than 0.");
      return;
    }

    if (parsedReservation < 1) {
      setError(
        activeRole === "developer"
          ? "Please enter the minimum amount you'd accept."
          : "Please enter the maximum budget you can pay."
      );
      return;
    }

    if (activeRole === "developer" && parsedReservation > parsedBudget) {
      setError("Minimum you'd accept cannot exceed your project quote.");
      return;
    }

    if (activeRole === "client" && parsedReservation < parsedBudget) {
      setError("Maximum you can pay cannot be lower than your target budget.");
      return;
    }

    if (parsedHours < 1) {
      setError("Please enter estimated scope hours greater than 0.");
      return;
    }

    const trimmedReason = reason.trim();
    if (trimmedReason.length > 1200) {
      setError("Notes must be 1,200 characters or fewer.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        projectTitle: mode === "respond" ? lockedProjectTitle : projectTitle.trim(),
        currency: activeCurrency,
        role: activeRole,
        position: {
          budget: parsedBudget,
          reservation: parsedReservation,
          hours: parsedHours,
          depositPct,
          netDays,
          revisions,
          platformFeePct,
          targetHourlyRate:
            activeRole === "developer" ? parsedTargetRate : undefined,
          maxBudgetCeiling:
            activeRole === "client" ? parsedReservation : undefined,
          flags,
          reason: trimmedReason,
        },
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit position."
      );
      setSubmitting(false);
    }
  }

  const depositOptions = [0, 25, 50, 100];
  const netDayOptions = [0, 7, 14, 30, 60];
  const revisionOptions = [1, 2, 3, 4, 5];
  const flagOptions =
    activeRole === "developer" ? DEVELOPER_RED_FLAGS : CLIENT_PRIORITIES;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 items-start">
      {/* LEFT COLUMN (3fr): Role Buttons + Presets + Structured Deal Form */}
      <form
        onSubmit={handleFormSubmit}
        className="dsq-card p-6 sm:p-8 space-y-6"
      >
        {/* Role Selection Buttons (Only on Create; Locked on Respond) */}
        {mode === "create" ? (
          <div className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5661FF]">
              SELECT WHO YOU ARE
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleRoleSwitch("developer")}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all cursor-pointer ${
                  activeRole === "developer"
                    ? "border-[#5661FF] bg-[#161B3A] shadow-[0_0_24px_rgba(86,97,255,0.22)]"
                    : "border-[#252A3A] bg-[#161923] hover:border-[#3A4158] hover:bg-[#1C202E]"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    activeRole === "developer"
                      ? "bg-[#5661FF] text-white"
                      : "bg-[#222738] text-[#989898]"
                  }`}
                >
                  <Code2 className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-white truncate">
                  Freelance Developer
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSwitch("client")}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all cursor-pointer ${
                  activeRole === "client"
                    ? "border-[#FF006D] bg-[#2B1024] shadow-[0_0_24px_rgba(255,0,109,0.22)]"
                    : "border-[#252A3A] bg-[#161923] hover:border-[#3A4158] hover:bg-[#1C202E]"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    activeRole === "client"
                      ? "bg-[#FF006D] text-white"
                      : "bg-[#222738] text-[#989898]"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-white truncate">
                  Client
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  activeRole === "developer"
                    ? "bg-[#5661FF]/20 text-[#A88FFF] border border-[#5661FF]/40"
                    : "bg-[#FF006D]/20 text-[#FF85B8] border border-[#FF006D]/40"
                }`}
              >
                {activeRole === "developer" ? (
                  <>
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Freelance Developer Side</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Client Side</span>
                  </>
                )}
              </span>
            </div>
            <span className="text-[11px] font-victor text-[#989898]">
              Currency: {activeCurrency}
            </span>
          </div>
        )}

        {/* 3 Preset Scenario Buttons */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#989898]">
            QUICK FILL
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {FREELANCE_PRESETS.map((preset) => {
              const Icon = PRESET_ICONS[preset.icon];
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset, activeRole)}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "border-[#5661FF] bg-[#161B3A] text-white"
                      : "border-[#252A3A] bg-[#161923] text-[#B4B8C8] hover:border-[#3A4158] hover:bg-[#1C202E] hover:text-white"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <Icon className="w-3.5 h-3.5 shrink-0 text-[#A88FFF]" />
                    <span className="truncate">{preset.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shared Project Context (Editable by Party A only) */}
        {mode === "create" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.08]">
            <div className="sm:col-span-2 space-y-1.5">
              <label
                htmlFor="project-title"
                className="block text-xs font-medium text-[#B4B8C8]"
              >
                Project scope title <span className="text-[#FF006D]">*</span>
              </label>
              <input
                id="project-title"
                type="text"
                maxLength={140}
                value={projectTitle}
                onChange={(e) => {
                  setProjectTitle(e.target.value);
                  setActivePresetId(null);
                }}
                placeholder="e.g. Next.js SaaS MVP — Auth & Billing"
                className="dsq-recessed w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#989898]/60 focus:outline-none focus:border-[#5661FF]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="currency-select"
                className="block text-xs font-medium text-[#B4B8C8]"
              >
                Currency <span className="text-[#FF006D]">*</span>
              </label>
              <select
                id="currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="dsq-recessed w-full rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#5661FF]"
              >
                {CURRENCY_LIST.map((c) => (
                  <option
                    key={c.code}
                    value={c.code}
                    className="bg-[#101219] text-white"
                  >
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Primary Financial Offer & Private Limit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/[0.08]">
          <div className="space-y-1.5">
            <label
              htmlFor="deal-budget"
              className="flex items-center justify-between text-xs font-medium text-[#B4B8C8]"
            >
              <span>
                {activeRole === "developer"
                  ? "Your project quote"
                  : "Your target budget"}{" "}
                <span className="text-[#FF006D]">*</span>
              </span>
              <span className="font-victor text-[11px] text-[#989898]">
                {activeCurrency}
              </span>
            </label>
            <input
              id="deal-budget"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={budgetInput}
              onChange={(e) => {
                setBudgetInput(e.target.value);
                setActivePresetId(null);
              }}
              placeholder="e.g. 8000"
              className="dsq-recessed font-victor w-full rounded-xl px-4 py-3 text-xl font-semibold text-white placeholder:text-[#989898]/50 focus:outline-none focus:border-[#5661FF]"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="deal-reservation"
              className="flex items-center justify-between text-xs font-medium text-[#B4B8C8]"
            >
              <span>
                {activeRole === "developer"
                  ? "Minimum you'd accept"
                  : "Maximum you can pay"}{" "}
                <span className="text-[#FF006D]">*</span>
              </span>
              <span className="font-victor text-[11px] text-[#A88FFF]">
                {activeCurrency} · Private
              </span>
            </label>
            <input
              id="deal-reservation"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={reservationInput}
              onChange={(e) => {
                setReservationInput(e.target.value);
                setActivePresetId(null);
              }}
              placeholder={activeRole === "developer" ? "e.g. 6500" : "e.g. 8500"}
              className="dsq-recessed font-victor w-full rounded-xl px-4 py-3 text-xl font-semibold text-white placeholder:text-[#989898]/50 focus:outline-none focus:border-[#5661FF]"
              required
            />
          </div>
        </div>

        {/* Scope Hours & Channel Fee */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div className="space-y-1.5">
            <label
              htmlFor="deal-hours"
              className="flex items-center justify-between text-xs font-medium text-[#B4B8C8]"
            >
              <span>
                {activeRole === "developer"
                  ? "Estimated engineering hours"
                  : "Expected scope hours"}{" "}
                <span className="text-[#FF006D]">*</span>
              </span>
              <span className="font-victor text-[11px] text-[#989898]">hrs</span>
            </label>
            <input
              id="deal-hours"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={hoursInput}
              onChange={(e) => {
                setHoursInput(e.target.value);
                setActivePresetId(null);
              }}
              placeholder="e.g. 120"
              className="dsq-recessed font-victor w-full rounded-xl px-4 py-2.5 text-base font-semibold text-white placeholder:text-[#989898]/50 focus:outline-none focus:border-[#5661FF]"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-[#B4B8C8]">
              <span>Platform / escrow fee %</span>
              <span className="font-victor text-white font-semibold">
                {platformFeePct}%
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {PLATFORM_FEE_PRESETS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setPlatformFeePct(item.value)}
                  className={`rounded-lg border py-2.5 px-1 text-[11px] font-medium transition-all cursor-pointer ${
                    platformFeePct === item.value
                      ? "border-[#5661FF] bg-[#161B3A] text-white"
                      : "border-[#252A3A] bg-[#161923] text-[#989898] hover:border-[#3A4158] hover:text-white"
                  }`}
                >
                  {item.label}{" "}
                  <span className="font-victor opacity-80">{item.value}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Commercial Terms: Deposit % & Payment Terms (Net Days) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-[#B4B8C8]">
              <span>
                {activeRole === "developer"
                  ? "Upfront deposit %"
                  : "Preferred upfront deposit %"}
              </span>
              <span className="font-victor text-white font-semibold">
                {depositPct}%
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {depositOptions.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDepositPct(val)}
                  className={`font-victor rounded-lg border py-2 text-xs font-semibold transition-all cursor-pointer ${
                    depositPct === val
                      ? "border-[#5661FF] bg-[#161B3A] text-white"
                      : "border-[#252A3A] bg-[#161923] text-[#989898] hover:border-[#3A4158] hover:text-white"
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-[#B4B8C8]">
              <span>
                {activeRole === "developer"
                  ? "Payout window (Net days)"
                  : "Invoice cycle (Net days)"}
              </span>
              <span className="font-victor text-white font-semibold">
                Net {netDays}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {netDayOptions.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setNetDays(val)}
                  className={`font-victor rounded-lg border py-2 text-xs font-semibold transition-all cursor-pointer ${
                    netDays === val
                      ? "border-[#5661FF] bg-[#161B3A] text-white"
                      : "border-[#252A3A] bg-[#161923] text-[#989898] hover:border-[#3A4158] hover:text-white"
                  }`}
                >
                  Net {val}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Revision Cap */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-[#B4B8C8]">
            <span>
              {activeRole === "developer"
                ? "Included revision rounds"
                : "Expected revision rounds"}
            </span>
            <span className="font-victor text-white font-semibold">
              {revisions} {revisions === 1 ? "round" : "rounds"}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {revisionOptions.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setRevisions(val)}
                className={`font-victor rounded-lg border py-2 text-xs font-semibold transition-all cursor-pointer ${
                  revisions === val
                    ? "border-[#5661FF] bg-[#161B3A] text-white"
                    : "border-[#252A3A] bg-[#161923] text-[#989898] hover:border-[#3A4158] hover:text-white"
                }`}
              >
                {val === 5 ? "5+" : val}
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible Optional Parameters: Risk Flags, Target Hourly Rate & Scope Notes */}
        <div className="pt-3 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={() => setAdvancedOpen((prev) => !prev)}
            aria-expanded={advancedOpen}
            className="w-full flex items-center justify-between gap-2 text-xs font-semibold text-[#B4B8C8] hover:text-white transition-colors cursor-pointer text-left py-1"
          >
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>
                {activeRole === "developer"
                  ? "Optional: Risk flags, target hourly rate & scope notes"
                  : "Optional: Delivery priorities & budget notes"}
              </span>
              {(flags.length > 0 || reason.trim().length > 0) && (
                <span className="rounded-full border border-[#5661FF]/45 bg-[#161B3A] px-2 py-0.5 text-[10px] font-victor text-[#C4CBFF]">
                  {flags.length > 0
                    ? `${flags.length} ${flags.length === 1 ? "flag" : "flags"}`
                    : "Notes added"}
                </span>
              )}
            </span>
            <ChevronDown
              className={`w-4 h-4 shrink-0 text-[#989898] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                advancedOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          <div
            aria-hidden={!advancedOpen}
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              advancedOpen
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0 pointer-events-none"
            }`}
          >
            <div className="overflow-hidden">
              <div className="pt-4 space-y-4">
                {activeRole === "developer" && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="role-benchmark"
                      className="block text-xs font-medium text-[#B4B8C8]"
                    >
                      Target hourly rate (private benchmark)
                    </label>
                    <input
                      id="role-benchmark"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={targetRateInput}
                      onChange={(e) => setTargetRateInput(e.target.value)}
                      className="dsq-recessed font-victor w-full sm:max-w-xs rounded-xl px-3.5 py-2 text-sm font-semibold text-white focus:outline-none focus:border-[#5661FF]"
                    />
                  </div>
                )}

                {/* Toggle Flags */}
                <div className="space-y-2">
                  <span className="block text-xs font-medium text-[#B4B8C8]">
                    {activeRole === "developer"
                      ? "Client risk flags (updates Live Risk Meter)"
                      : "Delivery priorities (updates Feasibility Score)"}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {flagOptions.map((flag) => {
                      const active = flags.includes(flag);
                      return (
                        <button
                          key={flag}
                          type="button"
                          onClick={() => toggleFlag(flag)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                            active
                              ? activeRole === "developer"
                                ? "border-[#FF006D] bg-[#2B1024] text-[#FF85B8]"
                                : "border-[#5661FF] bg-[#161B3A] text-[#A88FFF]"
                              : "border-[#252A3A] bg-[#161923] text-[#989898] hover:border-[#3A4158] hover:text-white"
                          }`}
                        >
                          {active && <Check className="w-3 h-3" />}
                          <span>{flag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Scope & Pricing Notes (Optional) */}
                <div className="space-y-2">
                  <label
                    htmlFor="deal-reason"
                    className="flex items-center justify-between text-xs font-medium text-[#B4B8C8]"
                  >
                    <span>
                      {activeRole === "developer"
                        ? "Technical scope notes (optional)"
                        : "Budget & timeline context (optional)"}
                    </span>
                    <span className="font-victor text-[11px] text-[#989898]">
                      {reason.length}/1200
                    </span>
                  </label>
                  <textarea
                    id="deal-reason"
                    rows={3}
                    maxLength={1200}
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setActivePresetId(null);
                    }}
                    placeholder={
                      activeRole === "developer"
                        ? 'Optional: "Includes Next.js architecture, Auth, Stripe webhooks, QA, and deployment."'
                        : 'Optional: "Seed sprint budget ahead of beta launch."'
                    }
                    className="dsq-recessed w-full rounded-xl px-4 py-3 text-sm text-[#F1F1F1] placeholder:text-[#989898]/60 leading-relaxed focus:outline-none focus:border-[#5661FF] resize-y"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-[#FF006D]/45 bg-[#FF006D]/12 px-4 py-3 text-xs font-medium text-pink-200"
          >
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-white/[0.08]">
          <div className="flex items-start gap-2 text-xs text-[#989898] max-w-sm">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#A88FFF]" />
            <span>
              {mode === "create"
                ? "Your quote and private limit stay hidden from the other side."
                : "Private limits stay permanently hidden, even after reveal."}
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-dsq-primary inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm cursor-pointer shrink-0"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {mode === "create"
                    ? "Locking terms..."
                    : "Mediating deal..."}
                </span>
              </>
            ) : (
              <>
                <span>
                  {mode === "create"
                    ? "Lock Deal Terms & Create Link"
                    : "Submit & Reveal Fair Deal"}
                </span>
                <ArrowUpRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* RIGHT COLUMN (2fr): Live Economics / Risk / Cashflow Meter */}
      <LiveDealAside
        role={activeRole}
        currency={activeCurrency}
        budget={parsedBudget}
        hours={parsedHours}
        depositPct={depositPct}
        netDays={netDays}
        revisions={revisions}
        platformFeePct={platformFeePct}
        targetHourlyRate={parsedTargetRate}
        maxBudgetCeiling={parsedReservation}
        flags={flags}
      />
    </div>
  );
}
