// Une los procedimientos de ml/base_conocimiento_fuente.json con los tiempos reales del histórico.
// Uso: pnpm ml:base-conocimiento   →   src/lib/ml/base_conocimiento.json
process.env.NAKAMA_LOCAL_DB = "1";
import { readFileSync, writeFileSync } from "node:fs";
import { getLocalDatabase, closeLocalDatabase } from "../src/db/local-client";
import { incidencias } from "../src/db/schema";

type Fuente = { id: string; categoria: string; titulo: string; remoto: boolean; repuesto: string | null; pasos: string[]; palabras: string; descripciones: string[] };
const quantile = (values: number[], q: number) => { const s = [...values].sort((a, b) => a - b); const p = (s.length - 1) * q; const b = Math.floor(p); return s[b] + ((s[Math.min(b + 1, s.length - 1)] - s[b]) * (p - b)); };

async function main() {
  const fuente = JSON.parse(readFileSync("ml/base_conocimiento_fuente.json", "utf8")) as Fuente[];
  const byText = new Map<string, Fuente>(); for (const f of fuente) for (const d of f.descripciones) byText.set(d, f);
  const db = await getLocalDatabase();
  const rows = (await db.select().from(incidencias)).filter((r) => r.origen === "historico");
  const stats = new Map<string, { casos: number; minutos: number[] }>();
  const sinCubrir = new Set<string>();
  for (const r of rows) {
    const f = byText.get(r.descripcion); if (!f) { sinCubrir.add(r.descripcion); continue; }
    const s = stats.get(f.id) ?? { casos: 0, minutos: [] }; s.casos++;
    const end = r.cerradaEn ?? r.resueltaEn; if (end) s.minutos.push((end.getTime() - r.registradaEn.getTime()) / 60_000);
    stats.set(f.id, s);
  }
  if (sinCubrir.size) throw new Error(`Descripciones sin procedimiento: ${[...sinCubrir].join(" | ")}`);
  const salida = fuente.map((f) => {
    const s = stats.get(f.id) ?? { casos: 0, minutos: [] }; const m = s.minutos;
    return { id: f.id, categoria: f.categoria, titulo: f.titulo, remoto: f.remoto, repuesto: f.repuesto, pasos: f.pasos, texto: [f.titulo, f.palabras, ...f.descripciones].join(" "), casos: s.casos, cerradas: m.length, medianaMin: m.length ? Math.round(quantile(m, 0.5)) : null, p75Min: m.length ? Math.round(quantile(m, 0.75)) : null, pctMas8h: m.length ? Math.round(1000 * m.filter((x) => x > 480).length / m.length) / 10 : null };
  });
  writeFileSync("src/lib/ml/base_conocimiento.json", JSON.stringify({ version: new Date().toISOString().slice(0, 10), estado: "Propuesta pendiente de validación por el área de soporte", procedimientos: salida }), "utf8");
  console.log(`${salida.length} procedimientos · ${rows.length} incidencias históricas cubiertas`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(closeLocalDatabase);
