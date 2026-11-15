"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Clock, HelpCircle, Info, X } from "lucide-react";

type TierId = "core" | "pro" | "unlimited";

interface PricingTier {
  id: TierId;
  ribbon: string;
  name: string;
  tooltip: string;
  subtitle: string;
  oldPrice?: string;
  price: string;
  period: string;
  ctaLabel: string;
  featured?: boolean;
}

const TIERS: PricingTier[] = [
  {
    id: "core",
    ribbon: "Current · Free Forever",
    name: "Core",
    tooltip:
      "Always free for individual freelancers and clients. Powered by our Zero-CAC counterparty invite loop.",
    subtitle: "Unlimited blind 2-party deals & PDF SOWs.",
    price: "$0",
    period: "per month",
    ctaLabel: "Start free mediation",
  },
  {
    id: "pro",
    ribbon: "Early Access · 34% off launch price",
    name: "Pro",
    tooltip:
      "Built for full-time freelancers, consultants, and boutique agencies closing 5+ deals per month.",
    subtitle: "Multi-round re-mediation & custom branding.",
    oldPrice: "$29",
    price: "$19",
    period: "per month",
    ctaLabel: "Request early access",
    featured: true,
  },
  {
    id: "unlimited",
    ribbon: "B2B Beta · 33% off annual commitment",
    name: "Unlimited & API",
    tooltip:
      "For freelance marketplaces, dev shops, and enterprise procurement teams embedding blind settlement.",
    subtitle: "Unlimited seats, white-label widget & REST API.",
    oldPrice: "$149",
    price: "$99",
    period: "per month",
    ctaLabel: "Request API access",
  },
];

interface OverviewRow {
  feature: string;
  tooltip: string;
  core: boolean | string;
  pro: boolean | string;
  unlimited: boolean | string;
}

const OVERVIEW_ROWS: OverviewRow[] = [
  {
    feature: "5-parameter blind mediation",
    tooltip:
      "Simultaneous double-blind mediation across budget, private limits, scope hours, deposit %, Net days, and revisions.",
    core: true,
    pro: true,
    unlimited: true,
  },
  {
    feature: "Active mediation sessions",
    tooltip: "Number of concurrent counterparty share links you can generate.",
    core: "Unlimited",
    pro: "Unlimited",
    unlimited: "Unlimited",
  },
  {
    feature: "Multi-currency support (32 currencies)",
    tooltip:
      "Mediate in USD, EUR, GBP, IDR, SGD, AUD, JPY, CAD, and 24 other global currencies.",
    core: true,
    pro: true,
    unlimited: true,
  },
  {
    feature: "AI SOW draft & 4-state risk playbook",
    tooltip:
      "Automated Statement of Work generation and payment risk guardrail recommendations.",
    core: true,
    pro: true,
    unlimited: true,
  },
  {
    feature: "Blind re-mediation rounds (No-Overlap)",
    tooltip:
      "Allow both parties to adjust private walk-away limits blindly in Round 2/3 when Round 1 has no overlap.",
    core: "Round 1 only",
    pro: "Up to 3 rounds",
    unlimited: "Unlimited",
  },
  {
    feature: "Custom-branded PDF SOW (No watermark)",
    tooltip:
      "Replace the MidPoint footer watermark with your studio or agency logo on exported PDF agreements.",
    core: false,
    pro: true,
    unlimited: true,
  },
  {
    feature: "Reusable clause & rate card templates",
    tooltip:
      "Save preset hourly floors, late-payment penalties, and IP transfer clauses across deals.",
    core: false,
    pro: true,
    unlimited: true,
  },
  {
    feature: "Workspace seats & deal analytics",
    tooltip:
      "Team seats with win-rate tracking, average spread compression, and effective hourly rate history.",
    core: "1 seat",
    pro: "10 seats",
    unlimited: "Unlimited",
  },
  {
    feature: "Embeddable widget & REST API",
    tooltip:
      "Embed a 'Settle with MidPoint' button directly inside your marketplace or client portal via API & webhooks.",
    core: false,
    pro: false,
    unlimited: true,
  },
  {
    feature: "Optional milestone escrow fee",
    tooltip:
      "Flat settlement take-rate only when both parties choose to fund milestone escrow directly from a settled verdict.",
    core: "1.5%",
    pro: "1.0%",
    unlimited: "0.5% custom",
  },
];

function renderCellValue(val: boolean | string) {
  if (val === true) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-[#39D98A]/55 bg-[#39D98A]/12 text-[#39D98A]"
        aria-label="Included"
      >
        <Check className="w-3 h-3 stroke-[2.5]" />
      </span>
    );
  }
  if (val === false) {
    return (
      <span className="text-[#989898] font-victor text-sm select-none" aria-label="Not included">
        —
      </span>
    );
  }
  return (
    <span className="text-xs sm:text-sm font-medium text-[#D5D9E6]">{val}</span>
  );
}

