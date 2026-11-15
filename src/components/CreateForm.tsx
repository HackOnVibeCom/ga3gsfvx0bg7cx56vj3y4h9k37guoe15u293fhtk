"use client";

import { useRouter } from "next/navigation";
import { DealWorkbench, type WorkbenchSubmitPayload } from "./DealWorkbench";

export function CreateForm() {
  const router = useRouter();

  async function handleCreate(payload: WorkbenchSubmitPayload) {
    const res = await fetch("/api/negotiations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectTitle: payload.projectTitle,
        currency: payload.currency,
        creatorRole: payload.role,
        ...payload.position,
      }),
    });

    const data = (await res.json()) as {
      id?: string;
      ownerToken?: string;
      error?: string;
    };

    if (!res.ok || !data.id || !data.ownerToken) {
      throw new Error(data.error ?? "Failed to create mediation session.");
    }

    router.push(`/r/${data.id}?t=${encodeURIComponent(data.ownerToken)}`);
  }

  return <DealWorkbench mode="create" onSubmit={handleCreate} />;
}
