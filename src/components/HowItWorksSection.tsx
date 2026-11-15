"use client";

import { useEffect, useRef, useState } from "react";

interface StepConfig {
  id: string;
  number: string;
  title: string;
  description: string;
  pillText: string;
  pillClass: string;
  cardTitle: string;
  imageSrc: string;
  imageAlt: string;
  accentHex: string;
}

const STEPS: StepConfig[] = [
  {
    id: "lock-terms",
    number: "01",
    title: "Lock Your Blind Terms",
    description:
      "Enter your project quote, private walk-away limit, scope hours, deposit, and Net payment cycle. Your private limit stays hidden.",
    pillText: "Lock Blind Terms",
    pillClass:
      "bg-[#5661FF] text-white border-[#7882FF]/50 shadow-[0_10px_28px_rgba(86,97,255,0.45)]",
    cardTitle: "Blind Parameters",
    imageSrc: "/images/how-it-works/tahap-1.png",
    imageAlt:
      "Freelance developer working on a laptop in a dark studio, locking blind project terms",
    accentHex: "#5661FF",
  },
  {
    id: "share-link",
    number: "02",
    title: "Share the Counterparty Link",
    description:
      "Send your unique session link over Slack, WhatsApp, or email. The other party submits their own terms blindly with zero price anchoring.",
    pillText: "Respond Blindly",
    pillClass:
      "bg-[#8B5CF6] text-white border-[#A88FFF]/50 shadow-[0_10px_28px_rgba(139,92,246,0.45)]",
    cardTitle: "Blind Counterparty Sync",
    imageSrc: "/images/how-it-works/tahap-2.png",
    imageAlt:
      "Client reviewing the counterparty session link on mobile and laptop in a dark office",
    accentHex: "#A88FFF",
  },
  {
    id: "instant-verdict",
    number: "03",
    title: "Reveal Fair Verdict & SOW",
    description:
      "MidPoint verifies private overlap, computes the risk-adjusted midpoint, and drafts a ready-to-send SOW agreement and PDF report.",
    pillText: "Settled in the Middle",
    pillClass:
      "bg-[#39D98A] text-[#07090D] border-[#6EE7B7]/60 shadow-[0_10px_28px_rgba(57,217,138,0.4)]",
    cardTitle: "Mediated Verdict & SOW",
    imageSrc: "/images/how-it-works/tahap-3.png",
    imageAlt:
      "Developer leaning back with quiet confidence after reaching an aligned midpoint deal",
    accentHex: "#39D98A",
  },
];

/**
 * Bespoke non-generic SVG icons crafted specifically for MidPoint's 3 stages
 */
