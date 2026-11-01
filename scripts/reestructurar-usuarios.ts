// Deja como usuarios activos solo al personal actual de la empresa: 2 técnicos de TIC (atienden y asignan las incidencias)
// y los colaboradores de cada área, identificados con códigos (Ley 29733). Los usuarios anteriores no se borran: se
// desactivan, para que las incidencias del histórico conserven su técnico. La supervisión no se toca.
// Uso: $env:DATABASE_URL="..."; pnpm exec tsx scripts/reestructurar-usuarios.ts [--aplicar]
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, inArray, notInArray, sql } from "drizzle-orm";
import { areas, schema, usuarios } from "../src/db/schema";

// [área, prefijo del código, personas, rol]
const PERSONAL: Array<[string, string, number, "tecnico" | "colaborador"]> = [
  ["TIC", "TIC", 2, "tecnico"],
  ["Logística", "LOG", 2, "colaborador"],
  ["SAS", "SAS", 6, "colaborador"],
  ["Planificación", "PLA", 2, "colaborador"],
  ["Contabilidad", "CON", 2, "colaborador"],
  ["SSOMA", "SSO", 1, "colaborador"],
  ["Marketing", "MKT", 1, "colaborador"],
  ["Comercial", "COM", 4, "colaborador"],
  ["Ingeniería", "ING", 5, "colaborador"],
  ["Operaciones", "OPE", 4, "colaborador"],
  ["Gerencia", "GER", 2, "colaborador"],
  ["Gerencia General", "GG", 1, "colaborador"],
];

async function main() {
  const url = process.env.DATABASE_URL?.trim(); if (!url) throw new Error("Falta DATABASE_URL.");
  const aplicar = process.argv.includes("--aplicar");
  const db = drizzle(neon(url), { schema });
  const existentes = new Map((await db.select().from(areas)).map((a) => [a.nombre, a.id]));
  const nuevasAreas = PERSONAL.map(([area]) => area).filter((area) => !existentes.has(area));
  const personas = PERSONAL.flatMap(([area, prefijo, n, rol]) => Array.from({ length: n }, (_, i) => ({ codigo: `${prefijo}-${String(i + 1).padStart(2, "0")}`, area, rol })));
  const codigos = personas.map((p) => p.codigo);
  const [{ n: aDesactivar }] = await db.select({ n: sql<number>`count(*)::int` }).from(usuarios).where(and(inArray(usuarios.rol, ["colaborador", "tecnico"]), notInArray(usuarios.codigo, codigos), sql`${usuarios.activo}`));
  console.log(`Áreas nuevas: ${nuevasAreas.join(", ") || "ninguna"}`);
  console.log(`Usuarios a desactivar: ${aDesactivar}`);
  console.log(`Personal activo: ${personas.length} (${personas.filter((p) => p.rol === "tecnico").map((p) => p.codigo).join(", ")} como técnicos)`);
  if (!aplicar) { console.log("Vista previa; agrega --aplicar para guardar."); return; }

  if (nuevasAreas.length) for (const a of await db.insert(areas).values(nuevasAreas.map((nombre) => ({ nombre }))).returning()) existentes.set(a.nombre, a.id);
  await db.update(usuarios).set({ activo: false }).where(and(inArray(usuarios.rol, ["colaborador", "tecnico"]), notInArray(usuarios.codigo, codigos)));
  for (const p of personas) {
    await db.insert(usuarios).values({ codigo: p.codigo, nombre: p.codigo, rol: p.rol, areaId: existentes.get(p.area)!, activo: true })
      .onConflictDoUpdate({ target: usuarios.codigo, set: { rol: p.rol, areaId: existentes.get(p.area)!, activo: true } });
  }
  const resumen = await db.select({ rol: usuarios.rol, activo: usuarios.activo, n: sql<number>`count(*)::int` }).from(usuarios).groupBy(usuarios.rol, usuarios.activo);
  console.table(resumen);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
