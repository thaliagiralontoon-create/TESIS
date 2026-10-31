// Respalda, borra o restaura TODAS las incidencias (histórico y sistema) con sus eventos en la base Neon.
// Respaldar y borrar:  pnpm exec tsx scripts/incidencias-respaldo.ts borrar respaldo.json --confirmar
// Restaurar:           pnpm exec tsx scripts/incidencias-respaldo.ts restaurar respaldo.json
import { readFileSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { incidenciaEventos, incidencias, schema } from "../src/db/schema";

const DATES = ["registradaEn", "asignadaEn", "resueltaEn", "cerradaEn", "confirmadaEn", "ocurridoEn"];
const revive = (rows: Record<string, unknown>[]) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, DATES.includes(k) && v ? new Date(v as string) : v])));

async function main() {
  const [accion, file] = process.argv.slice(2);
  const url = process.env.DATABASE_URL?.trim(); if (!url || !file) throw new Error("Uso: borrar|restaurar archivo.json (con DATABASE_URL).");
  const db = drizzle(neon(url), { schema });
  if (accion === "borrar") {
    const inc = await db.select().from(incidencias); const ev = await db.select().from(incidenciaEventos);
    writeFileSync(file, JSON.stringify({ fecha: new Date().toISOString(), incidencias: inc, incidencia_eventos: ev }), "utf8");
    console.log(`Respaldo: ${inc.length} incidencias, ${ev.length} eventos`);
    if (!process.argv.includes("--confirmar")) return console.log("Sin --confirmar: no se borró nada.");
    await db.delete(incidenciaEventos); await db.delete(incidencias);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(incidencias);
    console.log(`Borrado. Incidencias restantes: ${n}`);
  } else if (accion === "restaurar") {
    const data = JSON.parse(readFileSync(file, "utf8"));
    const inc = revive(data.incidencias), ev = revive(data.incidencia_eventos);
    for (let i = 0; i < inc.length; i += 200) await db.insert(incidencias).values(inc.slice(i, i + 200) as never).onConflictDoNothing();
    for (let i = 0; i < ev.length; i += 200) await db.insert(incidenciaEventos).values(ev.slice(i, i + 200) as never).onConflictDoNothing();
    for (const t of ["incidencias", "incidencia_eventos"]) await db.execute(sql.raw(`select setval(pg_get_serial_sequence('${t}', 'id'), coalesce((select max(id) from ${t}), 0) + 1, false)`));
    console.log(`Restauradas ${inc.length} incidencias y ${ev.length} eventos`);
  } else throw new Error("Acción: borrar o restaurar");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
