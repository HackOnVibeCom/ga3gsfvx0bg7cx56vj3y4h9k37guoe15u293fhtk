import type { CurrencyCode } from "./currency";

export type { CurrencyCode };

export type ConfidenceTier = "close" | "moderate" | "wide" | "no_overlap";
export type PaymentRiskTier = "LOW RISK" | "MEDIUM RISK" | "HIGH RISK";
export type FeasibilityTier = "STRONG FIT" | "BALANCED" | "TIGHT";
export type ActionPlanTone = "ready" | "conditional" | "high_risk" | "bridge";
export type PartyRole = "developer" | "client";

export interface DealPosition {
  budget: number;
  reservation: number;
  hours: number;
  depositPct: number;
  netDays: number;
  revisions: number;
  platformFeePct: number;
  targetHourlyRate?: number;
  maxBudgetCeiling?: number;
  flags: string[];
  reason: string;
}

export interface PublicDealPosition {
  budget: number;
  hours: number;
  depositPct: number;
  netDays: number;
  revisions: number;
  platformFeePct: number;
  flags: string[];
  reason: string;
}

export interface PartyTerms {
  budget: number;
  reservation?: number;
  hours: number;
  depositPct: number;
  netDays: number;
  revisions: number;
  platformFeePct: number;
  targetHourlyRate?: number;
  maxBudgetCeiling?: number;
  flags: string[];
  reason?: string;
  notes?: string;
}

export interface ZopaComputationResult {
  hasZopa: boolean;
  zopaLow: number | null;
  zopaHigh: number | null;
  settlement: number | null;
  weightTowardDev: number | null;
  shortfall: number;
}

export interface TermMediationMetric {
  devValue: number;
  clientValue: number;
  midpoint: number;
  gap: number;
  gapPct: number;
  confidence: ConfidenceTier;
}

export interface PartyEconomics {
  grossTotal: number;
  platformFeePct: number;
  platformFeeAmount: number;
  netTotal: number;
  netBudget: number;
  revisionBufferPct: number;
  adjustedHours: number;
  effectiveHourlyGross: number;
  effectiveHourlyNet: number;
  effectiveRate: number;
  upfrontAmount: number;
  completionAmount: number;
  targetDeltaPct: number | null;
}

export interface PaymentRiskFactor {
  label: string;
  detail: string;
  points: number;
}

export interface PaymentRiskResult {
  score: number;
  tier: PaymentRiskTier;
  factors: PaymentRiskFactor[];
}

export interface ClientFeasibilityNote {
  label: string;
  detail: string;
  impact: string;
}

export interface ClientFeasibilityResult {
  impliedHourlyRate: number;
  upfrontOutlay: number;
  completionBalance: number;
  score: number;
  tier: FeasibilityTier;
  notes: ClientFeasibilityNote[];
}

export interface BridgeOptions {
  publicGap: number;
  recommendedBudget: number;
  recommendedHours: number;
  targetDepositPct: number;
  targetNetDays: number;
  maxRevisions: number;
}

export interface MediationActionPlan {
  tone: ActionPlanTone;
  badge: string;
  title: string;
  subtitle: string;
  items: string[];
}

export interface TermAdjustmentFactor {
  label: string;
  deltaPct: number;
}

export interface FreelanceMediationSummary {
  hasZopa: boolean;
  settlement: number | null;
  weightTowardDev: number | null;
  termAdjustmentTotal?: number;
  termAdjustmentFactors?: TermAdjustmentFactor[];
  shortfall: number;
  platformFeePct: number;
  depositAmount: number;
  budget: TermMediationMetric;
  offerComparison: TermMediationMetric;
  hours: TermMediationMetric;
  depositPct: TermMediationMetric;
  netDays: TermMediationMetric;
  revisions: TermMediationMetric;
  developerEconomics: PartyEconomics;
  clientEconomics: PartyEconomics;
  mediatedEconomics: PartyEconomics;
  developerRisk: PaymentRiskResult;
  clientRisk: PaymentRiskResult;
  mediatedRisk: PaymentRiskResult;
  confidence: ConfidenceTier;
  guardrails: string[];
  actionPlan: MediationActionPlan;
  bridgeOptions: BridgeOptions;
}

