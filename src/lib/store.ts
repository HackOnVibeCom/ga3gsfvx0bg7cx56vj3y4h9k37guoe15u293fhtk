import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { negotiations, type NegotiationRow } from "@/db/schema";
import type { CurrencyCode } from "./currency";
import {
  generateMediationCopy,
  generatePolishedDraftCopy,
  stripPrivateFields,
} from "./llm";
import {
  buildFallbackMediationCopy,
  isLegacyMediationRationale,
  stripLongDashes,
} from "./mediation-copy";
import {
  computeFreelanceMediationWithBounds,
  type DealPosition,
  type FreelanceMediationSummary,
  type PartyRole,
  type PublicDealPosition,
} from "./midpoint";

export interface NegotiationRecord {
  id: string;
  ownerToken: string;
  createdAt: string;
  projectTitle: string;
  currency: CurrencyCode;
  creatorRole: PartyRole;
  positionA: DealPosition;
  positionB: DealPosition | null;
  hasZopa: boolean | null;
  settlement: number | null;
  zopaLow: number | null;
  zopaHigh: number | null;
  summary: FreelanceMediationSummary | null;
  rationale: string | null;
  draftMessage: string | null;
}

export type PublicNegotiationView =
  | {
      id: string;
      status: "waiting";
      viewerSide: "A";
      viewerRole: PartyRole;
      creatorRole: PartyRole;
      projectTitle: string;
      currency: CurrencyCode;
      createdAt: string;
      positionA: DealPosition;
    }
  | {
      id: string;
      status: "waiting";
      viewerSide: "B";
      viewerRole: PartyRole;
      creatorRole: PartyRole;
      projectTitle: string;
      currency: CurrencyCode;
      createdAt: string;
      /** Only shared platform channel hint is exposed; A's quote, limits & terms remain strictly hidden */
      platformFeeHint: number;
    }
  | {
      id: string;
      status: "revealed";
      viewerSide: "A" | "B" | "spectator";
      viewerRole: PartyRole | null;
      creatorRole: PartyRole;
      projectTitle: string;
      currency: CurrencyCode;
      createdAt: string;
      developer: PublicDealPosition;
      client: PublicDealPosition;
      summary: FreelanceMediationSummary;
      rationale: string;
      draftMessage: string;
      /** Signed per-session responder/participant capability token for AI draft regeneration */
      draftToken?: string;
    };

const STORE_DIR = path.join(process.cwd(), ".tmp");
const STORE_FILE = path.join(STORE_DIR, "negotiations.json");

const globalForStore = globalThis as typeof globalThis & {
  __midpointStore?: Map<string, NegotiationRecord>;
  __midpointStoreLoaded?: boolean;
  __midpointDraftRateLimit?: Map<string, number[]>;
};

const DRAFT_RATE_LIMIT_MAX = 6;
const DRAFT_RATE_LIMIT_WINDOW_MS = 60_000;

function getDraftSecret(): string {
  return (
    process.env.DEEPSEEK_API_KEY?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "midpoint-local-draft-secret"
  );
}

export function deriveDraftAccessToken(id: string, ownerToken: string): string {
  return crypto
    .createHmac("sha256", getDraftSecret())
    .update(`draft:${id}:${ownerToken}`)
    .digest("base64url")
    .slice(0, 32);
}

