import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeMidpoint,
  computeFreelanceMediation,
  computeFreelanceMediationWithBounds,
  computePaymentRisk,
  computeZOPA,
  computeContractualTermAdjustment,
  formatCurrency,
  formatMoney,
  type PartyTerms,
} from "./midpoint.ts";

describe("computeZOPA (Chatterjee-Samuelson k=0.5 & Risk-Adjusted Mechanism)", () => {
  it("computes strategy-proof symmetric k=0.5 baseline when termAdjustment is 0", () => {
    const res1 = computeZOPA(20000000, 15000000, 12000000, 16000000, 0);
    assert.equal(res1.hasZopa, true);
    assert.equal(res1.zopaLow, 15000000);
    assert.equal(res1.zopaHigh, 16000000);
    assert.equal(res1.weightTowardDev, 0.5);
    assert.equal(res1.settlement, 15500000);

    // Proof of immunity to cheap-talk bluffing:
    // Even if Developer bluffs with a 100,000,000 public offer (while keeping 15,000,000 reservation),
    // the settlement does NOT shift toward Developer!
    const bluffRes = computeZOPA(100000000, 15000000, 12000000, 16000000, 0);
    assert.equal(bluffRes.settlement, res1.settlement);
  });

  it("shifts settlement inside [zopaLow, zopaHigh] based on contractual risk/cashflow concessions", () => {
    const devPremium = computeZOPA(8000, 6500, 6000, 7500, 0.12);
    assert.equal(devPremium.hasZopa, true);
    assert.equal(devPremium.weightTowardDev, 0.62);
    assert.equal(devPremium.settlement, Math.round(6500 + 0.62 * (7500 - 6500)));

    const clientDiscount = computeZOPA(8000, 6500, 6000, 7500, -0.09);
    assert.equal(clientDiscount.weightTowardDev, 0.41);
    assert.equal(
      clientDiscount.settlement,
      Math.round(6500 + 0.41 * (7500 - 6500))
    );
  });

  it("never leaks private reservation gap when no overlap exists (reports public offer spread)", () => {
    // User's exact scenario: Dev asks 8000 (min 7000), Client offers 6000 (max 6000)
    // Private reservation gap is 1000, but public offer gap is 2000.
    // Shortfall MUST be 2000 so neither party can reverse-engineer the counterparty's secret limit!
    const noOverlap = computeZOPA(8000, 7000, 6000, 6000);
    assert.equal(noOverlap.hasZopa, false);
    assert.equal(noOverlap.settlement, null);
    assert.equal(noOverlap.shortfall, 2000);

    const res2 = computeZOPA(25000000, 18000000, 10000000, 14000000);
    assert.equal(res2.hasZopa, false);
    assert.equal(res2.settlement, null);
    assert.equal(res2.shortfall, 15000000);
  });

  it("handles immediate surplus when Client public offer exceeds Developer ask (hasZopa = true)", () => {
    // Dev asks 8000 (min 6500), Client blindly offers 9000 (max 10000)
    // Immediate surplus zone is [8000, 9000] -> k=0.5 settles cleanly at 8500!
    const surplus = computeZOPA(8000, 6500, 9000, 10000, 0);
    assert.equal(surplus.hasZopa, true);
    assert.equal(surplus.zopaLow, 8000);
    assert.equal(surplus.zopaHigh, 9000);
    assert.equal(surplus.settlement, 8500);
  });
});

describe("computeContractualTermAdjustment", () => {
  it("increases Developer weight when terms impose low deposit, slow Net payout, and risk flags", () => {
    const adj = computeContractualTermAdjustment(
      {
        hours: 120,
        depositPct: 0,
        netDays: 45,
        revisions: 5,
        flags: ["Vague specs", "No signed SOW"],
      },
      {
        hours: 90,
        depositPct: 20,
        netDays: 60,
        revisions: 5,
        flags: ["Strict deadline"],
      }
    );
    assert.ok(adj > 0.1);
    assert.ok(adj <= 0.2);
  });

  it("decreases Developer weight (Client discount) when Client offers 50%+ upfront and Net <= 7", () => {
    const adj = computeContractualTermAdjustment(
      {
        hours: 100,
        depositPct: 50,
        netDays: 7,
        revisions: 1,
        flags: [],
      },
      {
        hours: 100,
        depositPct: 50,
        netDays: 7,
        revisions: 1,
        flags: [],
      }
    );
    assert.ok(adj < 0);
  });
});