function StepCustomIcon({ index, active }: { index: number; active: boolean }) {
  const strokeColor = active ? "#FFFFFF" : "#B4B8C8";
  const accentColor = active ? "#C4CBFF" : "#5661FF";

  if (index === 0) {
    // 1. Sealed Cipher Split-Dial Icon (Blind Parameter Vault)
    return (
      <svg
        viewBox="0 0 28 28"
        fill="none"
        className="w-6 h-6"
        aria-hidden="true"
      >
        <rect
          x="3.5"
          y="5"
          width="21"
          height="18"
          rx="4.5"
          stroke={strokeColor}
          strokeWidth="1.75"
        />
        <path
          d="M8.5 11H19.5"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <circle
          cx="15.5"
          cy="11"
          r="2.4"
          fill="#07090D"
          stroke={accentColor}
          strokeWidth="1.75"
        />
        <circle cx="9.5" cy="17.2" r="1.35" fill={accentColor} />
        <circle cx="14" cy="17.2" r="1.35" fill={accentColor} />
        <circle cx="18.5" cy="17.2" r="1.35" fill={strokeColor} />
      </svg>
    );
  }

  if (index === 1) {
    // 2. Isometric Cube inside Corner Framing Brackets (Blind Two-Party Relay)
    return (
      <svg
        viewBox="0 0 28 28"
        fill="none"
        className="w-6 h-6"
        aria-hidden="true"
      >
        {/* Corner brackets */}
        <path
          d="M4.5 9V6.5C4.5 5.39543 5.39543 4.5 6.5 4.5H9M19 4.5H21.5C22.6046 4.5 23.5 5.39543 23.5 6.5V9M23.5 19V21.5C23.5 22.6046 22.6046 23.5 21.5 23.5H19M9 23.5H6.5C5.39543 23.5 4.5 22.6046 4.5 21.5V19"
          stroke={accentColor}
          strokeWidth="1.65"
          strokeLinecap="round"
        />
        {/* Isometric 3D Cube */}
        <path
          d="M14 8.2L19.4 11.3V17.5L14 20.6L8.6 17.5V11.3L14 8.2Z"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M8.8 11.4L14 14.4L19.2 11.4M14 14.4V20.4"
          stroke={strokeColor}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // 3. Equilibrium Midpoint Seal with Shield Check Bubble
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className="w-6 h-6"
      aria-hidden="true"
    >
      <path
        d="M13.2 22.5C8.395 22.5 4.5 18.806 4.5 14.25C4.5 9.694 8.395 6 13.2 6C15.14 6 16.932 6.6 18.38 7.615"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M8.5 18.8L11.2 17.6"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="10.2" cy="14.2" r="1.25" fill={accentColor} />
      <circle cx="13.8" cy="14.2" r="1.25" fill={accentColor} />
      {/* Verified Shield Node */}
      <path
        d="M20.2 10.2L23.8 11.6V15.1C23.8 17.65 22.25 19.85 20.2 20.7C18.15 19.85 16.6 17.65 16.6 15.1V11.6L20.2 10.2Z"
        stroke={strokeColor}
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <path
        d="M18.8 15.2L19.8 16.2L21.8 14.1"
        stroke={accentColor}
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HowItWorksSection() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const programmaticScrollUntilRef = useRef(0);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    function handleScroll() {
      if (Date.now() < programmaticScrollUntilRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;

      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / scrollable));

      if (progress < 0.34) {
        setActiveStep(0);
      } else if (progress < 0.68) {
        setActiveStep(1);
      } else {
        setActiveStep(2);
      }
    }

    function cancelProgrammaticLock() {
      programmaticScrollUntilRef.current = 0;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("wheel", cancelProgrammaticLock, { passive: true });
    window.addEventListener("touchstart", cancelProgrammaticLock, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", cancelProgrammaticLock);
      window.removeEventListener("touchstart", cancelProgrammaticLock);
    };
  }, []);

  function jumpToStep(index: number) {
    programmaticScrollUntilRef.current = Date.now() + 800;
    setActiveStep(index);
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pageTop = window.scrollY + rect.top;
    const scrollable = Math.max(0, rect.height - window.innerHeight);
    if (scrollable <= 0) return;
    const targetProgress = index === 0 ? 0.08 : index === 1 ? 0.5 : 0.88;
    window.scrollTo({
      top: pageTop + scrollable * targetProgress,
      behavior: "smooth",
    });
  }

  const current = STEPS[activeStep] ?? STEPS[0];

  return (
    <section
      ref={containerRef}
      aria-labelledby="how-it-works-heading"
      className="relative w-full lg:h-[265vh]"
    >
      <div className="lg:sticky lg:top-0 lg:min-h-[100dvh] w-full flex flex-col justify-center py-16 lg:py-10">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 space-y-12 lg:space-y-14">
          {/* Section Heading: strictly "How it works" without eyebrow or sub-header */}
          <div className="text-center">
            <h2
              id="how-it-works-heading"
              className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold tracking-[-0.03em] leading-[1.08] text-[#F1F1F1]"
            >
              How it <em className="hero-gradient-text">works</em>
            </h2>
          </div>

          {/* 2-Column Layout: Left Hybrid Illustration + Right 3 Steps */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* LEFT COLUMN: Portrait Photo + Floating Pill & Arrow + Website Skeleton Card */}
            <div className="lg:col-span-6">
              <div className="relative max-w-[490px] mx-auto lg:mx-0 pb-6 sm:pb-8">
                {/* Back-Left Portrait Image Frame (4:5 Ratio) */}
                <div className="relative w-[74%] sm:w-[310px] aspect-[4/5] rounded-[24px] border border-white/12 bg-[#0C0F17] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.75)]">
                  {STEPS.map((step, idx) => {
                    const isVisible = activeStep === idx;
                    return (
                      <img
                        key={step.id}
                        src={step.imageSrc}
                        alt={step.imageAlt}
                        loading="eager"
                        className={`absolute inset-0 h-full w-full object-cover object-top transition-all duration-300 ease-out ${
                          isVisible
                            ? "opacity-100 scale-100"
                            : "opacity-0 scale-[1.03] pointer-events-none"
                        }`}
                      />
                    );
                  })}

                  {/* Subtle dark edge vignette & accent rim integration */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07090D]/80 via-[#07090D]/10 to-transparent"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 transition-opacity duration-500 opacity-35"
                    style={{
                      background: `radial-gradient(circle at 20% 20%, ${current.accentHex}33 0%, transparent 55%)`,
                    }}
                  />
                </div>

                {/* Floating Callout Pill + Curved Arrow (Positioned top-right of the floating skeleton card) */}
                <div className="relative z-20 flex items-end justify-end pr-4 sm:pr-8 -mt-40 sm:-mt-44 mb-2 pointer-events-none">
                  <div className="flex items-end gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-bold tracking-tight transition-all duration-300 ${current.pillClass}`}
                    >
                      {current.pillText}
                    </span>
                    <svg
                      viewBox="0 0 36 32"
                      fill="none"
                      className="w-7 h-7 text-[#B4B8C8] translate-y-2"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 6C18 6 24 12 24 26M24 26L19 20.5M24 26L29 20.5"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* Overlapping Bottom-Right Authentic Website Skeleton UI Card */}
                <div className="relative z-10 w-[86%] sm:w-[350px] ml-auto rounded-[22px] border border-white/14 bg-[#111420]/95 backdrop-blur-xl p-4 sm:p-5 shadow-[0_28px_64px_rgba(0,0,0,0.85)] transition-all duration-500">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full transition-colors duration-300"
                        style={{ backgroundColor: current.accentHex }}
                      />
                      <span className="text-xs font-bold tracking-tight text-white">
                        {current.cardTitle}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
                      <span className="h-1.5 w-5 rounded-full bg-white/20" />
                    </div>
                  </div>

                  {/* Step-specific Miniature Skeleton of Actual MidPoint Website UI */}
                  {activeStep === 0 && (
                    <div className="space-y-2.5" data-testid="skeleton-step-0">
                      {/* 1. Role Switcher Tabs (Freelance Developer active vs Client) */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-[#5661FF]/60 bg-[#161B3A]/85 px-2.5 py-2 flex items-center justify-between">
                          <div className="space-y-1">
                            <span className="block text-[8px] font-bold uppercase tracking-wider text-[#C4CBFF]">
                              Developer
                            </span>
                            <div className="h-1.5 w-12 rounded-full bg-white/30" />
                          </div>
                          <span className="w-2 h-2 rounded-full bg-[#5661FF] shadow-[0_0_8px_#5661FF]" />
                        </div>
                        <div className="rounded-xl border border-white/[0.07] bg-[#141722]/85 px-2.5 py-2 flex items-center justify-between">
                          <div className="space-y-1">
                            <span className="block text-[8px] font-bold uppercase tracking-wider text-[#989898]">
                              Client
                            </span>
                            <div className="h-1.5 w-10 rounded-full bg-white/12" />
                          </div>
                          <span className="w-2 h-2 rounded-full bg-white/15" />
                        </div>
                      </div>

                      {/* 2. Quick-Fill Scenario Pills */}
                      <div className="flex items-center gap-1.5">
                        <span className="h-4 w-14 rounded-full bg-[#5661FF]/20 border border-[#5661FF]/40 flex items-center justify-center text-[7px] font-semibold text-[#C4CBFF]">
                          SaaS MVP
                        </span>
                        <span className="h-4 w-12 rounded-full bg-white/[0.05] border border-white/[0.08]" />
                        <span className="h-4 w-14 rounded-full bg-white/[0.05] border border-white/[0.08]" />
                      </div>

                      {/* 3. Public Quote vs Private Walk-Away Limit Inputs */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-[#222636] bg-[#090B10] p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-[#B4B8C8]">
                              Public Quote
                            </span>
                            <span className="text-[8px] font-victor text-[#989898]">USD</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-victor font-bold text-white">$8,000</span>
                            <div className="h-2 w-8 rounded-full bg-white/15" />
                          </div>
                        </div>

                        <div className="rounded-xl border border-[#5661FF]/35 bg-[#090B10] p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-[#A88FFF]">
                              Private Limit
                            </span>
                            <span className="h-2 w-2 rounded-full bg-[#5661FF]" />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-victor font-bold tracking-widest text-[#C4CBFF]">
                              ••••••
                            </span>
                            <span className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#161B3A] text-[#C4CBFF]">
                              Sealed
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 4. Deposit % & Net Days Selector Row + Primary Submit Button */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="flex items-center gap-1">
                          <span className="px-1.5 py-0.5 rounded text-[7px] font-semibold bg-white/[0.05] text-[#989898]">
                            25%
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[7px] font-bold bg-[#161B3A] border border-[#5661FF]/60 text-[#C4CBFF]">
                            50%
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[7px] font-semibold bg-white/[0.05] text-[#989898]">
                            Net 7
                          </span>
                        </div>
                        <div className="h-6 px-3 rounded-full bg-white text-[#07090D] flex items-center gap-1.5 text-[8px] font-bold shadow-sm">
                          <span>Lock &amp; Share</span>
                          <span>→</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeStep === 1 && (
                    <div className="space-y-2.5" data-testid="skeleton-step-1">
                      {/* 1. Waiting Status Pill + Check Status Button */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#161B3A] border border-[#5661FF]/45">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5661FF] animate-pulse" />
                          <span className="text-[8px] font-bold uppercase tracking-wider text-[#C4CBFF]">
                            Waiting for Client
                          </span>
                        </div>
                        <div className="h-5 px-2 rounded-lg border border-white/10 bg-white/[0.04] flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full border border-white/40" />
                          <div className="h-1.5 w-8 rounded-full bg-white/20" />
                        </div>
                      </div>

                      {/* 2. Title & Subtitle Skeleton Bars */}
                      <div className="space-y-1.5 py-0.5">
                        <div className="h-2.5 w-3/4 rounded-full bg-white/25" />
                        <div className="h-1.5 w-1/2 rounded-full bg-white/12" />
                      </div>

                      {/* 3. Share Invite URL Bar + White Copy Link Capsule */}
                      <div className="rounded-xl border border-[#222636] bg-[#090B10] p-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 pl-1 min-w-0">
                          <span className="text-[9px] font-victor text-[#989898] truncate">
                            midpoint.app/r/
                          </span>
                          <span className="text-[9px] font-victor font-bold text-[#FF73A1]">
                            8f9a••
                          </span>
                        </div>
                        <div className="shrink-0 h-5 px-2.5 rounded-full bg-white text-[#07090D] flex items-center text-[8px] font-bold">
                          Copy link
                        </div>
                      </div>

                      {/* 4. Your Locked Position Summary Chips */}
                      <div className="rounded-xl border border-white/[0.08] bg-[#141722]/90 p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-bold uppercase tracking-wider text-[#989898]">
                            Your Locked Terms
                          </span>
                          <span className="text-[7px] font-victor text-[#A88FFF]">
                            Hidden until both submit
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {["$8,000", "••••", "120h", "Net 7"].map((chip) => (
                            <div
                              key={chip}
                              className="rounded-lg bg-[#090B10] border border-white/[0.06] py-1 px-1.5 text-center text-[8px] font-victor font-semibold text-[#D5D9E6]"
                            >
                              {chip}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeStep === 2 && (
                    <div className="space-y-2.5" data-testid="skeleton-step-2">
                      {/* 1. Miniature Mediated Verdict Hero Card */}
                      <div className="rounded-xl border border-[#39D98A]/35 bg-gradient-to-br from-[#0D2921] via-[#111C24] to-[#10131C] p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-bold uppercase tracking-wider text-[#B4B8C8]">
                            Mediated Verdict
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-wider bg-[#0A2E22] text-[#39D98A] border border-[#39D98A]/45">
                            Close Alignment
                          </span>
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <span className="block text-[7px] uppercase tracking-wider text-[#989898]">
                              Recommended Fair Budget
                            </span>
                            <span className="text-sm font-victor font-bold text-white">
                              $7,250
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[7px] uppercase tracking-wider text-[#989898]">
                              Effective Rate
                            </span>
                            <span className="text-[11px] font-victor font-bold text-[#39D98A]">
                              $58.00/hr
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 2. Miniature Budget Comparison Visualizer Track */}
                      <div className="rounded-xl border border-[#242938] bg-[#161923] px-3 py-2 space-y-1.5">
                        <div className="flex items-center justify-between text-[7px] font-victor text-[#989898]">
                          <span>Client $6,500</span>
                          <span className="text-[#39D98A] font-bold">Settled $7,250</span>
                          <span>Dev $8,000</span>
                        </div>
                        <div className="relative h-1.5 rounded-full bg-[#090B10] flex items-center">
                          <div className="absolute inset-x-3 h-1 rounded-full bg-gradient-to-r from-[#5661FF]/50 via-[#39D98A] to-[#FF006D]/50" />
                          <span className="absolute left-2 w-2 h-2 rounded-full bg-[#5661FF] border border-[#07090D]" />
                          <span className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#39D98A] border border-[#07090D] shadow-[0_0_8px_#39D98A]" />
                          <span className="absolute right-2 w-2 h-2 rounded-full bg-[#FF006D] border border-[#07090D]" />
                        </div>
                      </div>

                      {/* 3. Miniature SOW & PDF Export Bar */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="space-y-1 flex-1">
                          <div className="h-2 w-28 rounded-full bg-white/20" />
                          <div className="h-1.5 w-20 rounded-full bg-white/10" />
                        </div>
                        <div className="shrink-0 h-6 px-3 rounded-full bg-white text-[#07090D] flex items-center gap-1 text-[8px] font-bold shadow-sm">
                          <span>Download PDF</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: 3 Vertical Steps with Left Indicator Line + Bespoke Icon Box */}
            <div className="lg:col-span-6 space-y-6 sm:space-y-7">
              {STEPS.map((step, idx) => {
                const isActive = activeStep === idx;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => jumpToStep(idx)}
                    className="w-full text-left group flex items-stretch gap-4 sm:gap-5 cursor-pointer focus:outline-none"
                  >
                    {/* Left Vertical Indicator Line */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-[3px] flex-1 rounded-full transition-all duration-300 ${
                          isActive
                            ? "bg-[#5661FF] shadow-[0_0_14px_rgba(86,97,255,0.85)]"
                            : "bg-white/[0.10] group-hover:bg-white/25"
                        }`}
                      />
                    </div>

                    {/* Step Content Row */}
                    <div
                      className={`flex-1 flex items-start gap-4 py-2 transition-opacity duration-300 ${
                        isActive ? "opacity-100" : "opacity-60 group-hover:opacity-90"
                      }`}
                    >
                      {/* Bespoke Icon Box */}
                      <div
                        className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center transition-all duration-300 ${
                          isActive
                            ? "bg-[#5661FF] text-white shadow-[0_10px_28px_rgba(86,97,255,0.45)]"
                            : "bg-[#141722] border border-[#242938] text-[#B4B8C8]"
                        }`}
                      >
                        <StepCustomIcon index={idx} active={isActive} />
                      </div>

                      {/* Title & Concise 2-Line Description */}
                      <div className="space-y-1.5 pt-0.5">
                        <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                          {step.title}
                        </h3>
                        <p className="text-sm text-[#B4B8C8] leading-relaxed max-w-md">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
