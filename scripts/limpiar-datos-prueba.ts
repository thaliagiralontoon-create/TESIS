// Respalda y elimina los datos de prueba de la base Neon para empezar las mediciones desde cero.
// Conserva el histórico (origen = 'historico'), los usuarios, las categorías y el modelo original.
// Uso: $env:DATABASE_URL="..."; pnpm exec tsx scripts/limpiar-datos-prueba.ts respaldo.json --confirmar
import { writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray, isNotNull, ne } from "drizzle-orm";
import { actividades, consultaRegistros, incidenciaEventos, incidencias, mediciones, modelosMl, reporteRegistros, schema, verificaciones } from "../src/db/schema";
import { MODELO } from "../src/lib/ml/modelos";

async function main() {
  const url = process.env.DATABASE_URL?.trim(); if (!url) throw new Error("Define DATABASE_URL.");
  const out = process.argv.find((a) => a.endsWith(".json")); if (!out) throw new Error("Indica el archivo de respaldo .json.");
  const db = drizzle(neon(url), { schema });
  const nuevas = await db.select().from(incidencias).where(eq(incidencias.origen, "sistema"));
  const ids = nuevas.map((r) => r.id);
  const respaldo = {
    fecha: new Date().toISOString(),
    incidencias: nuevas,
    incidencia_eventos: ids.length ? await db.select().from(incidenciaEventos).where(inArray(incidenciaEventos.incidenciaId, ids)) : [],
    mediciones: await db.select().from(mediciones),
    reporte_registros: await db.select().from(reporteRegistros),
    consulta_registros: await db.select().from(consultaRegistros),
    verificaciones: await db.select().from(verificaciones),
    actividades: await db.select().from(actividades),
    modelos_ml: await db.select().from(modelosMl).where(isNotNull(modelosMl.modeloJson)),
  };
  writeFileSync(out, JSON.stringify(respaldo, null, 1), "utf8");
  const resumen = Object.fromEntries(Object.entries(respaldo).filter(([k]) => k !== "fecha").map(([k, v]) => [k, (v as unknown[]).length]));
  console.log("Respaldo:", JSON.stringify(resumen));
  if (!process.argv.includes("--confirmar")) { console.log("Sin --confirmar: no se borró nada."); return; }

  if (ids.length) { await db.delete(incidenciaEventos).where(inArray(incidenciaEventos.incidenciaId, ids)); await db.delete(incidencias).where(inArray(incidencias.id, ids)); }
  await db.delete(mediciones); await db.delete(reporteRegistros); await db.delete(consultaRegistros); await db.delete(verificaciones); await db.delete(actividades);
  await db.delete(modelosMl).where(isNotNull(modelosMl.modeloJson));
  await db.update(modelosMl).set({ activo: false }).where(ne(modelosMl.version, MODELO.version));
  await db.update(modelosMl).set({ activo: true }).where(eq(modelosMl.version, MODELO.version));
  const [h] = await db.select({ n: incidencias.id }).from(incidencias).where(eq(incidencias.origen, "historico")).limit(1);
  console.log(`Limpieza hecha. Modelo activo: ${MODELO.version}. Histórico intacto: ${h ? "sí" : "NO"}`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