describe("computeMidpoint (legacy helper)", () => {
  it("calculates exact midpoint and gap", () => {
    const res = computeMidpoint(8000, 6000);
    assert.equal(res.midpoint, 7000);
    assert.equal(res.gap, 2000);
    assert.equal(res.confidence, "moderate");
  });

  it("classifies close and wide gaps", () => {
    assert.equal(computeMidpoint(5200, 5000).confidence, "close");
    assert.equal(computeMidpoint(10000, 5000).confidence, "wide");
  });
});

describe("computeFreelanceMediation & Dynamic 4-State Action Plan", () => {
  const devTerms: PartyTerms = {
    budget: 8500,
    reservation: 6500,
    hours: 120,
    depositPct: 50,
    netDays: 7,
    revisions: 2,
    platformFeePct: 10,
    targetHourlyRate: 65,
    flags: ["Vague specs"],
    notes: "Need clean milestone signoff.",
  };

  const clientTerms: PartyTerms = {
    budget: 6300,
    reservation: 7500,
    hours: 100,
    depositPct: 25,
    netDays: 14,
    revisions: 3,
    platformFeePct: 5,
    flags: ["Strict deadline"],
    notes: "Fixed Q2 budget.",
  };

  it("mediates all 5 dimensions, uses client.platformFeePct for clientEconomics, and combines flags", () => {
    const { summary, zopa } = computeFreelanceMediationWithBounds(
      devTerms,
      clientTerms
    );
    assert.equal(summary.hasZopa, true);
    assert.equal(zopa.zopaLow, 6500);
    assert.equal(zopa.zopaHigh, 7500);
    assert.ok(summary.settlement !== null && summary.settlement >= 6500);
    assert.ok(summary.settlement !== null && summary.settlement <= 7500);
    assert.equal(summary.hours.midpoint, 110);
    assert.equal(summary.depositPct.midpoint, 38);
    assert.equal(summary.netDays.midpoint, 11);
    assert.equal(summary.revisions.midpoint, 3);

    // Verify clientEconomics uses client.platformFeePct (5%), not developer.platformFeePct (10%)
    assert.equal(summary.clientEconomics.platformFeePct, 5);
    assert.equal(summary.clientEconomics.platformFeeAmount, 315);

    // Verify mediatedRisk includes both developer ("Vague specs") and client ("Strict deadline") flags
    const factorLabels = summary.mediatedRisk.factors.map((f) => f.label);
    assert.ok(factorLabels.includes("Vague specs"));
    assert.ok(factorLabels.includes("Strict deadline"));
  });

  it("generates State 1 (ready) actionPlan when low risk and aligned hours", () => {
    const summary = computeFreelanceMediation(
      {
        ...devTerms,
        budget: 7200,
        reservation: 6800,
        hours: 100,
        depositPct: 50,
        netDays: 7,
        revisions: 2,
        flags: [],
      },
      {
        ...clientTerms,
        budget: 6900,
        reservation: 7400,
        hours: 95,
        depositPct: 50,
        netDays: 7,
        revisions: 2,
        flags: [],
      }
    );
    assert.equal(summary.actionPlan.tone, "ready");
    assert.equal(summary.actionPlan.badge, "READY FOR KICKOFF");
    assert.equal(summary.confidence, "close");
  });

  it("generates State 3 (high_risk) actionPlan when mediated contract carries high exposure", () => {
    const summary = computeFreelanceMediation(
      {
        ...devTerms,
        depositPct: 0,
        netDays: 60,
        revisions: 5,
        flags: ["No signed SOW", "Vague specs"],
      },
      {
        ...clientTerms,
        depositPct: 0,
        netDays: 60,
        revisions: 5,
        flags: ["Strict deadline"],
      }
    );
    assert.equal(summary.mediatedRisk.tier, "HIGH RISK");
    assert.equal(summary.actionPlan.tone, "high_risk");
    assert.equal(summary.confidence, "wide");
  });

  it("generates State 4 (bridge) actionPlan and privacy-safe bridgeOptions when no overlap exists", () => {
    // User's exact scenario: Dev asks $8,000 (min $7,000, 100h), Client offers $6,000 (max $6,000, 80h)
    const noZopaSummary = computeFreelanceMediation(
      { ...devTerms, budget: 8000, reservation: 7000, hours: 100, flags: [] },
      { ...clientTerms, budget: 6000, reservation: 6000, hours: 80, flags: [] }
    );
    assert.equal(noZopaSummary.hasZopa, false);
    assert.equal(noZopaSummary.settlement, null);
    assert.equal(noZopaSummary.confidence, "no_overlap");
    // Shortfall & publicGap must equal $2,000 (public offer spread), NEVER $1,000 (private limit gap)
    assert.equal(noZopaSummary.shortfall, 2000);
    assert.equal(noZopaSummary.bridgeOptions.publicGap, 2000);
    assert.equal(noZopaSummary.bridgeOptions.recommendedBudget, 7000);
    assert.equal(noZopaSummary.bridgeOptions.recommendedHours, 75);
    assert.equal(noZopaSummary.actionPlan.tone, "bridge");
    assert.ok(
      noZopaSummary.actionPlan.items.join(" ").includes("75 estimated hours")
    );
  });

  it("formats IDR actionPlan and rounds IDR bridge budgets without leaking $ signs", () => {
    const idrNoOverlap = computeFreelanceMediation(
      { ...devTerms, budget: 25000000, reservation: 18000000, hours: 100, flags: [] },
      { ...clientTerms, budget: 10000000, reservation: 14000000, hours: 80, flags: [] },
      "IDR"
    );
    assert.equal(idrNoOverlap.hasZopa, false);
    assert.ok(idrNoOverlap.actionPlan.subtitle.includes("Rp"));
    assert.equal(idrNoOverlap.actionPlan.subtitle.includes("$"), false);
    assert.equal(idrNoOverlap.actionPlan.items.join(" ").includes("$"), false);
    assert.ok(idrNoOverlap.bridgeOptions.recommendedBudget % 250000 === 0);
  });

  it("uses developer.platformFeePct for mediated channel fee and surfaces termAdjustmentFactors", () => {
    const summary = computeFreelanceMediation(
      { ...devTerms, platformFeePct: 10 },
      { ...clientTerms, platformFeePct: 0 }
    );
    assert.equal(summary.platformFeePct, 10);
    assert.ok(Array.isArray(summary.termAdjustmentFactors));
    assert.ok((summary.termAdjustmentFactors?.length ?? 0) > 0);
  });
});

describe("computePaymentRisk", () => {
  it("flags 0% deposit and Net 60 as HIGH RISK", () => {
    const risk = computePaymentRisk({
      depositPct: 0,
      netDays: 60,
      revisions: 5,
      flags: ["No signed SOW", "Vague specs"],
    });
    assert.equal(risk.tier, "HIGH RISK");
    assert.ok(risk.score >= 55);
  });

  it("rates 50% deposit and Net 7 as LOW RISK", () => {
    const risk = computePaymentRisk({
      depositPct: 50,
      netDays: 7,
      revisions: 2,
      flags: [],
    });
    assert.equal(risk.tier, "LOW RISK");
    assert.ok(risk.score < 28);
  });
});

describe("formatCurrency & formatMoney", () => {
  it("formats USD and IDR cleanly", () => {
    assert.equal(formatCurrency(7400), "$7,400");
    assert.ok(formatMoney(15444444, "IDR").includes("Rp"));
  });
});
