import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { HeroGlobe } from "@/components/HeroGlobe";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { CreateForm } from "@/components/CreateForm";

export default function HomePage() {
  return (
    <div className="w-full overflow-x-clip">
      <div className="relative z-20">
        <Header showNewButton />
      </div>

      <main className="w-full">
        {/* Full-viewport Hero so section #mediate stays cleanly below the fold on mobile & desktop */}
        <section className="relative min-h-[calc(100dvh-64px)] w-full flex items-center justify-center px-4 sm:px-6 py-12 overflow-hidden">
          <HeroGlobe />

          <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-4xl sm:text-6xl lg:text-[72px] font-extrabold tracking-[-0.03em] leading-[1.03] text-[#F1F1F1] text-balance">
              Settle the deal{" "}
              <em className="hero-gradient-text block sm:inline">
                in the middle.
              </em>
            </h1>

            <p className="text-base sm:text-lg text-[#B4B8C8] max-w-xl mx-auto leading-relaxed">
              Submit your freelance projects blindly. Fair midpoint, zero anchoring.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#mediate"
                className="btn-dsq-primary inline-flex items-center gap-2 px-7 py-3.5 text-sm sm:text-base"
              >
                <span>Start blind mediation</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.09] px-6 py-3.5 text-sm sm:text-base font-semibold text-white transition-all"
              >
                <span>View pricing</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Sticky Scroll-Driven How It Works Section */}
        <HowItWorksSection />

        {/* Freelance Deal Workbench: Section Title + Form (3fr) + Live Economics & Risk Meter (2fr) */}
        <section
          id="mediate"
          aria-labelledby="workbench-heading"
          className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-6 scroll-mt-6 space-y-10 sm:space-y-12"
        >
          <div className="text-center">
            <h2
              id="workbench-heading"
              className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold tracking-[-0.03em] leading-[1.08] text-[#F1F1F1]"
            >
              Deal Mediation <em className="hero-gradient-text">Workbench</em>
            </h2>
          </div>

          <CreateForm />
        </section>
      </main>
    </div>
  );
}
