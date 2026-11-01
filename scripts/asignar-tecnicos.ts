// Corrige el técnico que atendió incidencias ya registradas (corrección de datos, sin evento de reasignación).
// Uso: $env:DATABASE_URL="..."; pnpm exec tsx scripts/asignar-tecnicos.ts TIC-01=NKM-INC-0001,NKM-INC-0003 TIC-02=NKM-INC-0002 [--aplicar]
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { inArray } from "drizzle-orm";
import { incidencias, schema, usuarios } from "../src/db/schema";

async function main() {
  const url = process.env.DATABASE_URL?.trim(); if (!url) throw new Error("Falta DATABASE_URL.");
  const aplicar = process.argv.includes("--aplicar");
  const grupos = process.argv.slice(2).filter((a) => a.includes("=")).map((a) => { const [tecnico, lista] = a.split("="); return { tecnico, codigos: lista.split(",").map((c) => c.trim()).filter(Boolean) }; });
  const todos = grupos.flatMap((g) => g.codigos);
  if (new Set(todos).size !== todos.length) throw new Error("Hay incidencias repetidas en la lista.");
  const db = drizzle(neon(url), { schema });
  const techs = new Map((await db.select().from(usuarios).where(inArray(usuarios.codigo, grupos.map((g) => g.tecnico)))).map((u) => [u.codigo, u]));
  const existentes = new Set((await db.select({ codigo: incidencias.codigo }).from(incidencias).where(inArray(incidencias.codigo, todos))).map((i) => i.codigo));
  for (const g of grupos) {
    const tech = techs.get(g.tecnico); if (!tech || tech.rol !== "tecnico") throw new Error(`${g.tecnico} no es un técnico.`);
    const faltan = g.codigos.filter((c) => !existentes.has(c)); if (faltan.length) throw new Error(`No existen: ${faltan.join(", ")}`);
    console.log(`${g.tecnico}: ${g.codigos.length} incidencias`);
    if (aplicar) await db.update(incidencias).set({ tecnicoId: tech.id }).where(inArray(incidencias.codigo, g.codigos));
  }
  console.log(aplicar ? `${todos.length} incidencias actualizadas.` : "Vista previa; agrega --aplicar para guardar.");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
