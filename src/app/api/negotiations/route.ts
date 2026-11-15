import { NextResponse } from "next/server";
import { createNegotiation } from "@/lib/store";
import {
  parseCurrency,
  parseDealPositionPayload,
  parseRole,
} from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const creatorRole = parseRole(body.creatorRole);
    if (!creatorRole) {
      return NextResponse.json(
        { error: "Please choose either Freelance Developer or Client." },
        { status: 400 }
      );
    }

    const projectTitle =
      typeof body.projectTitle === "string" && body.projectTitle.trim().length >= 2
        ? body.projectTitle.trim().slice(0, 140)
        : "Freelance Software Project";

    const currency = parseCurrency(body.currency);
    const parsedPosition = parseDealPositionPayload(body);

    if (!parsedPosition.ok) {
      return NextResponse.json(
        { error: parsedPosition.error },
        { status: 400 }
      );
    }

    const { id, ownerToken } = createNegotiation({
      projectTitle,
      currency,
      creatorRole,
      positionA: parsedPosition.position,
    });

    return NextResponse.json({ id, ownerToken }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }
}
