import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { SessionView } from "@/components/SessionView";
import { getNegotiationRecord, oppositeRole, toPublicView } from "@/lib/store";

export const dynamic = "force-dynamic";

interface SessionPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}

export async function generateMetadata({
  params,
}: SessionPageProps): Promise<Metadata> {
  const { id } = await params;
  const record = await getNegotiationRecord(id);

  if (!record) {
    return {
      title: "Mediation Session Not Found | MidPoint",
      description:
        "Start a blind two-party freelance deal mediation in seconds on MidPoint.",
    };
  }

  const creatorLabel =
    record.creatorRole === "developer" ? "Freelance Developer" : "Client";
  const responderLabel =
    oppositeRole(record.creatorRole) === "developer"
      ? "Freelance Developer"
      : "Client";
  const isRevealed = record.positionB !== null;

  const title = isRevealed
    ? `Mediation Verdict: ${record.projectTitle} | MidPoint`
    : `Blind Deal Invitation: ${record.projectTitle} | MidPoint`;

  const description = isRevealed
    ? `Two-party blind deal mediation completed (${record.currency}). View the mediated settlement, risk breakdown, and ready-to-send SOW draft.`
    : `The ${creatorLabel} locked their terms (${record.currency}). Enter your ${responderLabel} position blindly to compute a fair midpoint with zero anchoring.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "MidPoint",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function SessionPage({
  params,
  searchParams,
}: SessionPageProps) {
  const { id } = await params;
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : undefined;

  const record = await getNegotiationRecord(id);

  if (!record) {
    return (
      <div className="w-full">
        <Header showNewButton />
        <main className="w-full max-w-xl mx-auto px-4 sm:px-6 pt-16 pb-10">
          <section className="dsq-card p-8 text-center space-y-5">
            <div className="w-12 h-12 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6 text-[#989898]" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Mediation session not found
              </h1>
              <p className="text-sm text-[#989898] leading-relaxed">
                This mediation link may have expired or the session ID is incorrect. Start a new freelance deal mediation in seconds.
              </p>
            </div>
            <div>
              <Link
                href="/"
                className="btn-dsq-primary inline-flex items-center gap-2 px-6 py-3 text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Start new mediation</span>
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const initialData = toPublicView(record, token);
  const validOwnerToken =
    token && record.ownerToken === token ? token : undefined;

  return (
    <div className="w-full">
      <Header showNewButton />
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-6">
        <SessionView initialData={initialData} ownerToken={validOwnerToken} />
      </main>
    </div>
  );
}