const COMING_SOON_HIGHLIGHTS: Record<Exclude<TierId, "core">, string[]> = {
  pro: [
    "Up to 3 blind re-mediation rounds on No-Overlap deals",
    "Custom-branded PDF SOW agreements without watermark",
    "Reusable clause & rate templates across up to 10 workspace seats",
  ],
  unlimited: [
    "Unlimited blind re-mediation rounds & unlimited team seats",
    "Embeddable 'Settle with MidPoint' marketplace widget & REST API",
    "Custom 0.5% flat settlement escrow integration",
  ],
};

export function PricingView() {
  const [comingSoonTier, setComingSoonTier] = useState<PricingTier | null>(
    null
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-16 space-y-14">
      {/* HERO HEADER WITH SUBTLE DOT MATRIX TEXTURE */}
      <section className="relative text-center max-w-3xl mx-auto space-y-4 py-4">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-12 -inset-y-6 opacity-25 rounded-3xl"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255, 255, 255, 0.16) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
            maskImage:
              "radial-gradient(ellipse at center, black 35%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 35%, transparent 75%)",
          }}
        />

        <h1 className="relative text-3xl sm:text-5xl lg:text-[54px] font-extrabold tracking-[-0.03em] leading-[1.08] text-[#F1F1F1] text-balance">
          Mediate, settle, and scale at{" "}
          <em className="hero-gradient-text">any stage of growth</em>
        </h1>

        <p className="relative text-sm sm:text-base text-[#B4B8C8] max-w-xl mx-auto leading-relaxed">
          We believe fair, zero-anchoring deal mediation should be accessible to
          every independent developer and client—no matter the size of your
          project.
        </p>
      </section>

      {/* 4-COLUMN TOP GRID (Column 1 intentionally open above OVERVIEW labels, keeping Core / Pro / Unlimited aligned above Columns 2, 3, 4) */}
      <section aria-label="Pricing Plans" className="space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-stretch">
          <div className="hidden lg:block" aria-hidden="true" />

          {/* COLUMNS 2, 3, 4: Double-Layered Tier Cards (Outer Ribbon Shell + Inner Card) */}
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              data-testid={`pricing-card-${tier.id}`}
              className={`rounded-[24px] p-1.5 flex flex-col transition-all duration-300 ${
                tier.featured
                  ? "border border-[#5661FF]/50 bg-gradient-to-b from-[#171C36]/95 to-[#0E111C]/95 shadow-[0_24px_60px_rgba(86,97,255,0.18)]"
                  : "border border-white/10 bg-[#0D1018]/90 shadow-[0_20px_48px_rgba(0,0,0,0.55)]"
              }`}
            >
              {/* Top Outer Ribbon Label */}
              <div className="py-2 px-3 text-center">
                <span
                  className={`text-[11px] font-semibold tracking-tight ${
                    tier.featured ? "text-[#C4CBFF]" : "text-[#B4B8C8]"
                  }`}
                >
                  {tier.ribbon}
                </span>
              </div>

              {/* Inner Elevated Card */}
              <div
                className={`flex-1 rounded-[19px] p-5 sm:p-6 flex flex-col justify-between space-y-6 ${
                  tier.featured
                    ? "border border-white/14 bg-[#141829]"
                    : "border border-white/[0.08] bg-[#121520]"
                }`}
              >
                {/* Tier Header: Name + Info Tooltip + Subtitle */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-base font-bold tracking-tight text-white">
                      {tier.name}
                    </h3>
                    <span className="relative group/cardtip inline-flex">
                      <button
                        type="button"
                        aria-label={tier.tooltip}
                        className="inline-flex text-[#989898] hover:text-white focus:text-white cursor-help transition-colors focus:outline-none"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                      <span
                        role="tooltip"
                        className="pointer-events-none opacity-0 group-hover/cardtip:opacity-100 group-focus-within/cardtip:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-xl border border-white/15 bg-[#161B2E] px-3 py-2 text-[11px] font-normal leading-relaxed text-[#D5D9E6] shadow-[0_12px_30px_rgba(0,0,0,0.75)] z-30"
                      >
                        {tier.tooltip}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-[#989898] leading-relaxed">
                    {tier.subtitle}
                  </p>
                </div>

                {/* Price Block with Optional Strikethrough Anchor + CTA Button */}
                <div className="space-y-4">
                  <div>
                    {tier.oldPrice ? (
                      <span className="block text-xs font-victor line-through text-[#989898] mb-0.5">
                        {tier.oldPrice}
                      </span>
                    ) : (
                      <span className="block text-xs font-victor text-transparent select-none mb-0.5">
                        $0
                      </span>
                    )}
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                        {tier.price}
                      </span>
                      <span className="text-xs text-[#989898]">
                        {tier.period}
                      </span>
                    </div>
                  </div>

                  {tier.id === "core" ? (
                    <Link
                      href="/#mediate"
                      className="w-full h-10 rounded-full border border-white/15 bg-white/[0.05] hover:bg-white/[0.10] text-white text-xs sm:text-sm font-bold flex items-center justify-center transition-all whitespace-nowrap"
                    >
                      {tier.ctaLabel}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setComingSoonTier(tier)}
                      data-testid={`cta-${tier.id}`}
                      className="btn-dsq-primary w-full h-10 rounded-full px-3 text-xs sm:text-sm font-bold flex items-center justify-center transition-all cursor-pointer whitespace-nowrap"
                    >
                      <span>{tier.ctaLabel}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 4-COLUMN OVERVIEW COMPARISON TABLE */}
        <div className="pt-2">
          <div className="pb-3 border-b border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#B4B8C8]">
              OVERVIEW
            </span>
          </div>

          <div className="divide-y divide-white/[0.07]">
            {OVERVIEW_ROWS.map((row) => (
              <div
                key={row.feature}
                className="py-4 grid grid-cols-1 lg:grid-cols-4 gap-3 lg:gap-5 items-center hover:bg-white/[0.015] transition-colors px-1 rounded-lg"
              >
                {/* Column 1: Feature Label + Uniformly Aligned Tooltip Column */}
                <div className="flex items-center justify-between gap-3 lg:pr-4 text-xs sm:text-sm font-semibold text-white">
                  <span className="leading-snug">{row.feature}</span>
                  <span className="relative group/tip inline-flex shrink-0">
                    <button
                      type="button"
                      aria-label={row.tooltip}
                      data-testid="overview-tooltip-icon"
                      className="inline-flex items-center justify-center text-[#989898] hover:text-white focus:text-white cursor-help transition-colors focus:outline-none"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                    <span
                      role="tooltip"
                      className="pointer-events-none opacity-0 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 transition-opacity duration-150 absolute bottom-full right-0 mb-2 w-64 rounded-xl border border-white/15 bg-[#161B2E] px-3 py-2 text-[11px] font-normal leading-relaxed text-[#D5D9E6] shadow-[0_12px_30px_rgba(0,0,0,0.75)] z-30"
                    >
                      {row.tooltip}
                    </span>
                  </span>
                </div>

                {/* Desktop & Mobile Aligned Columns 2, 3, 4 */}
                <div className="grid grid-cols-3 lg:contents gap-2 pt-1 lg:pt-0">
                  <div className="lg:px-4 flex flex-col lg:block">
                    <span className="lg:hidden text-[10px] font-victor uppercase text-[#989898] mb-1">
                      Core
                    </span>
                    <div>{renderCellValue(row.core)}</div>
                  </div>

                  <div className="lg:px-4 flex flex-col lg:block">
                    <span className="lg:hidden text-[10px] font-victor uppercase text-[#C4CBFF] mb-1">
                      Pro
                    </span>
                    <div>{renderCellValue(row.pro)}</div>
                  </div>

                  <div className="lg:px-4 flex flex-col lg:block">
                    <span className="lg:hidden text-[10px] font-victor uppercase text-[#989898] mb-1">
                      Unlimited
                    </span>
                    <div>{renderCellValue(row.unlimited)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SIMPLE COMING SOON POPUP */}
      {comingSoonTier && comingSoonTier.id !== "core" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="coming-soon-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/75 backdrop-blur-sm"
        >
          <div
            data-testid="coming-soon-modal"
            className="relative w-full max-w-md rounded-[24px] border border-white/15 bg-[#111420] p-6 sm:p-7 shadow-[0_28px_70px_rgba(0,0,0,0.85)] space-y-5"
          >
            <button
              type="button"
              onClick={() => setComingSoonTier(null)}
              aria-label="Close modal"
              className="absolute top-5 right-5 w-8 h-8 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.10] flex items-center justify-center text-[#B4B8C8] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-2.5 pr-6">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5661FF]/45 bg-[#161B3A] px-3 py-1 text-[10px] font-victor font-semibold uppercase tracking-wider text-[#C4CBFF]">
                <Clock className="w-3 h-3" />
                Coming Soon
              </span>
              <h2
                id="coming-soon-modal-title"
                className="text-xl font-bold tracking-tight text-white"
              >
                {comingSoonTier.name} ({comingSoonTier.price}/mo) is coming soon
              </h2>
              <p className="text-xs text-[#B4B8C8] leading-relaxed">
                Paid workspace subscriptions and billing are currently in final
                development. Right now,{" "}
                <span className="text-white font-semibold">
                  100% of core two-party blind mediation
                </span>{" "}
                is live and free on the Core plan with zero signup required.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#141826] p-4 space-y-2.5">
              <span className="block text-[10px] font-victor uppercase tracking-wider text-[#989898]">
                Included in {comingSoonTier.name}
              </span>
              <ul className="space-y-2">
                {COMING_SOON_HIGHLIGHTS[comingSoonTier.id].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-xs text-[#D5D9E6] leading-snug"
                  >
                    <Check className="w-3.5 h-3.5 text-[#39D98A] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setComingSoonTier(null)}
                className="h-9 px-4 rounded-full border border-white/15 bg-white/[0.05] hover:bg-white/[0.10] text-xs font-semibold text-[#D5D9E6] hover:text-white transition-all cursor-pointer"
              >
                Close
              </button>
              <Link
                href="/#mediate"
                className="btn-dsq-primary h-9 px-5 rounded-full text-xs font-bold inline-flex items-center justify-center"
              >
                Try Core free now
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
