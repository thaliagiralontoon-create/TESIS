// Activa a los técnicos y colaboradores importados del histórico y completa el área de cada colaborador
// con el área desde la que registró la mayoría de sus incidencias.
// Las especialidades no se infieren: en el histórico la categoría no determinaba al técnico.
// Uso local: pnpm usuarios:preparar   ·   En Neon: $env:DATABASE_URL="..."; pnpm usuarios:preparar
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getLocalDatabase, closeLocalDatabase } from "../src/db/local-client";
import { incidencias, schema, usuarios } from "../src/db/schema";

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  const db = url ? drizzle(neon(url), { schema }) : await getLocalDatabase();
  const people = await db.select().from(usuarios).where(inArray(usuarios.rol, ["tecnico", "colaborador"]));
  const reported = await db.select({ usuarioId: incidencias.usuarioId, areaId: incidencias.areaId }).from(incidencias).where(and(isNotNull(incidencias.usuarioId), isNotNull(incidencias.areaId)));
  const counts = new Map<number, Map<number, number>>();
  for (const row of reported) { const byArea = counts.get(row.usuarioId!) ?? new Map(); byArea.set(row.areaId!, (byArea.get(row.areaId!) ?? 0) + 1); counts.set(row.usuarioId!, byArea); }
  let activated = 0, withArea = 0;
  for (const person of people) {
    const top = [...(counts.get(person.id) ?? new Map()).entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const areaId = person.areaId ?? (person.rol === "colaborador" ? top : undefined) ?? null;
    if (person.activo && areaId === person.areaId) continue;
    await db.update(usuarios).set({ activo: true, areaId }).where(eq(usuarios.id, person.id));
    if (!person.activo) activated++;
    if (areaId && !person.areaId) withArea++;
  }
  console.log(`${people.length} usuarios revisados · ${activated} activados · ${withArea} con área asignada`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => process.env.DATABASE_URL ? undefined : closeLocalDatabase());
