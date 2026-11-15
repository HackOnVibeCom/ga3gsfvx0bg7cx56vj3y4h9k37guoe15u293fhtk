import {
  bigint,
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { CurrencyCode } from "@/lib/currency";
import type {
  DealPosition,
  FreelanceMediationSummary,
  PartyRole,
} from "@/lib/midpoint";

export const negotiations = pgTable("negotiations", {
  id: text("id").primaryKey(),
  ownerToken: text("owner_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

  projectTitle: text("project_title").notNull(),
  currency: text("currency").$type<CurrencyCode>().notNull().default("USD"),
  creatorRole: text("creator_role").$type<PartyRole>().notNull(),

  devOffer: bigint("dev_offer", { mode: "number" }),
  devReservation: bigint("dev_reservation", { mode: "number" }),
  devReason: text("dev_reason"),

  clientOffer: bigint("client_offer", { mode: "number" }),
  clientReservation: bigint("client_reservation", { mode: "number" }),
  clientReason: text("client_reason"),

  positionA: jsonb("position_a").$type<DealPosition>().notNull(),
  positionB: jsonb("position_b").$type<DealPosition | null>(),

  hasZopa: boolean("has_zopa"),
  settlement: bigint("settlement", { mode: "number" }),
  zopaLow: bigint("zopa_low", { mode: "number" }),
  zopaHigh: bigint("zopa_high", { mode: "number" }),

  summary: jsonb("summary").$type<FreelanceMediationSummary | null>(),
  rationale: text("rationale"),
  draftMessage: text("draft_message"),
});

export type NegotiationRow = typeof negotiations.$inferSelect;
export type NewNegotiationRow = typeof negotiations.$inferInsert;
