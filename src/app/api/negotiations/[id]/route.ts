import { NextResponse } from "next/server";
import { getNegotiationRecord, toPublicView } from "@/lib/store";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const token =
    url.searchParams.get("t") ?? request.headers.get("x-owner-token");

  const record = await getNegotiationRecord(id);
  if (!record) {
    return NextResponse.json(
      { error: "Mediation session not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(toPublicView(record, token), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
