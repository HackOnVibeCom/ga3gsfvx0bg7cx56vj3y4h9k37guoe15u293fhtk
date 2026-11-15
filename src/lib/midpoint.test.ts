import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeMidpoint,
  computeFreelanceMediation,
  computeFreelanceMediationWithBounds,
  computePaymentRisk,
  computeClientFeasibility,
  computeEffectiveHourlyRate,
  computePartyEconomics,
  computeBridgeOptions,
  computeZOPA,
  computeContractualTermAdjustment,
  formatCurrency,
  formatMoney,
  type DealPosition,
  type PartyTerms,
} from "./midpoint.ts";
import { parseDealPositionPayload, parseCurrency, parseRole } from "./validation.ts";
import {
  checkRateLimit,
  deriveDraftAccessToken,
  toPublicView,
  type NegotiationRecord,
} from "./store.ts";

describe("computeZOPA (Gate-and-Clamp Public-Quote Split & Private Reservation Gate)", () => {
  it("computes public-quote k=0.5 baseline, clamps extreme bluffs, and prevents interior limit leakage", () => {
    const res1 = computeZOPA(20000000, 15000000, 12000000, 16000000, 0);
    assert.equal(res1.hasZopa, true);
    assert.equal(res1.zopaLow, 15000000);
    assert.equal(res1.zopaHigh, 16000000);
    assert.equal(res1.weightTowardDev, 0.5);
    assert.equal(res1.settlement, 16000000);

    // Zero-leakage proof on interior deals: varying private reservations (e.g., 6500..7000 and 7100..8000)
    // never changes the settlement price (7000), preventing algebraic inversion of private limits.
    const interiorA = computeZOPA(8000, 7000, 6000, 7500, 0);
    const interiorB = computeZOPA(8000, 6500, 6000, 7900, 0);
    assert.equal(interiorA.settlement, 7000);
    assert.equal(interiorB.settlement, 7000);

    // Extreme public bluffing is capped by the counterparty's private reservation clamp:
    const bluffRes = computeZOPA(100000000, 15000000, 12000000, 16000000, 0);
    assert.equal(bluffRes.settlement, res1.settlement);
  });

  it("shifts settlement inside [publicLow, publicHigh] (clamped to [zopaLow, zopaHigh]) based on contractual concessions", () => {
    const devPremium = computeZOPA(8000, 6500, 6000, 7500, 0.12);
    assert.equal(devPremium.hasZopa, true);
    assert.equal(devPremium.weightTowardDev, 0.62);
    assert.equal(devPremium.settlement, Math.round(6000 + 0.62 * (8000 - 6000)));

    const clientDiscount = computeZOPA(8000, 6500, 6000, 7500, -0.09);
    assert.equal(clientDiscount.weightTowardDev, 0.41);
    assert.equal(
      clientDiscount.settlement,
      Math.round(6000 + 0.41 * (8000 - 6000))
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

describe("Smoke Suite: Economics, Client Feasibility & Exact-Match Edge Cases", () => {
  it("computes effective hourly rate and net party economics accurately", () => {
    const rate = computeEffectiveHourlyRate({
      budget: 10000,
      hours: 100,
      revisions: 4,
      platformFeePct: 10,
    });
    assert.equal(rate.netBudget, 9000);
    assert.equal(rate.revisionBufferPct, 10);
    assert.equal(rate.adjustedHours, 120);
    assert.equal(rate.effectiveRate, 75);

    const econ = computePartyEconomics(10000, 100, 50, 10, 60, 4);
    assert.equal(econ.upfrontAmount, 5000);
    assert.equal(econ.completionAmount, 5000);
    assert.equal(econ.targetDeltaPct, 25);
  });

  it("evaluates client feasibility tiers and ceiling headroom", () => {
    const strong = computeClientFeasibility({
      budget: 7000,
      maxBudgetCeiling: 9000,
      hours: 100,
      depositPct: 25,
      netDays: 14,
      revisions: 2,
      flags: [],
    });
    assert.equal(strong.upfrontOutlay, 1750);
    assert.equal(strong.completionBalance, 5250);
    assert.equal(strong.tier, "STRONG FIT");
  });

  it("handles exact budget match (zero spread) without division-by-zero errors", () => {
    const dev: PartyTerms = {
      budget: 7500,
      reservation: 7000,
      hours: 100,
      depositPct: 50,
      netDays: 7,
      revisions: 2,
      platformFeePct: 5,
      flags: [],
    };
    const client: PartyTerms = {
      budget: 7500,
      reservation: 8000,
      hours: 100,
      depositPct: 50,
      netDays: 7,
      revisions: 2,
      platformFeePct: 5,
      flags: [],
    };
    const summary = computeFreelanceMediation(dev, client, "USD");
    assert.equal(summary.hasZopa, true);
    assert.equal(summary.settlement, 7500);
    assert.equal(summary.budget.gap, 0);
    assert.equal(summary.budget.gapPct, 0);
    assert.equal(summary.confidence, "close");

    const bridge = computeBridgeOptions(dev, client, 100, 50, 7, 2, 0, "USD");
    assert.equal(bridge.publicGap, 0);
    assert.equal(bridge.recommendedBudget, 7500);
  });
});

describe("E2E Store Privacy Redaction, HMAC Capability Token, Rate Limiting & Validation", () => {
  const sampleDevPos: DealPosition = {
    budget: 8000,
    reservation: 6500,
    hours: 120,
    depositPct: 50,
    netDays: 7,
    revisions: 2,
    platformFeePct: 5,
    targetHourlyRate: 60,
    flags: ["Strict deadline"],
    reason: "Full-stack Next.js SaaS build",
  };

  const sampleClientPos: DealPosition = {
    budget: 6800,
    reservation: 7800,
    hours: 110,
    depositPct: 50,
    netDays: 14,
    revisions: 2,
    platformFeePct: 5,
    maxBudgetCeiling: 7800,
    flags: [],
    reason: "Q3 launch target",
  };

  it("enforces pre-reveal blindness: Party B never sees Party A numbers while waiting", () => {
    const waitingRecord: NegotiationRecord = {
      id: "sess_test_01",
      ownerToken: "secret_owner_token_123456",
      createdAt: new Date().toISOString(),
      projectTitle: "E-Commerce Checkout Revamp",
      currency: "USD",
      creatorRole: "developer",
      positionA: sampleDevPos,
      positionB: null,
      hasZopa: null,
      settlement: null,
      zopaLow: null,
      zopaHigh: null,
      summary: null,
      rationale: null,
      draftMessage: null,
    };

    const ownerView = toPublicView(waitingRecord, "secret_owner_token_123456");
    assert.equal(ownerView.status, "waiting");
    assert.equal(ownerView.viewerSide, "A");
    if (ownerView.status === "waiting" && ownerView.viewerSide === "A") {
      assert.equal(ownerView.positionA.budget, 8000);
      assert.equal(ownerView.positionA.reservation, 6500);
    }

    const responderView = toPublicView(waitingRecord, null);
    assert.equal(responderView.status, "waiting");
    assert.equal(responderView.viewerSide, "B");
    assert.equal("positionA" in responderView, false);
  });

  it("enforces post-reveal walk-away redaction and issues HMAC draftToken only to participants", () => {
    const { summary, zopa } = computeFreelanceMediationWithBounds(
      sampleDevPos,
      sampleClientPos,
      "USD"
    );

    const revealedRecord: NegotiationRecord = {
      id: "sess_test_02",
      ownerToken: "secret_owner_token_abcdef",
      createdAt: new Date().toISOString(),
      projectTitle: "E-Commerce Checkout Revamp",
      currency: "USD",
      creatorRole: "developer",
      positionA: sampleDevPos,
      positionB: sampleClientPos,
      hasZopa: summary.hasZopa,
      settlement: summary.settlement,
      zopaLow: zopa.zopaLow,
      zopaHigh: zopa.zopaHigh,
      summary,
      rationale: "Both parties aligned around $7,400.",
      draftMessage: "Hi, let us lock in $7,400 for 115 hours.",
    };

    const creatorView = toPublicView(revealedRecord, "secret_owner_token_abcdef");
    assert.equal(creatorView.status, "revealed");
    if (creatorView.status === "revealed") {
      assert.equal(creatorView.viewerSide, "A");
      assert.equal("reservation" in creatorView.developer, false);
      assert.equal("reservation" in creatorView.client, false);
      assert.equal("targetHourlyRate" in creatorView.developer, false);
      assert.equal("maxBudgetCeiling" in creatorView.client, false);
      assert.equal(typeof creatorView.draftToken, "string");
      assert.equal(typeof creatorView.summary.developerEconomics.targetDeltaPct, "number");
    }

    const responderCapToken = deriveDraftAccessToken(
      revealedRecord.id,
      revealedRecord.ownerToken
    );
    const clientView = toPublicView(revealedRecord, responderCapToken);
    if (clientView.status === "revealed") {
      assert.equal(clientView.viewerSide, "B");
      assert.equal(clientView.viewerRole, "client");
      // Developer's private targetDeltaPct is redacted for Client viewer
      assert.equal(clientView.summary.developerEconomics.targetDeltaPct, null);
      assert.equal(clientView.draftToken, responderCapToken);
    }

    const spectatorView = toPublicView(revealedRecord, "wrong_token");
    if (spectatorView.status === "revealed") {
      assert.equal(spectatorView.viewerSide, "spectator");
      assert.equal(spectatorView.draftToken, undefined);
      assert.equal(spectatorView.summary.developerEconomics.targetDeltaPct, null);
    }
  });

  it("enforces payload validation guardrails and sliding-window rate limits", () => {
    assert.equal(parseCurrency("idr"), "IDR");
    assert.equal(parseCurrency("INVALID"), "USD");
    assert.equal(parseRole("developer"), "developer");
    assert.equal(parseRole("hacker"), null);

    // Developer minimum cannot exceed quote
    const invalidDev = parseDealPositionPayload(
      {
        budget: 5000,
        reservation: 6000,
        hours: 80,
        depositPct: 50,
        netDays: 7,
        revisions: 2,
        platformFeePct: 0,
      },
      "developer"
    );
    assert.equal(invalidDev.ok, false);

    // Client maximum ceiling cannot be below offer
    const invalidClient = parseDealPositionPayload(
      {
        budget: 6000,
        reservation: 5000,
        hours: 80,
        depositPct: 50,
        netDays: 7,
        revisions: 2,
        platformFeePct: 0,
      },
      "client"
    );
    assert.equal(invalidClient.ok, false);

    // Sliding-window rate limit blocks requests exceeding quota
    const testKey = `test_rate_key_${Date.now()}`;
    assert.equal(checkRateLimit(testKey, 2, 60_000), true);
    assert.equal(checkRateLimit(testKey, 2, 60_000), true);
    assert.equal(checkRateLimit(testKey, 2, 60_000), false);
  });
});
