export type ConfidenceTier = "close" | "moderate" | "wide";
export type PartyRole = "developer" | "client";

export interface MidpointResult {
  midpoint: number;
  gapPct: number;
  confidence: ConfidenceTier;
}

export interface DealPosition {
  budget: number;
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

export interface EffectiveRateBreakdown {
  netBudget: number;
  revisionBufferPct: number;
  adjustedHours: number;
  effectiveRate: number;
}

export interface RiskFactor {
  label: string;
  detail: string;
  points: number;
}

export interface RiskAssessment {
  score: number;
  tier: "LOW RISK" | "MEDIUM RISK" | "HIGH RISK";
  factors: RiskFactor[];
}

export interface FeasibilityAssessment {
  score: number;
  tier: "STRONG FIT" | "BALANCED" | "STRETCHED";
  impliedHourlyRate: number;
  upfrontOutlay: number;
  completionBalance: number;
  notes: { label: string; detail: string; impact: string }[];
}

export interface FreelanceMediationSummary {
  budget: MidpointResult;
  hours: MidpointResult;
  depositPct: MidpointResult;
  netDays: MidpointResult;
  revisions: MidpointResult;
  platformFeePct: number;
  depositAmount: number;
  developerEconomics: EffectiveRateBreakdown;
  clientEconomics: EffectiveRateBreakdown;
  mediatedEconomics: EffectiveRateBreakdown;
  mediatedRisk: RiskAssessment;
}

/**
 * Deterministic core engine that computes the fair midpoint, relative gap,
 * and alignment confidence tier from two numeric positions.
 */
export function computeMidpoint(offerA: number, offerB: number): MidpointResult {
  const midpoint = Math.round((offerA + offerB) / 2);
  const maxOffer = Math.max(offerA, offerB);
  const gapPct = maxOffer === 0 ? 0 : Math.abs(offerA - offerB) / maxOffer;
  const confidence: ConfidenceTier =
    gapPct < 0.15 ? "close" : gapPct < 0.4 ? "moderate" : "wide";

  return { midpoint, gapPct, confidence };
}

/**
 * Vetly-inspired effective hourly rate calculator:
 * accounts for platform fees + 10% baseline overhead + 5% per revision round above 2.
 */
export function computeEffectiveHourlyRate(input: {
  budget: number;
  hours: number;
  revisions: number;
  platformFeePct: number;
}): EffectiveRateBreakdown {
  const safeFee = Math.min(100, Math.max(0, input.platformFeePct));
  const netBudget =
    Math.round(Math.max(0, input.budget) * (100 - safeFee)) / 100;
  const extraRevisions = Math.max(0, input.revisions - 2);
  const revisionBufferPct = extraRevisions * 5;
  const adjustedHours =
    input.hours <= 0
      ? 0
      : Math.round(input.hours * (110 + revisionBufferPct)) / 100;
  const effectiveRate = adjustedHours === 0 ? 0 : netBudget / adjustedHours;

  return {
    netBudget,
    revisionBufferPct,
    adjustedHours,
    effectiveRate,
  };
}

const RED_FLAG_WEIGHTS: Record<string, { detail: string; points: number }> = {
  "No signed SOW": { detail: "Scope not protected by contract", points: 25 },
  "Vague specs": { detail: "Requirements need clearer milestones", points: 20 },
  "Tight deadline": { detail: "Compressed delivery timeline", points: 10 },
  "First-time client": { detail: "No prior payment track record", points: 10 },
};

export function computeDeveloperRisk(input: {
  depositPct: number;
  netDays: number;
  revisions: number;
  flags: string[];
}): RiskAssessment {
  const factors: RiskFactor[] = [];

  if (input.depositPct <= 0) {
    factors.push({
      label: "Upfront deposit",
      detail: "No upfront deposit",
      points: 30,
    });
  } else if (input.depositPct < 25) {
    factors.push({
      label: "Upfront deposit",
      detail: `${input.depositPct}% deposit (<25%)`,
      points: 15,
    });
  } else if (input.depositPct < 40) {
    factors.push({
      label: "Upfront deposit",
      detail: `${input.depositPct}% moderate deposit`,
      points: 5,
    });
  }

  if (input.netDays >= 60) {
    factors.push({
      label: "Payment terms",
      detail: `Net ${input.netDays} days`,
      points: 25,
    });
  } else if (input.netDays >= 30) {
    factors.push({
      label: "Payment terms",
      detail: `Net ${input.netDays} days`,
      points: 10,
    });
  }

  if (input.revisions >= 5) {
    factors.push({
      label: "Revision cap",
      detail: `${input.revisions} rounds (high scope creep risk)`,
      points: 20,
    });
  } else if (input.revisions >= 3) {
    factors.push({
      label: "Revision cap",
      detail: `${input.revisions} rounds`,
      points: 10,
    });
  }

  for (const flag of input.flags) {
    const entry = RED_FLAG_WEIGHTS[flag];
    if (entry) {
      factors.push({
        label: flag,
        detail: entry.detail,
        points: entry.points,
      });
    }
  }

  const score = Math.min(
    100,
    factors.reduce((sum, item) => sum + item.points, 0)
  );
  const tier: RiskAssessment["tier"] =
    score >= 60 ? "HIGH RISK" : score >= 30 ? "MEDIUM RISK" : "LOW RISK";

  return { score, tier, factors };
}

export function computeClientFeasibility(input: {
  budget: number;
  hours: number;
  depositPct: number;
  netDays: number;
  revisions: number;
  maxBudgetCeiling?: number;
  flags: string[];
}): FeasibilityAssessment {
  const impliedHourlyRate = input.hours > 0 ? input.budget / input.hours : 0;
  const upfrontOutlay = Math.round((input.budget * input.depositPct) / 100);
  const completionBalance = Math.max(0, input.budget - upfrontOutlay);
  const notes: FeasibilityAssessment["notes"] = [];
  let score = 95;

  if (input.maxBudgetCeiling && input.budget > input.maxBudgetCeiling) {
    score -= 25;
    notes.push({
      label: "Ceiling check",
      detail: "Exceeds max budget ceiling",
      impact: "-25",
    });
  } else if (input.maxBudgetCeiling && input.maxBudgetCeiling > 0) {
    const headroom = Math.round(
      ((input.maxBudgetCeiling - input.budget) / input.maxBudgetCeiling) * 100
    );
    notes.push({
      label: "Budget cushion",
      detail: `${headroom}% below ceiling`,
      impact: "Healthy",
    });
  }

  if (input.depositPct < 20) {
    score -= 15;
    notes.push({
      label: "Developer buy-in",
      detail: `${input.depositPct}% deposit may deter senior devs`,
      impact: "-15",
    });
  } else {
    notes.push({
      label: "Deposit commitment",
      detail: `${input.depositPct}% upfront secures sprint slot`,
      impact: "Positive",
    });
  }

  if (input.netDays > 30) {
    score -= 15;
    notes.push({
      label: "Payout cycle",
      detail: `Net ${input.netDays} slows contractor acceptance`,
      impact: "-15",
    });
  }

  if (input.revisions > 4) {
    score -= 10;
    notes.push({
      label: "Revision load",
      detail: `${input.revisions} rounds increases quote inflation`,
      impact: "-10",
    });
  }

  if (input.flags.includes("Strict deadline")) {
    score -= 10;
    notes.push({
      label: "Timeline pressure",
      detail: "Rush delivery typically adds +15–20% cost",
      impact: "-10",
    });
  }

  const clamped = Math.max(15, Math.min(100, score));
  const tier: FeasibilityAssessment["tier"] =
    clamped >= 75 ? "STRONG FIT" : clamped >= 50 ? "BALANCED" : "STRETCHED";

  return {
    score: clamped,
    tier,
    impliedHourlyRate,
    upfrontOutlay,
    completionBalance,
    notes,
  };
}

export function computeFreelanceMediation(
  developer: DealPosition,
  client: DealPosition
): FreelanceMediationSummary {
  const budget = computeMidpoint(developer.budget, client.budget);
  const hours = computeMidpoint(developer.hours, client.hours);
  const depositPct = computeMidpoint(developer.depositPct, client.depositPct);
  const netDays = computeMidpoint(developer.netDays, client.netDays);
  const revisions = computeMidpoint(developer.revisions, client.revisions);
  const platformFeePct = Math.round(
    (developer.platformFeePct + client.platformFeePct) / 2
  );
  const depositAmount = Math.round((budget.midpoint * depositPct.midpoint) / 100);

  const developerEconomics = computeEffectiveHourlyRate({
    budget: developer.budget,
    hours: developer.hours,
    revisions: developer.revisions,
    platformFeePct: developer.platformFeePct,
  });

  const clientEconomics = computeEffectiveHourlyRate({
    budget: client.budget,
    hours: client.hours,
    revisions: client.revisions,
    platformFeePct: developer.platformFeePct,
  });

  const mediatedEconomics = computeEffectiveHourlyRate({
    budget: budget.midpoint,
    hours: hours.midpoint,
    revisions: revisions.midpoint,
    platformFeePct,
  });

  const mediatedRisk = computeDeveloperRisk({
    depositPct: depositPct.midpoint,
    netDays: netDays.midpoint,
    revisions: revisions.midpoint,
    flags: developer.flags,
  });

  return {
    budget,
    hours,
    depositPct,
    netDays,
    revisions,
    platformFeePct,
    depositAmount,
    developerEconomics,
    clientEconomics,
    mediatedEconomics,
    mediatedRisk,
  };
}
