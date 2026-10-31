// Exporta las incidencias de la base local a CSV para entrenar el modelo de riesgo de demora.
// Uso: pnpm ml:exportar -- ml/incidencias_riesgo.csv
// Solo códigos: no incluye descripciones, nombres ni correos.
process.env.NAKAMA_LOCAL_DB = "1";
import { writeFileSync } from "node:fs";
import { getLocalDatabase, closeLocalDatabase } from "../src/db/local-client";
import { areas, categorias, incidencias, usuarios } from "../src/db/schema";

const csv = (value: unknown) => { const text = value == null ? "" : String(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };

async function main() {
  const out = process.argv.slice(2).find((arg) => arg.endsWith(".csv")) ?? "ml/incidencias_riesgo.csv";
  const db = await getLocalDatabase();
  const [rows, cats, areaRows, staff] = await Promise.all([db.select().from(incidencias), db.select().from(categorias), db.select().from(areas), db.select().from(usuarios)]);
  const catNames = new Map(cats.map((x) => [x.id, x.nombre])); const areaNames = new Map(areaRows.map((x) => [x.id, x.nombre])); const codes = new Map(staff.map((x) => [x.id, x.codigo]));
  const lines = ["codigo,origen,registrada,minutos,categoria,prioridad,area,tecnico,estado"];
  for (const r of rows) {
    const end = r.cerradaEn ?? r.resueltaEn;
    lines.push([r.codigo, r.origen, r.registradaEn.toISOString(), end ? (end.getTime() - r.registradaEn.getTime()) / 60_000 : "", catNames.get(r.categoriaConfirmadaId ?? r.categoriaSugeridaId ?? 0) ?? "", r.prioridad, areaNames.get(r.areaId ?? 0) ?? "", codes.get(r.tecnicoId ?? 0) ?? "", r.estado].map(csv).join(","));
  }
  writeFileSync(out, lines.join("\n"), "utf8");
  console.log(`${rows.length} incidencias exportadas a ${out}`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(closeLocalDatabase);
