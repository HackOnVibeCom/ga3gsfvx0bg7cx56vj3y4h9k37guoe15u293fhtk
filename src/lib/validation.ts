import { CURRENCIES, type CurrencyCode } from "./currency.ts";
import type { DealPosition, PartyRole } from "./midpoint.ts";

export function parseCurrency(raw: unknown): CurrencyCode {
  if (typeof raw === "string") {
    const normalized = raw.trim().toUpperCase();
    if (normalized in CURRENCIES) {
      return normalized as CurrencyCode;
    }
  }
  return "USD";
}

export function parseRole(raw: unknown): PartyRole | null {
  if (raw === "developer" || raw === "client") {
    return raw;
  }
  return null;
}

function parseIntRange(
  raw: unknown,
  min: number,
  max: number,
  fieldLabel: string
): { ok: true; value: number } | { ok: false; error: string } {
  const num =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw.trim())
        : NaN;

  if (!Number.isFinite(num) || !Number.isInteger(num) || num < min || num > max) {
    return {
      ok: false,
      error: `${fieldLabel} must be a whole number between ${min} and ${max.toLocaleString("en-US")}.`,
    };
  }

  return { ok: true, value: num };
}

export function parseDealPositionPayload(
  raw: Record<string, unknown>,
  role?: PartyRole
):
  | { ok: true; position: DealPosition }
  | { ok: false; error: string } {
  const budget = parseIntRange(raw.budget, 1, 10_000_000_000, "Project budget / quote");
  if (!budget.ok) return budget;

  const reservationLabel =
    role === "developer"
      ? "Minimum acceptable amount"
      : role === "client"
        ? "Maximum budget you can pay"
        : "Private limit";

  const reservation = parseIntRange(
    raw.reservation,
    1,
    10_000_000_000,
    reservationLabel
  );
  if (!reservation.ok) return reservation;

  if (role === "developer" && reservation.value > budget.value) {
    return {
      ok: false,
      error: "Minimum acceptable amount cannot exceed your project quote.",
    };
  }

  if (role === "client" && reservation.value < budget.value) {
    return {
      ok: false,
      error: "Maximum you can pay cannot be lower than your target budget.",
    };
  }

  const hours = parseIntRange(raw.hours, 1, 10_000, "Estimated hours");
  if (!hours.ok) return hours;

  const depositPct = parseIntRange(raw.depositPct, 0, 100, "Upfront deposit %");
  if (!depositPct.ok) return depositPct;

  const netDays = parseIntRange(raw.netDays, 0, 180, "Payment terms (Net days)");
  if (!netDays.ok) return netDays;

  const revisions = parseIntRange(raw.revisions, 0, 50, "Revision rounds");
  if (!revisions.ok) return revisions;

  const platformFeePct = parseIntRange(raw.platformFeePct, 0, 50, "Platform fee %");
  if (!platformFeePct.ok) return platformFeePct;

  let targetHourlyRate: number | undefined;
  if (
    raw.targetHourlyRate !== undefined &&
    raw.targetHourlyRate !== null &&
    raw.targetHourlyRate !== ""
  ) {
    const parsedTarget = parseIntRange(
      raw.targetHourlyRate,
      0,
      100_000_000,
      "Target hourly rate"
    );
    if (!parsedTarget.ok) return parsedTarget;
    targetHourlyRate = parsedTarget.value;
  }

  const flags = Array.isArray(raw.flags)
    ? raw.flags.filter((item): item is string => typeof item === "string").slice(0, 10)
    : [];

  const reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
  if (reason.length > 1200) {
    return {
      ok: false,
      error: "Notes must be 1,200 characters or fewer.",
    };
  }

  return {
    ok: true,
    position: {
      budget: budget.value,
      reservation: reservation.value,
      hours: hours.value,
      depositPct: depositPct.value,
      netDays: netDays.value,
      revisions: revisions.value,
      platformFeePct: platformFeePct.value,
      targetHourlyRate,
      maxBudgetCeiling: role === "client" ? reservation.value : undefined,
      flags,
      reason,
    },
  };
}
