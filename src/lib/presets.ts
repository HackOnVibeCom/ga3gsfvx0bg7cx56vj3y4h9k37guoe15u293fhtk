import type { CurrencyCode } from "./currency";
import type { DealPosition } from "./midpoint";

export interface FreelancePreset {
  id: string;
  label: string;
  badge: string;
  icon: "rocket" | "warning" | "building";
  projectTitle: string;
  currency: CurrencyCode;
  developer: DealPosition;
  client: DealPosition;
}

export const FREELANCE_PRESETS: FreelancePreset[] = [
  {
    id: "saas-mvp",
    label: "SaaS MVP Build",
    badge: "Balanced",
    icon: "rocket",
    projectTitle: "SaaS MVP Build — Auth, Analytics Dashboard & Stripe Billing",
    currency: "USD",
    developer: {
      budget: 8000,
      hours: 120,
      depositPct: 50,
      netDays: 7,
      revisions: 2,
      platformFeePct: 3,
      targetHourlyRate: 60,
      flags: [],
      reason:
        "Covers full-stack Next.js architecture, Auth, Stripe webhooks, QA, and production deploy over 3 weeks.",
    },
    client: {
      budget: 6800,
      hours: 100,
      depositPct: 30,
      netDays: 14,
      revisions: 3,
      platformFeePct: 3,
      maxBudgetCeiling: 7500,
      flags: ["Milestone payout"],
      reason:
        "Seed sprint allocation ahead of beta launch, with potential Phase 2 retainer after initial traction.",
    },
  },
  {
    id: "fixed-webapp",
    label: "High-Risk Fixed Scope",
    badge: "Wide Gap",
    icon: "warning",
    projectTitle: "Custom E-Commerce Admin & Inventory Sync Portal",
    currency: "USD",
    developer: {
      budget: 4800,
      hours: 90,
      depositPct: 50,
      netDays: 7,
      revisions: 2,
      platformFeePct: 10,
      targetHourlyRate: 50,
      flags: ["No signed SOW", "Vague specs"],
      reason:
        "Custom ERP sync and multi-role inventory permissions require thorough edge-case testing and clear SOW.",
    },
    client: {
      budget: 1800,
      hours: 60,
      depositPct: 0,
      netDays: 30,
      revisions: 5,
      platformFeePct: 10,
      maxBudgetCeiling: 2500,
      flags: ["Fixed budget cap", "Strict deadline"],
      reason:
        "Internal pilot budget is tightly capped at 1,800 with payment triggered after final store sign-off.",
    },
  },
  {
    id: "enterprise-api",
    label: "Enterprise Net-60",
    badge: "Net Terms",
    icon: "building",
    projectTitle: "Enterprise API Gateway & Billing Migration",
    currency: "USD",
    developer: {
      budget: 16000,
      hours: 140,
      depositPct: 40,
      netDays: 14,
      revisions: 2,
      platformFeePct: 0,
      targetHourlyRate: 95,
      flags: ["First-time client"],
      reason:
        "Zero-downtime API migration requires staging load tests, documentation, and dedicated senior engineering hours.",
    },
    client: {
      budget: 12500,
      hours: 120,
      depositPct: 20,
      netDays: 60,
      revisions: 3,
      platformFeePct: 0,
      maxBudgetCeiling: 15000,
      flags: ["Post-launch support"],
      reason:
        "Procurement policy defaults to Net-60 invoicing with 20% kickoff PO and 2 weeks post-launch stabilization.",
    },
  },
];

export const DEVELOPER_RED_FLAGS = [
  "No signed SOW",
  "Vague specs",
  "Tight deadline",
  "First-time client",
] as const;

export const CLIENT_PRIORITIES = [
  "Strict deadline",
  "Fixed budget cap",
  "Post-launch support",
  "Milestone payout",
] as const;

export const PLATFORM_FEE_PRESETS = [
  { label: "Direct", value: 0 },
  { label: "Stripe", value: 3 },
  { label: "Upwork", value: 10 },
  { label: "Fiverr", value: 20 },
] as const;
