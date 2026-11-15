import { NextResponse } from "next/server";
import type { PartyRole } from "@/lib/midpoint";
import { regenerateNegotiationDraft } from "@/lib/store";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      viewerRole?: unknown;
      token?: unknown;
    };

    const requestedRole: PartyRole | null =
      body.viewerRole === "developer" || body.viewerRole === "client"
        ? body.viewerRole
        : null;
    const token = typeof body.token === "string" ? body.token : null;

    const result = await regenerateNegotiationDraft({
      id,
      requestedRole,
      token,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(
      {
        draftMessage: result.draftMessage,
        source: result.source,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to generate draft message." },
      { status: 500 }
    );
  }
}