function tokensEqual(a: string | null | undefined, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function allowDraftGeneration(id: string): boolean {
  if (!globalForStore.__midpointDraftRateLimit) {
    globalForStore.__midpointDraftRateLimit = new Map<string, number[]>();
  }
  const now = Date.now();
  const windowStart = now - DRAFT_RATE_LIMIT_WINDOW_MS;
  const existing = (globalForStore.__midpointDraftRateLimit.get(id) ?? []).filter(
    (ts) => ts > windowStart
  );
  if (existing.length >= DRAFT_RATE_LIMIT_MAX) {
    globalForStore.__midpointDraftRateLimit.set(id, existing);
    return false;
  }
  existing.push(now);
  globalForStore.__midpointDraftRateLimit.set(id, existing);
  return true;
}

function sanitizeSummaryForViewer(
  summary: FreelanceMediationSummary,
  viewerRole: PartyRole | null
): FreelanceMediationSummary {
  if (viewerRole === "developer") {
    return summary;
  }
  return {
    ...summary,
    developerEconomics: {
      ...summary.developerEconomics,
      targetDeltaPct: null,
    },
    mediatedEconomics: {
      ...summary.mediatedEconomics,
      targetDeltaPct: null,
    },
  };
}

function isValidRecord(val: unknown): val is NegotiationRecord {
  if (!val || typeof val !== "object") return false;
  const r = val as Partial<NegotiationRecord>;
  return Boolean(
    typeof r.id === "string" &&
      typeof r.ownerToken === "string" &&
      (r.creatorRole === "developer" || r.creatorRole === "client") &&
      r.positionA &&
      typeof r.positionA.budget === "number"
  );
}

function loadDiskIntoMap(map: Map<string, NegotiationRecord>): void {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        if (isValidRecord(value)) {
          map.set(key, value);
        }
      }
    }
  } catch {
    // Ignore file read errors in read-only or ephemeral environments
  }
}

function getMemoryMap(): Map<string, NegotiationRecord> {
  if (!globalForStore.__midpointStore) {
    globalForStore.__midpointStore = new Map<string, NegotiationRecord>();
  }
  if (!globalForStore.__midpointStoreLoaded) {
    globalForStore.__midpointStoreLoaded = true;
    loadDiskIntoMap(globalForStore.__midpointStore);
  }
  return globalForStore.__midpointStore;
}

