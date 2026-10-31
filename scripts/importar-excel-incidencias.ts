// Importa incidencias desde un Excel con el formato de la «Lista de incidencias» del sistema (hoja «Incidencias»):
// Código, Título, Descripción, Prioridad, Estado, Categoría confirmada, Técnico, Registrada, Resuelta, Cerrada (fechas en UTC).
// Uso: $env:DATABASE_URL="..."; pnpm exec tsx scripts/importar-excel-incidencias.ts archivo.xlsx [--origen=historico]
import ExcelJS from "exceljs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { categorias, incidenciaEventos, incidencias, schema, usuarios } from "../src/db/schema";

const clean = (s: unknown) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const asDate = (v: unknown) => v instanceof Date ? v : v ? new Date(String(v)) : null;

async function main() {
  const file = process.argv.find((a) => a.endsWith(".xlsx")); const origen = process.argv.find((a) => a.startsWith("--origen="))?.split("=")[1] ?? "historico";
  const url = process.env.DATABASE_URL?.trim(); if (!url || !file) throw new Error("Indica el .xlsx y DATABASE_URL.");
  const book = new ExcelJS.Workbook(); await book.xlsx.readFile(file);
  const sheet = book.getWorksheet("Incidencias") ?? book.worksheets[0];
  const col = new Map<string, number>(); sheet.getRow(1).eachCell((c, i) => col.set(clean(c.value), i));
  const get = (row: ExcelJS.Row, name: string) => { const i = col.get(name); return i ? row.getCell(i).value : null; };
  const db = drizzle(neon(url), { schema });
  const cats = new Map((await db.select().from(categorias)).map((c) => [c.nombre, c.id]));
  const techs = new Map((await db.select().from(usuarios)).map((u) => [u.codigo, u.id]));
  const filas: Array<typeof incidencias.$inferInsert> = []; const avisos: string[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const codigo = String(get(row, "codigo") ?? "").trim(); if (!codigo) return;
    const categoria = String(get(row, "categoria confirmada") ?? "").trim(); const tecnico = String(get(row, "tecnico") ?? "").trim();
    if (categoria && !cats.has(categoria)) avisos.push(`${codigo}: categoría desconocida «${categoria}»`);
    if (tecnico && !techs.has(tecnico)) avisos.push(`${codigo}: técnico desconocido «${tecnico}»`);
    const registrada = asDate(get(row, "registrada")); if (!registrada) { avisos.push(`${codigo}: sin fecha de registro`); return; }
    filas.push({ codigo, origen, titulo: String(get(row, "titulo") ?? "").slice(0, 160), descripcion: String(get(row, "descripcion") ?? ""), prioridad: String(get(row, "prioridad") ?? "Media"), estado: String(get(row, "estado") ?? "Abierto"), categoriaConfirmadaId: cats.get(categoria) ?? null, tecnicoId: techs.get(tecnico) ?? null, registradaEn: registrada, resueltaEn: asDate(get(row, "resuelta")), cerradaEn: asDate(get(row, "cerrada")) });
  });
  if (avisos.length) { console.log("Revisar:\n" + avisos.join("\n")); throw new Error("Corrige los avisos antes de importar."); }
  const creadas = await db.insert(incidencias).values(filas).onConflictDoNothing({ target: incidencias.codigo }).returning({ id: incidencias.id, codigo: incidencias.codigo, registradaEn: incidencias.registradaEn, resueltaEn: incidencias.resueltaEn, cerradaEn: incidencias.cerradaEn });
  const eventos = creadas.flatMap((c) => [{ incidenciaId: c.id, evento: "Registrada", detalle: `Importada (${origen})`, ocurridoEn: c.registradaEn }, ...(c.resueltaEn ? [{ incidenciaId: c.id, evento: "Resuelto", detalle: null, ocurridoEn: c.resueltaEn }] : []), ...(c.cerradaEn ? [{ incidenciaId: c.id, evento: "Cerrado", detalle: null, ocurridoEn: c.cerradaEn }] : [])]);
  if (eventos.length) await db.insert(incidenciaEventos).values(eventos);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(incidencias);
  console.log(`Importadas ${creadas.length} de ${filas.length} (las repetidas se omiten). Total en la base: ${n}`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
