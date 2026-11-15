import {
  type CurrencyCode,
  type FreelanceMediationSummary,
  type PartyTerms,
  formatMoney,
} from "./midpoint.ts";

export interface MediationCopyResult {
  rationale: string;
  draftMessage: string;
}

const LEGACY_PATTERNS = [
  "batna",
  "zopa",
  "topa",
  "schelling",
  "chatterjee",
  "samuelson",
  "kalai",
  "smorodinsky",
  "reservation price",
  "reservation value",
];

export function isLegacyMediationRationale(
  rationale: string | null | undefined
): boolean {
  if (!rationale || !rationale.trim()) return true;
  const lower = rationale.toLowerCase();
  return LEGACY_PATTERNS.some((term) => lower.includes(term));
}

/**
 * Removes em-dashes (—), en-dashes (–), and double-hyphens (--) from copy
 * so all AI-generated and deterministic text stays natural, clean, and human-written.
 */
export function stripLongDashes(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+--\s+/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\.\s*,/g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildFallbackMediationCopy(params: {
  projectTitle: string;
  currency: CurrencyCode;
  developer: PartyTerms;
  client: PartyTerms;
  summary: FreelanceMediationSummary;
}): MediationCopyResult {
  const { projectTitle, currency, developer, client, summary } = params;
  const cleanTitle = stripLongDashes(projectTitle || "Freelance Project");

  const devOfferFmt = formatMoney(developer.budget, currency);
  const clientOfferFmt = formatMoney(client.budget, currency);
  const hoursMid = summary.hours.midpoint;
  const depositMid = summary.depositPct.midpoint;
  const netDaysMid = summary.netDays.midpoint;
  const revisionsMid = summary.revisions.midpoint;

  const publicGap =
    summary.bridgeOptions?.publicGap ??
    Math.round(Math.abs(developer.budget - client.budget));
  const recommendedBudget =
    summary.bridgeOptions?.recommendedBudget ??
    Math.round((developer.budget + client.budget) / 2);
  const recommendedHours =
    summary.bridgeOptions?.recommendedHours ??
    Math.max(
      1,
      Math.round(
        client.budget /
          Math.max(1, developer.budget / Math.max(1, developer.hours))
      )
    );
  const maxRevisions =
    summary.bridgeOptions?.maxRevisions ?? Math.min(revisionsMid, 2);
  const targetDepositPct =
    summary.bridgeOptions?.targetDepositPct ?? Math.max(depositMid, 25);
  const targetNetDays =
    summary.bridgeOptions?.targetNetDays ?? Math.min(netDaysMid, 14);

  if (!summary.hasZopa || summary.settlement === null) {
    const publicGapFmt = formatMoney(publicGap, currency);
    const recommendedBudgetFmt = formatMoney(recommendedBudget, currency);

    const rationale = stripLongDashes(
      `Developer quote (${devOfferFmt} for ${developer.hours} hrs) and client target (${clientOfferFmt} for ${client.hours} hrs) have a ${publicGapFmt} offer spread, and current walk-away limits do not yet overlap. To unlock an agreement, either align near a ${recommendedBudgetFmt} compromise budget for the ${hoursMid}-hour scope, or hold the budget at ${clientOfferFmt} by capping Phase 1 scope at ${recommendedHours} estimated hours.`
    );

    const draftMessage = stripLongDashes(
      `Hi, thanks for sharing your terms for ${cleanTitle}. Right now our initial quotes (${devOfferFmt} vs ${clientOfferFmt}) have a ${publicGapFmt} gap and do not overlap for the full ${developer.hours}-hour scope.\n\nTo make this work for both sides, we have two practical options:\n- Option 1 (Full Scope): Meet at a compromise budget of ${recommendedBudgetFmt} for ${hoursMid} estimated hours (${targetDepositPct}% upfront deposit, Net ${targetNetDays} invoice cycle, and ${revisionsMid} revision rounds).\n- Option 2 (Hold Client Budget): Keep the total budget at ${clientOfferFmt} by trimming Phase 1 MVP scope to ${recommendedHours} estimated hours with up to ${maxRevisions} consolidated revision rounds.\n\nLet me know which option works best for your timeline and we can lock the SOW right away.`
    );

    return { rationale, draftMessage };
  }

  const settlementFmt = formatMoney(summary.settlement, currency);
  const upfrontFmt = formatMoney(summary.mediatedEconomics.upfrontAmount, currency);
  const completionFmt = formatMoney(
    summary.mediatedEconomics.completionAmount,
    currency
  );
  const hourlyGrossFmt = formatMoney(
    summary.mediatedEconomics.effectiveRate ||
      summary.mediatedEconomics.effectiveHourlyGross,
    currency
  );

  let termBalanceNote =
    "balancing upfront cashflow protection and delivery scope across both sides";
  if ((summary.weightTowardDev ?? 0.5) >= 0.55) {
    termBalanceNote =
      "adjusting slightly toward the developer quote to offset invoice payout lag and scope risk";
  } else if ((summary.weightTowardDev ?? 0.5) <= 0.45) {
    termBalanceNote =
      "adjusting toward the client budget in recognition of strong upfront deposit and fast payout terms";
  }

  const rationale = stripLongDashes(
    `Both sides overlap within a viable agreement zone, converging on a recommended settlement of ${settlementFmt} (${hourlyGrossFmt}/hr effective net across ${hoursMid} hours), ${termBalanceNote}. Non-price terms align at ${depositMid}% upfront deposit, Net ${netDaysMid} payment cycle, and ${revisionsMid} revision ${
      revisionsMid === 1 ? "round" : "rounds"
    }.`
  );

  const paymentLine =
    depositMid > 0
      ? `- Payment Schedule: ${depositMid}% upfront deposit (${upfrontFmt}) due at signing, with the ${completionFmt} balance on Net ${netDaysMid} terms`
      : `- Payment Schedule: Two equal milestone releases totaling ${settlementFmt} on Net ${netDaysMid} settlement terms`;

  const draftMessage = stripLongDashes(
    `Hi, here is our mediated SOW summary for ${cleanTitle} so we can move into kickoff:\n\n- Agreed Project Fee: ${settlementFmt} total for ${hoursMid} estimated hours (${hourlyGrossFmt}/hr effective net rate)\n${paymentLine}\n- Scope & Revisions: Up to ${revisionsMid} consolidated revision ${
      revisionsMid === 1 ? "round" : "rounds"
    } included; out-of-scope additions billed at ${hourlyGrossFmt}/hr via written approval\n\nIf these terms look good on your end, reply to confirm and I will send over the final agreement and kickoff schedule.`
  );

  return { rationale, draftMessage };
}
