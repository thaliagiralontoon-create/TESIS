import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { schema } from "./schema";
import { ensureLocalSupervisor } from "./seed";

export type AppDb = NeonHttpDatabase<typeof schema> | PgliteDatabase<typeof schema>;

declare global {
  var nakamaDbPromise: Promise<AppDb> | undefined;
}

async function createDatabase(): Promise<AppDb> {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (process.env.NAKAMA_ALLOW_REMOTE_DB === "1" && connectionString) {
    return drizzleNeon(neon(connectionString), { schema });
  }

  if (process.env.NODE_ENV !== "production" || process.env.NAKAMA_LOCAL_DB === "1") {
    const { getLocalDatabase } = await import("./local-client");
    const db = await getLocalDatabase();
    await ensureLocalSupervisor(db);
    return db;
  }

  throw new Error("La base local solo funciona en desarrollo. Para una base Neon propia, configura DATABASE_URL y NAKAMA_ALLOW_REMOTE_DB=1.");
}

export function getDb(): Promise<AppDb> {
  if (!globalThis.nakamaDbPromise) globalThis.nakamaDbPromise = createDatabase();
  return globalThis.nakamaDbPromise;
}
