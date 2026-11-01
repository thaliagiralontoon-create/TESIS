// Corrige el título, la descripción y la categoría confirmada de incidencias ya importadas, a partir de un Excel con el formato
// de la «Lista de incidencias» (hoja «Incidencias»: Código, Título, Descripción, Categoría confirmada). Solo cambia las que
// difieren; no toca fechas, prioridades ni técnicos.
// Uso: $env:DATABASE_URL="..."; pnpm exec tsx scripts/actualizar-textos-incidencias.ts archivo.xlsx [--aplicar]
import ExcelJS from "exceljs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { categorias, incidencias, schema } from "../src/db/schema";

const clean = (s: unknown) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

async function main() {
  const file = process.argv.find((a) => a.endsWith(".xlsx")); const aplicar = process.argv.includes("--aplicar");
  const url = process.env.DATABASE_URL?.trim(); if (!url || !file) throw new Error("Indica el .xlsx y DATABASE_URL.");
  const book = new ExcelJS.Workbook(); await book.xlsx.readFile(file);
  const sheet = book.getWorksheet("Incidencias") ?? book.worksheets[0];
  const col = new Map<string, number>(); sheet.getRow(1).eachCell((c, i) => col.set(clean(c.value), i));
  const get = (row: ExcelJS.Row, name: string) => String(row.getCell(col.get(name)!).value ?? "").trim();
  const db = drizzle(neon(url), { schema });
  const cats = await db.select().from(categorias); const catId = new Map(cats.map((c) => [c.nombre, c.id])); const catNombre = new Map(cats.map((c) => [c.id, c.nombre]));
  const actuales = new Map((await db.select({ codigo: incidencias.codigo, titulo: incidencias.titulo, descripcion: incidencias.descripcion, categoriaConfirmadaId: incidencias.categoriaConfirmadaId }).from(incidencias)).map((i) => [i.codigo, i]));
  const cambios: Array<{ codigo: string; titulo: string; descripcion: string; categoriaConfirmadaId: number | null }> = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const codigo = get(row, "codigo"); const actual = actuales.get(codigo); if (!actual) return;
    const titulo = get(row, "titulo").slice(0, 160); const descripcion = get(row, "descripcion");
    const categoria = col.has("categoria confirmada") ? get(row, "categoria confirmada") : null;
    if (categoria && !catId.has(categoria)) throw new Error(`${codigo}: categoría desconocida «${categoria}»`);
    const categoriaConfirmadaId = categoria ? catId.get(categoria)! : actual.categoriaConfirmadaId;
    if (titulo !== actual.titulo || descripcion !== actual.descripcion || categoriaConfirmadaId !== actual.categoriaConfirmadaId) {
      cambios.push({ codigo, titulo, descripcion, categoriaConfirmadaId });
      if (titulo !== actual.titulo) console.log(`${codigo}: «${actual.titulo}» → «${titulo}»`);
      if (categoriaConfirmadaId !== actual.categoriaConfirmadaId) console.log(`${codigo}: categoría ${catNombre.get(actual.categoriaConfirmadaId!) ?? "—"} → ${categoria}`);
    }
  });
  if (!aplicar) { console.log(`${cambios.length} cambios (vista previa; agrega --aplicar para guardarlos).`); return; }
  for (const c of cambios) await db.update(incidencias).set({ titulo: c.titulo, descripcion: c.descripcion, categoriaConfirmadaId: c.categoriaConfirmadaId }).where(eq(incidencias.codigo, c.codigo));
  console.log(`${cambios.length} incidencias actualizadas.`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
