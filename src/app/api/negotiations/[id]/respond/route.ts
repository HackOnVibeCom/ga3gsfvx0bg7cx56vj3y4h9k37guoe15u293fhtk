import { NextResponse } from "next/server";
import {
  getNegotiationRecord,
  oppositeRole,
  submitCounterpartyResponse,
} from "@/lib/store";
import { parseDealPositionPayload } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const record = await getNegotiationRecord(id);
    if (!record) {
      return NextResponse.json(
        { error: "Mediation session not found." },
        { status: 404 }
      );
    }

    const token = typeof body.token === "string" ? body.token : null;
    if (token && token === record.ownerToken) {
      return NextResponse.json(
        { error: "The session creator cannot submit the counterparty position." },
        { status: 403 }
      );
    }

    if (record.positionB !== null) {
      return NextResponse.json(
        { error: "Counterparty position has already been locked." },
        { status: 409 }
      );
    }

    const counterpartyRole = oppositeRole(record.creatorRole);
    const parsedPosition = parseDealPositionPayload(body, counterpartyRole);
    if (!parsedPosition.ok) {
      return NextResponse.json(
        { error: parsedPosition.error },
        { status: 400 }
      );
    }

    const result = await submitCounterpartyResponse(
      id,
      parsedPosition.position,
      token
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }
}
