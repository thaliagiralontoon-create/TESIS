// Guarda en las 29 incidencias de la muestra la categoría sugerida por el modelo activo, su confianza y la versión del modelo,
// como haría el registro de una incidencia nueva (se importaron sin pasar por el formulario).
// Uso: DATABASE_URL=... pnpm exec tsx scripts/sugerencias-29.ts [--aplicar] [--respaldo=archivo.json]
import { writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { sugerir, type ModeloML } from "../src/lib/ml/clasificador";
import { MODELO } from "../src/lib/ml/modelos";

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const respaldo = process.argv.find((a) => a.startsWith("--respaldo="))?.split("=")[1];
  const sql = neon(process.env.DATABASE_URL!);
  const [activo] = await sql`select version, modelo_json from modelos_ml where activo and modelo_json is not null limit 1`;
  const modelo: ModeloML = activo ? JSON.parse(activo.modelo_json) : MODELO;
  const version: string = activo?.version ?? (MODELO as unknown as { version: string }).version;
  const categorias = new Map((await sql`select id, nombre from categorias`).map((c) => [c.nombre as string, c.id as number]));
  const rows = await sql`select id, codigo, titulo, descripcion, categoria_sugerida_id, confianza_sugerencia, modelo_version from incidencias where codigo between 'NKM-INC-0001' and 'NKM-INC-0029' order by codigo`;
  if (rows.length !== 29) throw new Error(`Se esperaban 29 incidencias y hay ${rows.length}`);
  if (respaldo) writeFileSync(respaldo, JSON.stringify(rows.map(({ id, codigo, categoria_sugerida_id, confianza_sugerencia, modelo_version }) => ({ id, codigo, categoria_sugerida_id, confianza_sugerencia, modelo_version })), null, 2));
  for (const r of rows) {
    const [top] = sugerir(modelo, r.titulo, r.descripcion ?? "", 1);
    const catId = categorias.get(top.categoria);
    if (!catId) throw new Error(`Categoría desconocida: ${top.categoria}`);
    console.log(r.codigo, "|", top.categoria, "|", (top.probabilidad * 100).toFixed(1), "%");
    if (aplicar) await sql`update incidencias set categoria_sugerida_id = ${catId}, confianza_sugerencia = ${top.probabilidad.toFixed(4)}, modelo_version = ${version} where id = ${r.id}`;
  }
  console.log(aplicar ? `Guardadas 29 sugerencias (modelo ${version}).` : `Simulación (modelo ${version}); use --aplicar para guardar.`);
}

main();