function persistMap(map: Map<string, NegotiationRecord>): void {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    const obj = Object.fromEntries(map.entries());
    fs.writeFileSync(STORE_FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch {
    // Ignore file write errors in read-only environments
  }
}

function rowToRecord(row: NegotiationRow): NegotiationRecord {
  return {
    id: row.id,
    ownerToken: row.ownerToken,
    createdAt: row.createdAt.toISOString(),
    projectTitle: row.projectTitle,
    currency: row.currency,
    creatorRole: row.creatorRole,
    positionA: row.positionA,
    positionB: row.positionB ?? null,
    hasZopa: row.hasZopa ?? null,
    settlement: row.settlement ?? null,
    zopaLow: row.zopaLow ?? null,
    zopaHigh: row.zopaHigh ?? null,
    summary: row.summary ?? null,
    rationale: row.rationale ?? null,
    draftMessage: row.draftMessage ?? null,
  };
}

export function oppositeRole(role: PartyRole): PartyRole {
  return role === "developer" ? "client" : "developer";
}

export async function createNegotiation(input: {
  projectTitle: string;
  currency: CurrencyCode;
  creatorRole: PartyRole;
  positionA: DealPosition;
}): Promise<{ id: string; ownerToken: string }> {
  const id = nanoid(10);
  const ownerToken = nanoid(24);
  const projectTitle = input.projectTitle.trim() || "Freelance Software Project";
  const now = new Date();

  const record: NegotiationRecord = {
    id,
    ownerToken,
    createdAt: now.toISOString(),
    projectTitle,
    currency: input.currency,
    creatorRole: input.creatorRole,
    positionA: input.positionA,
    positionB: null,
    hasZopa: null,
    settlement: null,
    zopaLow: null,
    zopaHigh: null,
    summary: null,
    rationale: null,
    draftMessage: null,
  };

  const db = getDb();
  if (db) {
    const isDev = input.creatorRole === "developer";
    await db.insert(negotiations).values({
      id,
      ownerToken,
      createdAt: now,
      projectTitle,
      currency: input.currency,
      creatorRole: input.creatorRole,
      devOffer: isDev ? input.positionA.budget : null,
      devReservation: isDev ? input.positionA.reservation : null,
      devReason: isDev ? input.positionA.reason : null,
      clientOffer: !isDev ? input.positionA.budget : null,
      clientReservation: !isDev ? input.positionA.reservation : null,
      clientReason: !isDev ? input.positionA.reason : null,
      positionA: input.positionA,
      positionB: null,
      hasZopa: null,
      settlement: null,
      zopaLow: null,
      zopaHigh: null,
      summary: null,
      rationale: null,
      draftMessage: null,
    });
    return { id, ownerToken };
  }

  const map = getMemoryMap();
  map.set(id, record);
  persistMap(map);

  return { id, ownerToken };
}

export async function getNegotiationRecord(
  id: string
): Promise<NegotiationRecord | null> {
  const db = getDb();
  if (db) {
    const rows = await db
      .select()
      .from(negotiations)
      .where(eq(negotiations.id, id))
      .limit(1);
    if (rows[0]) {
      return rowToRecord(rows[0]);
    }
    return null;
  }

  const map = getMemoryMap();
  loadDiskIntoMap(map);
  return map.get(id) ?? null;
}

export function toPublicView(
  record: NegotiationRecord,
  token?: string | null,
  isCounterpartySubmit = false
): PublicNegotiationView {
  const isOwner = Boolean(token && record.ownerToken === token);

  if (
    record.positionB !== null &&
    record.summary !== null &&
    record.rationale !== null &&
    record.draftMessage !== null
  ) {
    const responderToken = deriveDraftAccessToken(record.id, record.ownerToken);
    const isVerifiedResponder =
      isCounterpartySubmit || tokensEqual(token, responderToken);

    const revealedSide: "A" | "B" | "spectator" = isOwner
      ? "A"
      : isVerifiedResponder
      ? "B"
      : "spectator";
    const revealedRole: PartyRole | null = isOwner
      ? record.creatorRole
      : isVerifiedResponder
      ? oppositeRole(record.creatorRole)
      : null;

    const rawDeveloper =
      record.creatorRole === "developer" ? record.positionA : record.positionB;
    const rawClient =
      record.creatorRole === "client" ? record.positionA : record.positionB;

    // Strip private reservation limits & redact Developer's targetDeltaPct for non-developers
    const normalizedDeveloper = stripPrivateFields(rawDeveloper);
    const normalizedClient = stripPrivateFields(rawClient);
    const safeSummary = sanitizeSummaryForViewer(record.summary, revealedRole);

    const usesLegacyCopy = isLegacyMediationRationale(record.rationale);
    const fallbackCopy = usesLegacyCopy
      ? buildFallbackMediationCopy({
          projectTitle: record.projectTitle,
          currency: record.currency,
          developer: normalizedDeveloper,
          client: normalizedClient,
          summary: safeSummary,
        })
      : null;

    return {
      id: record.id,
      status: "revealed",
      viewerSide: revealedSide,
      viewerRole: revealedRole,
      creatorRole: record.creatorRole,
      projectTitle: record.projectTitle,
      currency: record.currency,
      createdAt: record.createdAt,
      developer: normalizedDeveloper,
      client: normalizedClient,
      summary: safeSummary,
      rationale: stripLongDashes(
        fallbackCopy ? fallbackCopy.rationale : record.rationale
      ),
      draftMessage: stripLongDashes(
        fallbackCopy ? fallbackCopy.draftMessage : record.draftMessage
      ),
      ...(isOwner || isVerifiedResponder ? { draftToken: responderToken } : {}),
    };
  }

  if (isOwner) {
    return {
      id: record.id,
      status: "waiting",
      viewerSide: "A",
      viewerRole: record.creatorRole,
      creatorRole: record.creatorRole,
      projectTitle: record.projectTitle,
      currency: record.currency,
      createdAt: record.createdAt,
      positionA: record.positionA,
    };
  }

  // Blind guarantee: Party A's numbers, limits, target rate, flags, and reason are completely omitted.
  return {
    id: record.id,
    status: "waiting",
    viewerSide: "B",
    viewerRole: oppositeRole(record.creatorRole),
    creatorRole: record.creatorRole,
    projectTitle: record.projectTitle,
    currency: record.currency,
    createdAt: record.createdAt,
    platformFeeHint: record.positionA.platformFeePct,
  };
}

export async function submitCounterpartyResponse(
  id: string,
  positionB: DealPosition,
  token?: string | null
): Promise<
  | { ok: true; data: PublicNegotiationView }
  | { ok: false; status: number; error: string }
> {
  const record = await getNegotiationRecord(id);

  if (!record) {
    return { ok: false, status: 404, error: "Mediation session not found." };
  }

  if (token && token === record.ownerToken) {
    return {
      ok: false,
      status: 403,
      error: "The session creator cannot submit the counterparty position.",
    };
  }

  if (record.positionB !== null) {
    return {
      ok: false,
      status: 409,
      error: "Counterparty position has already been locked.",
    };
  }

  const developer =
    record.creatorRole === "developer" ? record.positionA : positionB;
  const client = record.creatorRole === "client" ? record.positionA : positionB;

  const { summary, zopa } = computeFreelanceMediationWithBounds(
    developer,
    client,
    record.currency
  );
  const { rationale, draftMessage } = await generateMediationCopy({
    projectTitle: record.projectTitle,
    currency: record.currency,
    developer,
    client,
    summary,
  });

  const updated: NegotiationRecord = {
    ...record,
    positionB,
    hasZopa: zopa.hasZopa,
    settlement: zopa.settlement,
    zopaLow: zopa.zopaLow,
    zopaHigh: zopa.zopaHigh,
    summary,
    rationale,
    draftMessage,
  };

  const db = getDb();
  if (db) {
    const counterpartyIsClient = record.creatorRole === "developer";
    const updatedRows = await db
      .update(negotiations)
      .set({
        devOffer: counterpartyIsClient ? record.positionA.budget : positionB.budget,
        devReservation: counterpartyIsClient
          ? record.positionA.reservation
          : positionB.reservation,
        devReason: counterpartyIsClient ? record.positionA.reason : positionB.reason,
        clientOffer: counterpartyIsClient ? positionB.budget : record.positionA.budget,
        clientReservation: counterpartyIsClient
          ? positionB.reservation
          : record.positionA.reservation,
        clientReason: counterpartyIsClient ? positionB.reason : record.positionA.reason,
        positionB,
        hasZopa: zopa.hasZopa,
        settlement: zopa.settlement,
        zopaLow: zopa.zopaLow,
        zopaHigh: zopa.zopaHigh,
        summary,
        rationale,
        draftMessage,
      })
      .where(and(eq(negotiations.id, id), isNull(negotiations.positionB)))
      .returning({ id: negotiations.id });

    if (updatedRows.length === 0) {
      return {
        ok: false,
        status: 409,
        error: "Counterparty position has already been locked.",
      };
    }
  } else {
    const map = getMemoryMap();
    map.set(id, updated);
    persistMap(map);
  }

  return {
    ok: true,
    data: toPublicView(updated, token, true),
  };
}

export async function regenerateNegotiationDraft(input: {
  id: string;
  requestedRole?: PartyRole | null;
  token?: string | null;
}): Promise<
  | { ok: true; draftMessage: string; source: "deepseek" | "fallback" }
  | { ok: false; status: number; error: string }
> {
  const record = await getNegotiationRecord(input.id);

  if (!record) {
    return { ok: false, status: 404, error: "Mediation session not found." };
  }

  if (record.positionB === null || record.summary === null) {
    return {
      ok: false,
      status: 409,
      error: "Cannot refine message until both parties have submitted.",
    };
  }

  const responderToken = deriveDraftAccessToken(record.id, record.ownerToken);
  const isOwner = Boolean(input.token && input.token === record.ownerToken);
  const isResponder = Boolean(
    input.token && tokensEqual(input.token, responderToken)
  );

  if (!isOwner && !isResponder) {
    return {
      ok: false,
      status: 403,
      error: "Only verified session participants can generate AI drafts.",
    };
  }

  if (!allowDraftGeneration(record.id)) {
    return {
      ok: false,
      status: 429,
      error: "Draft rate limit reached. Please wait a minute before retrying.",
    };
  }

  const viewerRole: PartyRole = isOwner
    ? record.creatorRole
    : oppositeRole(record.creatorRole);

  const developer =
    record.creatorRole === "developer" ? record.positionA : record.positionB;
  const client =
    record.creatorRole === "client" ? record.positionA : record.positionB;

  const { draftMessage, source } = await generatePolishedDraftCopy({
    projectTitle: record.projectTitle,
    currency: record.currency,
    developer,
    client,
    summary: record.summary,
    viewerRole,
    previousDraft: record.draftMessage,
  });

  const db = getDb();
  if (db) {
    await db
      .update(negotiations)
      .set({ draftMessage })
      .where(eq(negotiations.id, input.id));
  } else {
    const map = getMemoryMap();
    map.set(input.id, { ...record, draftMessage });
    persistMap(map);
  }

  return { ok: true, draftMessage, source };
}
