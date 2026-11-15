import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema.ts";

const globalForDb = globalThis as typeof globalThis & {
  __midpointDb?: NeonHttpDatabase<typeof schema> | null;
};

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL);
}

export function getDb(): NeonHttpDatabase<typeof schema> | null {
  const connectionString =
    process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
  if (!connectionString) return null;

  if (!globalForDb.__midpointDb) {
    const sql = neon(connectionString);
    globalForDb.__midpointDb = drizzle(sql, { schema });
  }

  return globalForDb.__midpointDb;
}
