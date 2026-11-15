import { ArrowRight } from "lucide-react";
import { HeroGlobe } from "@/components/HeroGlobe";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { CreateForm } from "@/components/CreateForm";

export default function HomePage() {
  return (
    <div className="w-full overflow-x-clip">
      <main className="w-full">
        {/* Full-viewport Hero so section #mediate stays cleanly below the fold on mobile & desktop */}
        <section className="relative min-h-[100dvh] w-full flex items-center justify-center px-4 sm:px-6 py-12 overflow-hidden">
          <HeroGlobe />

          <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
            <div className="flex justify-center">
              <img
                src="/logo-full.png"
                alt="MidPoint"
                className="h-9 sm:h-11 w-auto object-contain select-none"
              />
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-[72px] font-extrabold tracking-[-0.03em] leading-[1.03] text-[#F1F1F1] text-balance">
              Settle the deal{" "}
              <em className="hero-gradient-text block sm:inline">
                in the middle.
              </em>
            </h1>

            <p className="text-base sm:text-lg text-[#B4B8C8] max-w-xl mx-auto leading-relaxed">
              Submit your freelance projects blindly. Fair midpoint, zero anchoring.
            </p>

            <div className="pt-2 flex justify-center">
              <a
                href="#mediate"
                className="btn-dsq-primary inline-flex items-center gap-2 px-7 py-3.5 text-sm sm:text-base"
              >
                <span>Start blind mediation</span>
                <ArrowRight className="w-4 h-4" />
              </a>
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
