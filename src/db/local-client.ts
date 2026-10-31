import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { schema } from "./schema";

declare global {
  var nakamaLocalDbPromise: Promise<PgliteDatabase<typeof schema>> | undefined;
  var nakamaPgliteClient: PGlite | undefined;
}

export function getLocalDatabase(): Promise<PgliteDatabase<typeof schema>> {
  if (!globalThis.nakamaLocalDbPromise) {
    globalThis.nakamaLocalDbPromise = (async () => {
      const configuredPath = process.env.NAKAMA_LOCAL_DB_DIR?.trim();
      const dataDirectory = configuredPath ? resolve(process.cwd(), configuredPath) : resolve(process.cwd(), ".local", "nakama");
      await mkdir(dirname(dataDirectory), { recursive: true });
      const client = new PGlite(dataDirectory);
      globalThis.nakamaPgliteClient = client;
      await client.waitReady;
      const db = drizzle(client, { schema });
      await migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
      return db;
    })();
  }
  return globalThis.nakamaLocalDbPromise;
}

export async function closeLocalDatabase() {
  await globalThis.nakamaPgliteClient?.close();
  globalThis.nakamaPgliteClient = undefined;
  globalThis.nakamaLocalDbPromise = undefined;
  globalThis.nakamaDbPromise = undefined;
}
