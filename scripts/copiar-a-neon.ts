// Copia la base local (.local/nakama) a una Neon propia, conservando los id.
// Uso: $env:DATABASE_URL="postgresql://..."; pnpm db:copiar-neon -- correo.supervisor@empresa.com
// No copia reporte_registros ni consulta_registros: son registros de las pruebas locales, no de la operación.
process.env.NAKAMA_LOCAL_DB = "1";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { eq, sql } from "drizzle-orm";
import { getLocalDatabase, closeLocalDatabase } from "../src/db/local-client";
import { actividades, areas, categorias, incidenciaEventos, incidencias, mediciones, modelosMl, schema, usuarios, verificaciones } from "../src/db/schema";

const TABLAS = [
  ["areas", areas], ["categorias", categorias], ["usuarios", usuarios], ["incidencias", incidencias],
  ["incidencia_eventos", incidenciaEventos], ["verificaciones", verificaciones], ["actividades", actividades],
  ["modelos_ml", modelosMl], ["mediciones", mediciones],
] as const;

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("Define DATABASE_URL con la cadena de conexión de Neon.");
  const supervisorEmail = process.argv.slice(2).find((arg) => arg.includes("@"))?.trim().toLowerCase();
  const remote = drizzle(neon(url), { schema });
  await migrate(remote, { migrationsFolder: "drizzle" });
  const [{ total }] = await remote.select({ total: sql<number>`count(*)::int` }).from(incidencias);
  if (total > 0) throw new Error(`Neon ya tiene ${total} incidencias; no se copia para no duplicar datos.`);
  const local = await getLocalDatabase();
  for (const [name, table] of TABLAS) {
    const rows = await local.select().from(table);
    for (let i = 0; i < rows.length; i += 200) await remote.insert(table).values(rows.slice(i, i + 200) as never);
    await remote.execute(sql.raw(`select setval(pg_get_serial_sequence('${name}', 'id'), coalesce((select max(id) from ${name}), 0) + 1, false)`));
    console.log(`${name}: ${rows.length} filas`);
  }
  if (supervisorEmail) {
    const [updated] = await remote.update(usuarios).set({ correo: supervisorEmail }).where(eq(usuarios.codigo, "SUP-LOCAL")).returning();
    console.log(updated ? `Supervisor con correo ${supervisorEmail}` : "No se encontró SUP-LOCAL para asignar el correo.");
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(closeLocalDatabase);
