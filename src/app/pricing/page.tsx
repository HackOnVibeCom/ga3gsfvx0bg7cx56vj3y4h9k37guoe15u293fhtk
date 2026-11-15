import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { PricingView } from "@/components/PricingView";

export const metadata: Metadata = {
  title: "Pricing — MidPoint Blind Deal Mediation",
  description:
    "Core two-party blind freelance mediation is free forever. Upgrade to Pro or Unlimited & API for multi-round re-mediation, custom-branded SOWs, and embedded escrow.",
};

export default function PricingPage() {
  return (
    <div className="w-full overflow-x-clip">
      <Header showNewButton />
      <main className="w-full">
        <PricingView />
      </main>
    </div>
  );
}
