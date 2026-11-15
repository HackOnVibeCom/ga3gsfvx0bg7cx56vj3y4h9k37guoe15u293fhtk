import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import type { CurrencyCode } from "./currency";
import {
  computeFreelanceMediation,
  type DealPosition,
  type FreelanceMediationSummary,
  type PartyRole,
} from "./midpoint";
import {
  buildFallbackMediationCopy,
  isLegacyMediationRationale,
} from "./mediation-copy";

export interface NegotiationRecord {
  id: string;
  ownerToken: string;
  createdAt: string;
  projectTitle: string;
  currency: CurrencyCode;
  creatorRole: PartyRole;
  positionA: DealPosition;
  positionB: DealPosition | null;
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
      /** Only shared platform channel hint is exposed; A's budget/hours/terms remain strictly hidden */
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
      developer: DealPosition;
      client: DealPosition;
      summary: FreelanceMediationSummary;
      rationale: string;
      draftMessage: string;
    };

const STORE_DIR = path.join(process.cwd(), ".tmp");
const STORE_FILE = path.join(STORE_DIR, "negotiations.json");

const globalForStore = globalThis as typeof globalThis & {
  __midpointStore?: Map<string, NegotiationRecord>;
  __midpointStoreLoaded?: boolean;
};

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

export function oppositeRole(role: PartyRole): PartyRole {
  return role === "developer" ? "client" : "developer";
}

export function createNegotiation(input: {
  projectTitle: string;
  currency: CurrencyCode;
  creatorRole: PartyRole;
  positionA: DealPosition;
}): { id: string; ownerToken: string } {
  const map = getMemoryMap();
  const id = nanoid(10);
  const ownerToken = nanoid(24);

  const record: NegotiationRecord = {
    id,
    ownerToken,
    createdAt: new Date().toISOString(),
    projectTitle: input.projectTitle.trim() || "Freelance Software Project",
    currency: input.currency,
    creatorRole: input.creatorRole,
    positionA: input.positionA,
    positionB: null,
    summary: null,
    rationale: null,
    draftMessage: null,
  };

  map.set(id, record);
  persistMap(map);

  return { id, ownerToken };
}

export function getNegotiationRecord(id: string): NegotiationRecord | null {
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
    const revealedSide: "A" | "B" | "spectator" = isOwner
      ? "A"
      : isCounterpartySubmit
      ? "B"
      : "spectator";
    const revealedRole: PartyRole | null = isOwner
      ? record.creatorRole
      : isCounterpartySubmit
      ? oppositeRole(record.creatorRole)
      : null;

    const developer =
      record.creatorRole === "developer" ? record.positionA : record.positionB;
    const client =
      record.creatorRole === "client" ? record.positionA : record.positionB;

    const usesLegacyCopy = isLegacyMediationRationale(record.rationale);
    const fallbackCopy = usesLegacyCopy
      ? buildFallbackMediationCopy({
          projectTitle: record.projectTitle,
          currency: record.currency,
          developer,
          client,
          summary: record.summary,
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
      developer,
      client,
      summary: record.summary,
      rationale: fallbackCopy ? fallbackCopy.rationale : record.rationale,
      draftMessage: fallbackCopy ? fallbackCopy.draftMessage : record.draftMessage,
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

  // Blind guarantee: Party A's numbers, target rate, flags, and reason are completely omitted.
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

export function submitCounterpartyResponse(
  id: string,
  positionB: DealPosition,
  token?: string | null
):
  | { ok: true; data: PublicNegotiationView }
  | { ok: false; status: number; error: string } {
  const map = getMemoryMap();
  loadDiskIntoMap(map);
  const record = map.get(id);

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

  const summary = computeFreelanceMediation(developer, client);
  const { rationale, draftMessage } = buildFallbackMediationCopy({
    projectTitle: record.projectTitle,
    currency: record.currency,
    developer,
    client,
    summary,
  });

  const updated: NegotiationRecord = {
    ...record,
    positionB,
    summary,
    rationale,
    draftMessage,
  };

  map.set(id, updated);
  persistMap(map);

  return {
    ok: true,
    data: toPublicView(updated, token, true),
  };
}
