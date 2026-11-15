import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CURRENCIES, CURRENCY_LIST, formatMoney } from "./currency.ts";
import {
  computeMidpoint,
  computeEffectiveHourlyRate,
  computeFreelanceMediation,
  type DealPosition,
} from "./midpoint.ts";

describe("computeMidpoint deterministic engine", () => {
  it("handles wide gap (2000 vs 1200 -> 1600, wide)", () => {
    const res = computeMidpoint(2000, 1200);
    assert.equal(res.midpoint, 1600);
    assert.equal(res.confidence, "wide");
    assert.equal(Number(res.gapPct.toFixed(4)), 0.4);
  });

  it("handles close alignment (500 vs 450 -> 475, close)", () => {
    const res = computeMidpoint(500, 450);
    assert.equal(res.midpoint, 475);
    assert.equal(res.confidence, "close");
    assert.equal(Number(res.gapPct.toFixed(4)), 0.1);
  });

  it("handles exact match (100 vs 100 -> 100, close)", () => {
    const res = computeMidpoint(100, 100);
    assert.equal(res.midpoint, 100);
    assert.equal(res.confidence, "close");
    assert.equal(res.gapPct, 0);
  });

  it("handles zero vs positive offer (1000 vs 0 -> 500, wide)", () => {
    const res = computeMidpoint(1000, 0);
    assert.equal(res.midpoint, 500);
    assert.equal(res.confidence, "wide");
    assert.equal(res.gapPct, 1);
  });

  it("handles moderate gap (1000 vs 800 -> 900, moderate)", () => {
    const res = computeMidpoint(1000, 800);
    assert.equal(res.midpoint, 900);
    assert.equal(res.confidence, "moderate");
    assert.equal(Number(res.gapPct.toFixed(4)), 0.2);
  });

  it("guards against division by zero when both offers are 0", () => {
    const res = computeMidpoint(0, 0);
    assert.equal(res.midpoint, 0);
    assert.equal(res.gapPct, 0);
    assert.equal(res.confidence, "close");
  });
});

describe("computeEffectiveHourlyRate & computeFreelanceMediation", () => {
  it("calculates Vetly-style net budget and adjusted hours with overhead & revisions", () => {
    const res = computeEffectiveHourlyRate({
      budget: 8000,
      hours: 100,
      revisions: 4,
      platformFeePct: 10,
    });
    assert.equal(res.netBudget, 7200);
    assert.equal(res.revisionBufferPct, 10);
    assert.equal(res.adjustedHours, 120);
    assert.equal(res.effectiveRate, 60);
  });

  it("mediates all 6 freelance developer vs client parameters consistently", () => {
    const dev: DealPosition = {
      budget: 8000,
      hours: 120,
      depositPct: 50,
      netDays: 7,
      revisions: 2,
      platformFeePct: 3,
      targetHourlyRate: 60,
      flags: ["First-time client"],
      reason: "Full SaaS MVP with Stripe billing and deployment.",
    };
    const client: DealPosition = {
      budget: 6000,
      hours: 90,
      depositPct: 20,
      netDays: 30,
      revisions: 4,
      platformFeePct: 3,
      maxBudgetCeiling: 7200,
      flags: ["Milestone payout"],
      reason: "Seed sprint budget before demo day.",
    };

    const summary = computeFreelanceMediation(dev, client);
    assert.equal(summary.budget.midpoint, 7000);
    assert.equal(summary.hours.midpoint, 105);
    assert.equal(summary.depositPct.midpoint, 35);
    assert.equal(summary.netDays.midpoint, 19);
    assert.equal(summary.revisions.midpoint, 3);
    assert.equal(summary.depositAmount, 2450);
    assert.ok(summary.mediatedEconomics.effectiveRate > 0);
  });
});

describe("global ISO currency support", () => {
  it("supports broad world currencies and formats decimals accurately", () => {
    assert.ok(CURRENCY_LIST.length >= 150);
    assert.ok("USD" in CURRENCIES);
    assert.ok("IDR" in CURRENCIES);
    assert.ok("JPY" in CURRENCIES);
    assert.ok("AED" in CURRENCIES);
    assert.ok(!("UNKNOWN" in CURRENCIES));

    assert.equal(formatMoney(8000, "USD", 2), "$8,000.00");
    assert.equal(formatMoney(15000000, "IDR", 2), "Rp 15,000,000");
    assert.equal(formatMoney(500000, "JPY", 2), "¥500,000");
    assert.equal(formatMoney(1250.5, "EUR", 2), "€1,250.50");
    assert.equal(formatMoney(4000, "AED", 0), "AED 4,000");
  });
});
