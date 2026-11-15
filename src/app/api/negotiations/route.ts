import { NextResponse } from "next/server";
import { checkRateLimit, createNegotiation, getRequestIp } from "@/lib/store";
import {
  parseCurrency,
  parseDealPositionPayload,
  parseRole,
} from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    if (!checkRateLimit(`create:${ip}`, 20, 60_000)) {
      return NextResponse.json(
        {
          error:
            "Too many mediation sessions created. Please wait a minute and try again.",
        },
        { status: 429 }
      );
    }

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
    const parsedPosition = parseDealPositionPayload(body, creatorRole);

    if (!parsedPosition.ok) {
      return NextResponse.json(
        { error: parsedPosition.error },
        { status: 400 }
      );
    }

    const { id, ownerToken } = await createNegotiation({
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