export interface MidpointResult {
  midpoint: number;
  gap: number;
  gapPct: number;
  confidence: ConfidenceTier;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function classifyGapConfidence(gapPct: number): ConfidenceTier {
  if (gapPct < 0.15) return "close";
  if (gapPct < 0.4) return "moderate";
  return "wide";
}

/**
 * Multi-Attribute Contractual Risk & Cashflow Utility Adjustment
 * (Keeney & Raiffa 1976; Kalai & Smorodinsky 1975)
 *
 * Computes a bounded adjustment in [-0.20, +0.20] around the symmetric
 * split-the-difference baseline (Chatterjee & Samuelson 1983, k = 0.5), alongside
 * itemized human-readable factors for transparent UI/PDF inspection.
 */
export function computeContractualTermAdjustmentDetailed(
  developer: Pick<PartyTerms, "hours" | "depositPct" | "netDays" | "revisions" | "flags">,
  client: Pick<PartyTerms, "hours" | "depositPct" | "netDays" | "revisions" | "flags">
): { total: number; factors: TermAdjustmentFactor[] } {
  const medDeposit = Math.round((developer.depositPct + client.depositPct) / 2);
  const medNetDays = Math.round((developer.netDays + client.netDays) / 2);
  const medRevisions = Math.round((developer.revisions + client.revisions) / 2);

  let adjustment = 0;
  const factors: TermAdjustmentFactor[] = [];

  const pushFactor = (label: string, delta: number) => {
    if (delta === 0) return;
    adjustment += delta;
    factors.push({
      label,
      deltaPct: Math.round(delta * 1000) / 10,
    });
  };

  // 1. Upfront cashflow protection trade-off
  if (medDeposit === 0) {
    pushFactor("0% upfront deposit cashflow exposure", 0.08);
  } else if (medDeposit < 30) {
    pushFactor(`Low upfront deposit (${medDeposit}%)`, 0.05);
  } else if (medDeposit >= 50) {
    pushFactor(`Strong upfront protection (${medDeposit}% deposit)`, -0.05);
  }

  // 2. Working-capital invoice payout cycle trade-off
  if (medNetDays >= 45) {
    pushFactor(`Extended invoice cycle (Net ${medNetDays})`, 0.07);
  } else if (medNetDays >= 30) {
    pushFactor(`Delayed payout window (Net ${medNetDays})`, 0.04);
  } else if (medNetDays <= 7) {
    pushFactor(`Fast payout cycle (Net ${medNetDays})`, -0.04);
  }

  // 3. Revision & scope-creep liability trade-off
  if (medRevisions >= 5) {
    pushFactor(`High revision load (${medRevisions} rounds)`, 0.05);
  } else if (medRevisions >= 4) {
    pushFactor(`Expanded revisions (${medRevisions} rounds)`, 0.03);
  } else if (medRevisions <= 1) {
    pushFactor(`Tight revision cap (${medRevisions} round)`, -0.03);
  }

  // 4. Explicit risk flags (bounded to prevent unilateral flag-stuffing)
  const devFlags = developer.flags ?? [];
  const clientFlags = client.flags ?? [];
  let flagDelta = 0;

  if (
    clientFlags.includes("Strict deadline") ||
    clientFlags.includes("Tight deadline") ||
    devFlags.includes("Tight deadline")
  ) {
    flagDelta += 0.02;
  }
  if (
    clientFlags.includes("Fixed cap") ||
    clientFlags.includes("Fixed budget cap")
  ) {
    flagDelta += 0.01;
  }

  let devRiskFlagCount = 0;
  if (devFlags.includes("Vague specs")) devRiskFlagCount += 1;
  if (devFlags.includes("No signed SOW")) devRiskFlagCount += 1;
  if (devFlags.includes("3+ stakeholders")) devRiskFlagCount += 1;
  flagDelta += Math.min(0.03, devRiskFlagCount * 0.015);

  const boundedFlagDelta = Math.min(0.04, Math.round(flagDelta * 1000) / 1000);
  if (boundedFlagDelta > 0) {
    pushFactor("Contractual risk flags", boundedFlagDelta);
  }

  // 5. Scope hours estimation asymmetry
  if (developer.hours > client.hours * 1.15) {
    pushFactor(`Scope effort gap (${developer.hours}h vs ${client.hours}h)`, 0.03);
  } else if (client.hours > developer.hours * 1.15) {
    pushFactor(`Client scope headroom (${client.hours}h vs ${developer.hours}h)`, -0.02);
  }

  return {
    total: clampNumber(Number(adjustment.toFixed(4)), -0.2, 0.2),
    factors,
  };
}

export function computeContractualTermAdjustment(
  developer: Pick<PartyTerms, "hours" | "depositPct" | "netDays" | "revisions" | "flags">,
  client: Pick<PartyTerms, "hours" | "depositPct" | "netDays" | "revisions" | "flags">
): number {
  return computeContractualTermAdjustmentDetailed(developer, client).total;
}

/**
 * Double-Blind Gate-and-Clamp Mediation Engine (Option B)
 * (Chatterjee & Samuelson 1983 k = 0.5 baseline; Myerson & Satterthwaite 1983;
 *  Keeney & Raiffa 1976 multi-attribute contractual adjustment)
 *
 * 1. Base settlement P_raw is computed from the public quotes
 *    [publicLow, publicHigh] weighted by w = 0.5 + termAdjustment.
 * 2. Private walk-away reservations (devMin, clientMax) define the Individual
 *    Rationality feasibility gate [lo, hi] and clamp P_raw into [lo, hi].
 * 3. For all interior settlements (lo <= P_raw <= hi), P_settled depends exclusively
 *    on public quotes and contractual terms, preventing algebraic inversion of
 *    private walk-away limits.
 */
export function computeZOPA(
  devOffer: number,
  devReservation: number,
  clientOffer: number,
  clientReservation: number,
  termAdjustment: number = 0
): ZopaComputationResult {
  const cleanDevOffer = Math.max(0, Number(devOffer) || 0);
  const cleanDevRes = Math.max(0, Number(devReservation) || 0);
  const cleanClientOffer = Math.max(0, Number(clientOffer) || 0);
  const cleanClientRes = Math.max(0, Number(clientReservation) || 0);

  const devMin = Math.min(cleanDevOffer, cleanDevRes);
  const devMax = Math.max(cleanDevOffer, cleanDevRes);
  const clientMin = Math.min(cleanClientOffer, cleanClientRes);
  const clientMax = Math.max(cleanClientOffer, cleanClientRes);
  const publicOfferGap = Math.round(Math.abs(cleanDevOffer - cleanClientOffer));

  // 1. Individual Rationality feasibility gate
  if (devMin > clientMax) {
    return {
      hasZopa: false,
      zopaLow: null,
      zopaHigh: null,
      settlement: null,
      weightTowardDev: null,
      shortfall: publicOfferGap,
    };
  }

  const lo =
    cleanClientOffer > cleanDevOffer
      ? Math.max(devMin, cleanDevOffer)
      : Math.max(devMin, clientMin);
  const hi =
    cleanClientOffer > cleanDevOffer
      ? Math.min(clientMax, cleanClientOffer)
      : Math.min(devMax, clientMax);

  if (lo > hi) {
    return {
      hasZopa: false,
      zopaLow: null,
      zopaHigh: null,
      settlement: null,
      weightTowardDev: null,
      shortfall: publicOfferGap,
    };
  }

  // 2. Public-quote candidate settlement weighted by contractual risk/cashflow adjustment
  const publicLow = Math.min(cleanDevOffer, cleanClientOffer);
  const publicHigh = Math.max(cleanDevOffer, cleanClientOffer);
  const boundedAdjustment = clampNumber(termAdjustment, -0.2, 0.2);
  const weightTowardDev = Number(
    clampNumber(0.5 + boundedAdjustment, 0.3, 0.7).toFixed(4)
  );
  const rawPublicSettlement = Math.round(
    publicLow + weightTowardDev * (publicHigh - publicLow)
  );

  // 3. Clamp public-quote candidate settlement to the feasible reservation bounds [lo, hi]
  const settlement = Math.round(clampNumber(rawPublicSettlement, lo, hi));

  return {
    hasZopa: true,
    zopaLow: Math.round(lo),
    zopaHigh: Math.round(hi),
    settlement,
    weightTowardDev,
    shortfall: 0,
  };
}

export function computeTermMetric(
  devValue: number,
  clientValue: number,
  roundToInteger = false
): TermMediationMetric {
  const d = Number.isFinite(devValue) ? devValue : 0;
  const c = Number.isFinite(clientValue) ? clientValue : 0;
  const rawMid = (d + c) / 2;
  const midpoint = roundToInteger
    ? Math.round(rawMid)
    : Math.round(rawMid * 100) / 100;
  const gap = Math.round(Math.abs(d - c) * 100) / 100;
  const gapPct =
    rawMid === 0 ? 0 : Math.round((gap / rawMid) * 10000) / 10000;

  return {
    devValue: d,
    clientValue: c,
    midpoint,
    gap,
    gapPct,
    confidence: classifyGapConfidence(gapPct),
  };
}

export function computeMidpoint(a: number, b: number): MidpointResult {
  const metric = computeTermMetric(a, b, false);
  return {
    midpoint: metric.midpoint,
    gap: metric.gap,
    gapPct: metric.gapPct,
    confidence: metric.confidence,
  };
}

export function computeEffectiveHourlyRate(input: {
  budget: number;
  hours: number;
  revisions: number;
  platformFeePct: number;
}): {
  netBudget: number;
  revisionBufferPct: number;
  adjustedHours: number;
  effectiveRate: number;
} {
  const safeBudget = Math.max(0, input.budget);
  const safeHours = Math.max(1, input.hours);
  const safeFeePct = clampNumber(input.platformFeePct, 0, 100);
  const extraRevisions = Math.max(0, input.revisions - 2);
  const revisionBufferPct = extraRevisions * 5;

  const netBudget = Math.round(safeBudget * (1 - safeFeePct / 100));
  const adjustedHours =
    Math.round(safeHours * (1 + 0.1 + revisionBufferPct / 100) * 10) / 10;
  const effectiveRate =
    adjustedHours > 0 ? Math.round((netBudget / adjustedHours) * 100) / 100 : 0;

  return {
    netBudget,
    revisionBufferPct,
    adjustedHours,
    effectiveRate,
  };
}

export function computePartyEconomics(
  budget: number,
  hours: number,
  depositPct: number,
  platformFeePct: number,
  targetHourlyRate?: number,
  revisions: number = 2
): PartyEconomics {
  const safeBudget = Math.max(0, budget);
  const safeHours = Math.max(1, hours);
  const safeDepositPct = clampNumber(depositPct, 0, 100);
  const safeFeePct = clampNumber(platformFeePct, 0, 100);

  const platformFeeAmount = Math.round((safeBudget * safeFeePct) / 100);
  const netTotal = Math.round(safeBudget - platformFeeAmount);
  const effectiveHourlyGross = Math.round((safeBudget / safeHours) * 100) / 100;
  const effectiveHourlyNet = Math.round((netTotal / safeHours) * 100) / 100;
  const upfrontAmount = Math.round((safeBudget * safeDepositPct) / 100);
  const completionAmount = Math.round(safeBudget - upfrontAmount);

  const hourlyBreakdown = computeEffectiveHourlyRate({
    budget: safeBudget,
    hours: safeHours,
    revisions,
    platformFeePct: safeFeePct,
  });

  let targetDeltaPct: number | null = null;
  if (targetHourlyRate && targetHourlyRate > 0) {
    targetDeltaPct =
      Math.round(
        ((hourlyBreakdown.effectiveRate - targetHourlyRate) / targetHourlyRate) *
          1000
      ) / 10;
  }

  return {
    grossTotal: Math.round(safeBudget),
    platformFeePct: safeFeePct,
    platformFeeAmount,
    netTotal,
    netBudget: hourlyBreakdown.netBudget,
    revisionBufferPct: hourlyBreakdown.revisionBufferPct,
    adjustedHours: hourlyBreakdown.adjustedHours,
    effectiveHourlyGross,
    effectiveHourlyNet,
    effectiveRate: hourlyBreakdown.effectiveRate,
    upfrontAmount,
    completionAmount,
    targetDeltaPct,
  };
}

export function computePaymentRisk(
  terms: Pick<PartyTerms, "depositPct" | "netDays" | "revisions" | "flags">,
  scopeGapPct: number = 0
): PaymentRiskResult {
  let score = 0;
  const factors: PaymentRiskFactor[] = [];

  if (terms.depositPct === 0) {
    score += 30;
    factors.push({
      label: "Upfront deposit",
      detail: "0% upfront deposit",
      points: 30,
    });
  } else if (terms.depositPct < 25) {
    score += 22;
    factors.push({
      label: "Upfront deposit",
      detail: `Low deposit (${terms.depositPct}%)`,
      points: 22,
    });
  } else if (terms.depositPct < 40) {
    score += 12;
    factors.push({
      label: "Upfront deposit",
      detail: `Partial deposit (${terms.depositPct}%)`,
      points: 12,
    });
  } else if (terms.depositPct < 50) {
    score += 5;
    factors.push({
      label: "Upfront deposit",
      detail: `Moderate deposit (${terms.depositPct}%)`,
      points: 5,
    });
  }

  if (terms.netDays >= 60) {
    score += 28;
    factors.push({
      label: "Payment terms",
      detail: `Net ${terms.netDays} payout delay`,
      points: 28,
    });
  } else if (terms.netDays >= 45) {
    score += 22;
    factors.push({
      label: "Payment terms",
      detail: `Net ${terms.netDays} payout delay`,
      points: 22,
    });
  } else if (terms.netDays >= 30) {
    score += 15;
    factors.push({
      label: "Payment terms",
      detail: `Net ${terms.netDays} invoice cycle`,
      points: 15,
    });
  } else if (terms.netDays >= 15) {
    score += 7;
    factors.push({
      label: "Payment terms",
      detail: `Net ${terms.netDays} invoice cycle`,
      points: 7,
    });
  } else if (terms.netDays > 0) {
    score += 3;
    factors.push({
      label: "Payment terms",
      detail: `Net ${terms.netDays} settlement`,
      points: 3,
    });
  }

  if (terms.revisions >= 5) {
    score += 18;
    factors.push({
      label: "Revision cap",
      detail: `High revision cap (${terms.revisions})`,
      points: 18,
    });
  } else if (terms.revisions === 4) {
    score += 12;
    factors.push({
      label: "Revision cap",
      detail: "4 revision rounds",
      points: 12,
    });
  } else if (terms.revisions === 3) {
    score += 6;
    factors.push({
      label: "Revision cap",
      detail: "3 revision rounds",
      points: 6,
    });
  } else if (terms.revisions === 2) {
    score += 2;
    factors.push({
      label: "Revision cap",
      detail: "2 revision rounds",
      points: 2,
    });
  }

  if (scopeGapPct >= 0.45) {
    score += 12;
    factors.push({
      label: "Scope divergence",
      detail: "Wide scope hours divergence",
      points: 12,
    });
  } else if (scopeGapPct >= 0.25) {
    score += 6;
    factors.push({
      label: "Scope divergence",
      detail: "Scope estimate mismatch",
      points: 6,
    });
  }

  const flagWeights: Record<string, number> = {
    "No signed SOW": 12,
    "Vague specs": 10,
    "3+ stakeholders": 8,
    "First-time client": 6,
    "Strict deadline": 6,
    "Tight deadline": 6,
    "Fixed cap": 5,
    "Fixed budget cap": 5,
    "Post-launch support": 4,
  };

  for (const flag of terms.flags) {
    if (flag === "Milestone payout") continue;
    const pts = flagWeights[flag] ?? 5;
    score += pts;
    factors.push({ label: flag, detail: flag, points: pts });
  }

  const finalScore = clampNumber(score, 0, 100);
  let tier: PaymentRiskTier = "LOW RISK";
  if (finalScore >= 55) {
    tier = "HIGH RISK";
  } else if (finalScore >= 28) {
    tier = "MEDIUM RISK";
  }

  return {
    score: finalScore,
    tier,
    factors,
  };
}

export const computeDeveloperRisk = computePaymentRisk;

export function computeClientFeasibility(input: {
  budget: number;
  hours: number;
  depositPct: number;
  netDays: number;
  revisions: number;
  maxBudgetCeiling?: number;
  flags: string[];
}): ClientFeasibilityResult {
  const safeBudget = Math.max(0, input.budget);
  const safeHours = Math.max(1, input.hours);
  const safeDeposit = clampNumber(input.depositPct, 0, 100);

  const impliedHourlyRate = Math.round((safeBudget / safeHours) * 100) / 100;
  const upfrontOutlay = Math.round((safeBudget * safeDeposit) / 100);
  const completionBalance = Math.round(safeBudget - upfrontOutlay);

  let score = 70;
  const notes: ClientFeasibilityNote[] = [];

  if (safeDeposit >= 50) {
    score += 12;
    notes.push({
      label: `${safeDeposit}% upfront commitment`,
      detail: "Strong kickoff commitment",
      impact: "+12",
    });
  } else if (safeDeposit >= 25) {
    score += 6;
    notes.push({
      label: `${safeDeposit}% upfront deposit`,
      detail: "Standard kickoff deposit",
      impact: "+6",
    });
  } else {
    score -= 12;
    notes.push({
      label: `${safeDeposit}% upfront deposit`,
      detail: "Low upfront protection for talent",
      impact: "-12",
    });
  }

  if (input.netDays <= 7) {
    score += 10;
    notes.push({
      label: `Net ${input.netDays} fast payout`,
      detail: "Attractive settlement speed",
      impact: "+10",
    });
  } else if (input.netDays <= 14) {
    score += 5;
    notes.push({
      label: `Net ${input.netDays} invoice cycle`,
      detail: "Standard invoice terms",
      impact: "+5",
    });
  } else if (input.netDays >= 30) {
    const penalty = input.netDays >= 60 ? 16 : 10;
    score -= penalty;
    notes.push({
      label: `Net ${input.netDays} payout lag`,
      detail: "Delayed invoice settlement",
      impact: `-${penalty}`,
    });
  }

  if (input.revisions <= 2) {
    score += 6;
    notes.push({
      label: `${input.revisions} revision cap`,
      detail: "Controlled scope iterations",
      impact: "+6",
    });
  } else if (input.revisions >= 4) {
    score -= 10;
    notes.push({
      label: `${input.revisions} revision rounds`,
      detail: "Higher scope creep exposure",
      impact: "-10",
    });
  }

  if (
    typeof input.maxBudgetCeiling === "number" &&
    input.maxBudgetCeiling > safeBudget
  ) {
    const flexPct = Math.round(
      ((input.maxBudgetCeiling - safeBudget) / Math.max(1, safeBudget)) * 100
    );
    if (flexPct >= 10) {
      score += 8;
      notes.push({
        label: `${flexPct}% budget flexibility`,
        detail: "Healthy negotiation buffer",
        impact: "+8",
      });
    }
  }

  const finalScore = clampNumber(score, 0, 100);
  let tier: FeasibilityTier = "BALANCED";
  if (finalScore >= 75) {
    tier = "STRONG FIT";
  } else if (finalScore < 50) {
    tier = "TIGHT";
  }

  return {
    impliedHourlyRate,
    upfrontOutlay,
    completionBalance,
    score: finalScore,
    tier,
    notes,
  };
}

function quantizeBudget(value: number, currency: CurrencyCode): number {
  const safe = Math.max(0, Math.round(value));
  if (currency === "IDR") {
    if (safe >= 10_000_000) return Math.round(safe / 250_000) * 250_000;
    if (safe >= 1_000_000) return Math.round(safe / 50_000) * 50_000;
    return Math.round(safe / 10_000) * 10_000;
  }
  if (safe >= 10_000) return Math.round(safe / 100) * 100;
  if (safe >= 1_000) return Math.round(safe / 50) * 50;
  return Math.round(safe / 10) * 10;
}

export function computeBridgeOptions(
  developer: PartyTerms,
  client: PartyTerms,
  hoursMidpoint: number,
  depositMidpoint: number,
  netDaysMidpoint: number,
  revisionsMidpoint: number,
  termAdjustment: number,
  currency: CurrencyCode = "USD"
): BridgeOptions {
  const publicGap = Math.round(Math.abs(developer.budget - client.budget));
  const rawPublicMid = (developer.budget + client.budget) / 2;
  const adjustedBridgeBudget =
    rawPublicMid + (developer.budget - client.budget) * (termAdjustment * 0.25);
  const recommendedBudget = quantizeBudget(adjustedBridgeBudget, currency);

  const devImpliedHourly =
    developer.budget / Math.max(1, developer.hours || hoursMidpoint || 1);
  const recommendedHours = clampNumber(
    Math.round(client.budget / Math.max(1, devImpliedHourly)),
    1,
    Math.max(1, developer.hours || hoursMidpoint || 1)
  );

  return {
    publicGap,
    recommendedBudget,
    recommendedHours,
    targetDepositPct: clampNumber(Math.max(depositMidpoint, 25), 25, 50),
    targetNetDays: Math.min(netDaysMidpoint, 14),
    maxRevisions: Math.min(revisionsMidpoint, 2),
  };
}

function buildDynamicActionPlan(params: {
  hasZopa: boolean;
  settlement: number | null;
  developer: PartyTerms;
  client: PartyTerms;
  hours: TermMediationMetric;
  depositPct: TermMediationMetric;
  netDays: TermMediationMetric;
  revisions: TermMediationMetric;
  mediatedEconomics: PartyEconomics;
  mediatedRisk: PaymentRiskResult;
  bridgeOptions: BridgeOptions;
  currency: CurrencyCode;
}): MediationActionPlan {
  const {
    hasZopa,
    settlement,
    developer,
    client,
    hours,
    depositPct,
    netDays,
    revisions,
    mediatedEconomics,
    mediatedRisk,
    bridgeOptions,
    currency,
  } = params;

  const combinedFlags = Array.from(
    new Set([...(developer.flags || []), ...(client.flags || [])])
  );
  const overageRate = Math.max(
    1,
    Math.round(mediatedEconomics.effectiveRate || mediatedEconomics.effectiveHourlyGross)
  );

  // STATE 4: NO OVERLAP -> Ways to Bridge This Gap (Pareto Trade-Off Options)
  if (!hasZopa || settlement === null) {
    const items: string[] = [
      `Option A (Full Scope Compromise): Meet near ${formatMoney(
        bridgeOptions.recommendedBudget,
        currency
      )} for the ${hours.midpoint}-hour scope with ${bridgeOptions.targetDepositPct}% upfront and Net ${bridgeOptions.targetNetDays} settlement.`,
      `Option B (Cap Scope to Client Budget): Hold budget at ${formatMoney(
        client.budget,
        currency
      )} by scoping Phase 1 MVP to ${bridgeOptions.recommendedHours} estimated hours and capping revisions at ${bridgeOptions.maxRevisions} rounds.`,
    ];

    const deferredHours = Math.max(
      0,
      Math.round(developer.hours - bridgeOptions.recommendedHours)
    );
    if (deferredHours >= 5) {
      items.push(
        `Option C (Phased Milestone Split): Deliver the ${bridgeOptions.recommendedHours}-hour core build now at ${formatMoney(
          client.budget,
          currency
        )}, and price the remaining ${deferredHours} hrs as an optional Phase 2 milestone.`
      );
    }

    if (client.depositPct < 50 || client.netDays > 14) {
      items.push(
        `Cashflow Concession Lever: Offering 50% upfront deposit and Net 7 payout lowers freelancer risk exposure so they can flex closer to ${formatMoney(
          client.budget,
          currency
        )}.`
      );
    } else {
      items.push(
        `Scope De-Risking Lever: Removing open-ended deliverables and locking ${bridgeOptions.maxRevisions} consolidated revision rounds reduces the contingency buffer built into the quote.`
      );
    }

    return {
      tone: "bridge",
      badge: "WAYS TO BRIDGE THIS GAP",
      title: "Paths to Unlock an Agreement",
      subtitle: `Current boundaries do not intersect across the ${formatMoney(
        bridgeOptions.publicGap,
        currency
      )} offer spread. Use one of these trade-offs to close the gap:`,
      items: items.slice(0, 4),
    };
  }

  // STATE 3: HIGH RISK AGREEMENT -> Mandatory Risk Countermeasures
  if (mediatedRisk.tier === "HIGH RISK") {
    const items: string[] = [];

    if (depositPct.midpoint < 30) {
      const targetDepAmount = Math.round(settlement * 0.35);
      items.push(
        `Raise upfront deposit from ${depositPct.midpoint}% to at least 35% (${formatMoney(
          targetDepAmount,
          currency
        )}) or fund an escrow milestone before starting engineering work.`
      );
    } else {
      items.push(
        `Enforce hard work-start gating until the ${depositPct.midpoint}% upfront deposit (${formatMoney(
          mediatedEconomics.upfrontAmount,
          currency
        )}) clears.`
      );
    }

    if (netDays.midpoint >= 30) {
      items.push(
        `Shorten invoice terms from Net ${netDays.midpoint} to Net 14, or split the ${formatMoney(
          mediatedEconomics.completionAmount,
          currency
        )} balance into two milestone releases.`
      );
    }

    if (revisions.midpoint >= 3) {
      items.push(
        `Tighten revision cap from ${revisions.midpoint} rounds to 2 consolidated rounds, billing additional changes at ${formatMoney(
          overageRate,
          currency
        )}/hr.`
      );
    }

    if (hours.gapPct >= 0.25) {
      items.push(
        `Resolve the ${Math.round(hours.devValue)}h vs ${Math.round(
          hours.clientValue
        )}h scope gap by attaching an explicit feature exclusion list for the ${hours.midpoint}-hour baseline.`
      );
    }

    if (
      combinedFlags.includes("No signed SOW") ||
      combinedFlags.includes("Vague specs")
    ) {
      items.push(
        `Convert vague requirements into a signed SOW with written acceptance criteria before locking the ${formatMoney(
          settlement,
          currency
        )} fixed fee.`
      );
    } else if (combinedFlags.includes("3+ stakeholders")) {
      items.push(
        `Designate a single client sign-off owner in the contract so multi-stakeholder feedback does not stall Net ${netDays.midpoint} milestone payouts.`
      );
    } else if (items.length < 4) {
      items.push(
        `Add a late-payment pause clause if any milestone invoice remains unpaid 5 business days past the Net ${netDays.midpoint} due date.`
      );
    }

    return {
      tone: "high_risk",
      badge: "HIGH EXPOSURE WARNING",
      title: "Mandatory Risk Countermeasures",
      subtitle: `Price overlaps at ${formatMoney(
        settlement,
        currency
      )}, but mediated payment and scope terms carry high exposure (${mediatedRisk.score}/100). Apply these safeguards first:`,
      items: items.slice(0, 4),
    };
  }

  // STATE 2: CONDITIONAL AGREEMENT -> Medium Risk or Scope Divergence (>= 25%)
  if (mediatedRisk.tier === "MEDIUM RISK" || hours.gapPct >= 0.25) {
    const items: string[] = [];

    if (hours.gapPct >= 0.2) {
      items.push(
        `Align the ${Math.round(hours.devValue)}h vs ${Math.round(
          hours.clientValue
        )}h estimate gap by locking ${hours.midpoint} hrs for Phase 1 and logging extra requests at ${formatMoney(
          overageRate,
          currency
        )}/hr.`
      );
    }

    if (depositPct.midpoint === 0) {
      items.push(
        `Since upfront deposit is 0%, split the ${formatMoney(
          settlement,
          currency
        )} budget into 3 milestone invoices so delivery and payment progress together.`
      );
    } else if (depositPct.midpoint < 30) {
      items.push(
        `Collect ${depositPct.midpoint}% upfront (${formatMoney(
          mediatedEconomics.upfrontAmount,
          currency
        )}) at signing and schedule a mid-project milestone for half of the remaining ${formatMoney(
          mediatedEconomics.completionAmount,
          currency
        )}.`
      );
    } else {
      items.push(
        `Gate kickoff on the ${depositPct.midpoint}% upfront deposit (${formatMoney(
          mediatedEconomics.upfrontAmount,
          currency
        )}) with the ${formatMoney(
          mediatedEconomics.completionAmount,
          currency
        )} balance due on Net ${netDays.midpoint}.`
      );
    }

    if (netDays.midpoint >= 21) {
      items.push(
        `Cap deliverable review to 5 business days so the Net ${netDays.midpoint} payout timer starts immediately upon handoff.`
      );
    } else {
      items.push(
        `Cap included revisions at ${revisions.midpoint} consolidated ${
          revisions.midpoint === 1 ? "round" : "rounds"
        } within a ${hours.midpoint}-hour scope ceiling.`
      );
    }

    if (
      combinedFlags.includes("Strict deadline") ||
      combinedFlags.includes("Tight deadline")
    ) {
      items.push(
        `Tie the strict deadline commitment to client feedback turnarounds within 48 hours at each review checkpoint.`
      );
    } else if (
      combinedFlags.includes("Vague specs") ||
      combinedFlags.includes("No signed SOW")
    ) {
      items.push(
        `Document exact deliverable acceptance criteria in the SOW before starting the ${hours.midpoint}-hour build.`
      );
    } else if (combinedFlags.includes("3+ stakeholders")) {
      items.push(
        `Require consolidated feedback from a single stakeholder lead before each of the ${revisions.midpoint} revision rounds.`
      );
    } else if (items.length < 4) {
      items.push(
        `Price out-of-scope additions at ${formatMoney(
          overageRate,
          currency
        )}/hr via written change order before extra hours are worked.`
      );
    }

    return {
      tone: "conditional",
      badge: "CONDITIONAL APPROVAL",
      title: "Recommended Contract Guardrails",
      subtitle: `Both sides converge at ${formatMoney(
        settlement,
        currency
      )}, with targeted clauses needed to keep scope and cashflow balanced:`,
      items: items.slice(0, 4),
    };
  }

  // STATE 1: READY TO KICKOFF -> Low Risk & Aligned Scope
  const readyItems: string[] = [];

  if (depositPct.midpoint > 0) {
    readyItems.push(
      `Issue Invoice #1 for the ${depositPct.midpoint}% upfront deposit (${formatMoney(
        mediatedEconomics.upfrontAmount,
        currency
      )}) upon SOW signature, with the ${formatMoney(
        mediatedEconomics.completionAmount,
        currency
      )} balance on Net ${netDays.midpoint}.`
    );
  } else {
    readyItems.push(
      `Schedule two equal milestone invoices totaling ${formatMoney(
        settlement,
        currency
      )} on Net ${netDays.midpoint} settlement terms.`
    );
  }

  readyItems.push(
    `Lock baseline scope at ${hours.midpoint} estimated hours and ${revisions.midpoint} consolidated revision ${
      revisions.midpoint === 1 ? "round" : "rounds"
    } (${formatMoney(overageRate, currency)}/hr for post-scope additions).`
  );

  readyItems.push(
    `Share the mediated SOW draft below for one-click countersignature and schedule the project kickoff handoff.`
  );

  return {
    tone: "ready",
    badge: "READY FOR KICKOFF",
    title: "Next Steps to Finalize",
    subtitle: `Commercial terms and risk profile (${mediatedRisk.score}/100) are well-aligned. Proceed to contract execution:`,
    items: readyItems,
  };
}

export function computeFreelanceMediationWithBounds(
  developer: PartyTerms,
  client: PartyTerms,
  currency: CurrencyCode = "USD"
): { summary: FreelanceMediationSummary; zopa: ZopaComputationResult } {
  const offerComparison = computeTermMetric(developer.budget, client.budget, true);
  const hours = computeTermMetric(developer.hours, client.hours, true);
  const depositPct = computeTermMetric(
    developer.depositPct,
    client.depositPct,
    true
  );
  const netDays = computeTermMetric(developer.netDays, client.netDays, true);
  const revisions = computeTermMetric(
    developer.revisions,
    client.revisions,
    true
  );

  const termAdj = computeContractualTermAdjustmentDetailed(developer, client);
  const termAdjustment = termAdj.total;
  const devRes =
    typeof developer.reservation === "number"
      ? developer.reservation
      : developer.budget;
  const clientRes =
    typeof client.reservation === "number"
      ? client.reservation
      : client.budget;

  const zopa = computeZOPA(
    developer.budget,
    devRes,
    client.budget,
    clientRes,
    termAdjustment
  );

  const effectiveSettlement = zopa.hasZopa
    ? zopa.settlement!
    : offerComparison.midpoint;

  const mediatedFeePct = clampNumber(developer.platformFeePct, 0, 50);

  const developerEconomics = computePartyEconomics(
    developer.budget,
    developer.hours,
    developer.depositPct,
    developer.platformFeePct,
    developer.targetHourlyRate,
    developer.revisions
  );

  const clientEconomics = computePartyEconomics(
    client.budget,
    client.hours,
    client.depositPct,
    client.platformFeePct,
    undefined,
    client.revisions
  );

  const mediatedEconomics = computePartyEconomics(
    effectiveSettlement,
    hours.midpoint,
    depositPct.midpoint,
    mediatedFeePct,
    developer.targetHourlyRate,
    revisions.midpoint
  );

  const developerRisk = computePaymentRisk(developer, 0);
  const clientRisk = computePaymentRisk(client, 0);

  const combinedFlags = Array.from(
    new Set([...(developer.flags || []), ...(client.flags || [])])
  );
  const mediatedRisk = computePaymentRisk(
    {
      depositPct: depositPct.midpoint,
      netDays: netDays.midpoint,
      revisions: revisions.midpoint,
      flags: combinedFlags,
    },
    hours.gapPct
  );

  let confidence: ConfidenceTier;
  if (!zopa.hasZopa) {
    confidence = "no_overlap";
  } else if (
    mediatedRisk.tier === "HIGH RISK" ||
    offerComparison.gapPct >= 0.4 ||
    hours.gapPct >= 0.4
  ) {
    confidence = "wide";
  } else if (
    mediatedRisk.tier === "MEDIUM RISK" ||
    offerComparison.gapPct >= 0.15 ||
    hours.gapPct >= 0.2
  ) {
    confidence = "moderate";
  } else {
    confidence = "close";
  }

  const budget: TermMediationMetric = {
    devValue: developer.budget,
    clientValue: client.budget,
    midpoint: effectiveSettlement,
    gap: offerComparison.gap,
    gapPct: offerComparison.gapPct,
    confidence,
  };

  const bridgeOptions = computeBridgeOptions(
    developer,
    client,
    hours.midpoint,
    depositPct.midpoint,
    netDays.midpoint,
    revisions.midpoint,
    termAdjustment,
    currency
  );

  const actionPlan = buildDynamicActionPlan({
    hasZopa: zopa.hasZopa,
    settlement: zopa.settlement,
    developer,
    client,
    hours,
    depositPct,
    netDays,
    revisions,
    mediatedEconomics,
    mediatedRisk,
    bridgeOptions,
    currency,
  });

  const summary: FreelanceMediationSummary = {
    hasZopa: zopa.hasZopa,
    settlement: zopa.settlement,
    weightTowardDev: zopa.weightTowardDev,
    termAdjustmentTotal: Math.round(termAdjustment * 1000) / 10,
    termAdjustmentFactors: termAdj.factors,
    shortfall: zopa.shortfall,
    platformFeePct: mediatedFeePct,
    depositAmount: mediatedEconomics.upfrontAmount,
    budget,
    offerComparison,
    hours,
    depositPct,
    netDays,
    revisions,
    developerEconomics,
    clientEconomics,
    mediatedEconomics,
    developerRisk,
    clientRisk,
    mediatedRisk,
    confidence,
    guardrails: actionPlan.items,
    actionPlan,
    bridgeOptions,
  };

  return { summary, zopa };
}

export function computeFreelanceMediation(
  developer: PartyTerms,
  client: PartyTerms,
  currency: CurrencyCode = "USD"
): FreelanceMediationSummary {
  return computeFreelanceMediationWithBounds(developer, client, currency).summary;
}

export function formatMoney(
  value: number,
  currency: CurrencyCode = "USD",
  fractionDigits = 0
): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (currency === "IDR") {
    return `Rp ${new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(fractionDigits === 0 ? Math.round(safe) : safe)}`;
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(fractionDigits === 0 ? Math.round(safe) : safe);
  } catch {
    return `${currency} ${Math.round(safe).toLocaleString("en-US")}`;
  }
}

export function formatCurrency(
  value: number,
  currency: CurrencyCode = "USD"
): string {
  return formatMoney(value, currency);
}
