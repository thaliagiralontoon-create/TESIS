// Aplica las migraciones pendientes de la carpeta drizzle/ en la base Neon de DATABASE_URL.
// Uso: $env:DATABASE_URL="postgresql://..."; pnpm db:migrar-neon
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("Define DATABASE_URL con la cadena de conexión de Neon.");
  await migrate(drizzle(neon(url)), { migrationsFolder: "drizzle" });
  console.log("Migraciones aplicadas en Neon.");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
