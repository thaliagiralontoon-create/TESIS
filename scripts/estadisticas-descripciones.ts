// Agrupa las incidencias cerradas por descripción y calcula su tiempo típico de atención.
// Uso: pnpm ml:descripciones -- ml/descripciones.json   (sirve para armar la base de conocimiento)
process.env.NAKAMA_LOCAL_DB = "1";
import { writeFileSync } from "node:fs";
import { getLocalDatabase, closeLocalDatabase } from "../src/db/local-client";
import { categorias, incidencias } from "../src/db/schema";

const quantile = (values: number[], q: number) => { const s = [...values].sort((a, b) => a - b); const p = (s.length - 1) * q; const b = Math.floor(p); return s[b] + ((s[Math.min(b + 1, s.length - 1)] - s[b]) * (p - b)); };

async function main() {
  const out = process.argv.slice(2).find((arg) => arg.endsWith(".json")) ?? "ml/descripciones.json";
  const db = await getLocalDatabase();
  const [rows, cats] = await Promise.all([db.select().from(incidencias), db.select().from(categorias)]);
  const names = new Map(cats.map((c) => [c.id, c.nombre]));
  const groups = new Map<string, { categorias: Map<string, number>; minutos: number[]; total: number }>();
  for (const r of rows.filter((x) => x.origen === "historico")) {
    const g = groups.get(r.descripcion) ?? { categorias: new Map<string, number>(), minutos: [] as number[], total: 0 };
    g.total++;
    const cat = names.get(r.categoriaConfirmadaId ?? 0); if (cat) g.categorias.set(cat, (g.categorias.get(cat) ?? 0) + 1);
    const end = r.cerradaEn ?? r.resueltaEn; if (end) g.minutos.push((end.getTime() - r.registradaEn.getTime()) / 60_000);
    groups.set(r.descripcion, g);
  }
  const result = [...groups.entries()].map(([descripcion, g]) => {
    const [categoria] = [...g.categorias.entries()].sort((a, b) => b[1] - a[1])[0] ?? [""];
    return { descripcion, categoria, casos: g.total, cerradas: g.minutos.length, medianaMin: g.minutos.length ? Math.round(quantile(g.minutos, 0.5)) : null, p75Min: g.minutos.length ? Math.round(quantile(g.minutos, 0.75)) : null, pctMas8h: g.minutos.length ? Math.round(1000 * g.minutos.filter((m) => m > 480).length / g.minutos.length) / 10 : null };
  }).sort((a, b) => a.categoria.localeCompare(b.categoria) || b.casos - a.casos);
  writeFileSync(out, JSON.stringify(result, null, 1), "utf8");
  console.log(`${result.length} descripciones distintas → ${out}`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(closeLocalDatabase);
