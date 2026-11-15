import { NextResponse } from "next/server";
import { submitCounterpartyResponse } from "@/lib/store";
import { parseDealPositionPayload } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const parsedPosition = parseDealPositionPayload(body);
    if (!parsedPosition.ok) {
      return NextResponse.json(
        { error: parsedPosition.error },
        { status: 400 }
      );
    }

    const token = typeof body.token === "string" ? body.token : null;
    const result = submitCounterpartyResponse(
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
