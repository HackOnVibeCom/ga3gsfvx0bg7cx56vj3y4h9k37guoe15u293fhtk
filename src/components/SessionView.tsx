"use client";

import { useState } from "react";
import { WaitingPanel } from "./WaitingPanel";
import { PositionForm } from "./PositionForm";
import { ResultPanel } from "./ResultPanel";
import type { PublicNegotiationView } from "@/lib/store";

interface SessionViewProps {
  initialData: PublicNegotiationView;
  ownerToken?: string;
}

export function SessionView({ initialData, ownerToken }: SessionViewProps) {
  const [data, setData] = useState<PublicNegotiationView>(initialData);

  if (data.status === "revealed") {
    return <ResultPanel data={data} />;
  }

  if (data.viewerSide === "A" && ownerToken) {
    return (
      <WaitingPanel
        id={data.id}
        ownerToken={ownerToken}
        projectTitle={data.projectTitle}
        currency={data.currency}
        viewerRole={data.viewerRole}
        positionA={data.positionA}
        onRevealed={(revealed) => setData(revealed)}
      />
    );
  }

  return (
    <PositionForm
      id={data.id}
      projectTitle={data.projectTitle}
      currency={data.currency}
      viewerRole={data.viewerRole}
      creatorRole={data.creatorRole}
      platformFeeHint={
        data.viewerSide === "B" ? data.platformFeeHint : 3
      }
      onRevealed={(revealed) => setData(revealed)}
    />
  );
}
