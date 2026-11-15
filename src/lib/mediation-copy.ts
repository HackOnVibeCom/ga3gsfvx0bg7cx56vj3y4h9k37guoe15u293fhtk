import { formatMoney, type CurrencyCode } from "./currency";
import type { DealPosition, FreelanceMediationSummary } from "./midpoint";

export function isLegacyMediationRationale(rationale: string): boolean {
  return (
    rationale.includes('Developer highlighted "') ||
    /^(Close|Bridges|Resolves) \d+% (spread|gap) /.test(rationale)
  );
}

export function buildFallbackMediationCopy(input: {
  projectTitle: string;
  currency: CurrencyCode;
  developer: DealPosition;
  client: DealPosition;
  summary: FreelanceMediationSummary;
}): {
  rationale: string;
  draftMessage: string;
} {
  const { projectTitle, currency, developer, client, summary } = input;
  const { budget, hours, depositPct, netDays, revisions, depositAmount, mediatedEconomics } =
    summary;

  const devBudgetStr = formatMoney(developer.budget, currency);
  const clientBudgetStr = formatMoney(client.budget, currency);
  const midBudgetStr = formatMoney(budget.midpoint, currency);
  const midDepositStr = formatMoney(depositAmount, currency);
  const effRateStr = formatMoney(mediatedEconomics.effectiveRate, currency, 2);
  const gapLabel = `${Math.round(budget.gapPct * 100)}%`;

  let rationale: string;
  if (budget.confidence === "close") {
    rationale = `Both sides landed within a tight ${gapLabel} spread (${devBudgetStr} vs ${clientBudgetStr}), making ${midBudgetStr} over ${hours.midpoint} hours an immediate win-win anchor. Pairing a ${effRateStr}/hr net rate with a ${depositPct.midpoint}% upfront deposit (${midDepositStr}) keeps kickoff smooth and predictable.`;
  } else if (budget.confidence === "moderate") {
    rationale = `Bridging a ${gapLabel} gap between ${devBudgetStr} and ${clientBudgetStr}, settling at ${midBudgetStr} across ${hours.midpoint} hours yields a sustainable ${effRateStr}/hr net rate after fees and revision buffer. A ${depositPct.midpoint}% kickoff deposit (${midDepositStr}), ${revisions.midpoint} revision rounds, and Net ${netDays.midpoint} payment terms balance delivery risk and cashflow.`;
  } else {
    rationale = `Despite a wide ${gapLabel} spread (${devBudgetStr} vs ${clientBudgetStr}), a ${midBudgetStr} midpoint over ${hours.midpoint} hours sets fair commercial ground at ${effRateStr}/hr net. Locking ${depositPct.midpoint}% upfront (${midDepositStr}), Net ${netDays.midpoint} terms, and ${revisions.midpoint} capped revisions protects both scope and cashflow.`;
  }

  const draftMessage = `Hi — here is the mediated middle-ground package for "${projectTitle}":

• Project Budget: ${midBudgetStr}
• Scope Effort: ${hours.midpoint} hrs (${effRateStr}/hr net effective rate)
• Upfront Deposit: ${depositPct.midpoint}% (${midDepositStr})
• Revision Cap: ${revisions.midpoint} included rounds
• Payment Terms: Net ${netDays.midpoint} days

Shall we lock these terms in and schedule kickoff?`;

  return { rationale, draftMessage };
}
