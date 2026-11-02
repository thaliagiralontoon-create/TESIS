// Indicador de automatización de procesos en las 29 incidencias de la muestra: categoría que sugiere el modelo activo
// del sistema (el mismo que usa el Asistente ML), su probabilidad y si coincide con la confirmada.
// Uso: DATABASE_URL=... pnpm exec tsx scripts/automatizacion-29.ts
import { neon } from "@neondatabase/serverless";
import { sugerir, type ModeloML } from "../src/lib/ml/clasificador";
import { MODELO } from "../src/lib/ml/modelos";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const [activo] = await sql`select version, modelo_json from modelos_ml where activo and modelo_json is not null limit 1`;
  const modelo: ModeloML = activo ? JSON.parse(activo.modelo_json) : MODELO;
  console.log("Modelo:", activo ? `versión ${activo.version} (activada desde el sistema)` : "incluido en el sistema (modelo.json)");
  const rows = await sql`
    select i.codigo, i.titulo, i.descripcion, cc.nombre as confirmada
    from incidencias i left join categorias cc on cc.id = i.categoria_confirmada_id
    where i.codigo between 'NKM-INC-0001' and 'NKM-INC-0029' order by i.codigo`;
  let con = 0, aciertos = 0, bajas = 0;
  for (const r of rows) {
    const [top] = sugerir(modelo, r.titulo, r.descripcion ?? "", 1);
    if (top) con++;
    if (top?.categoria === r.confirmada) aciertos++;
    if (top && top.probabilidad < 0.6) bajas++;
    console.log(r.codigo, "|", top?.categoria ?? "(sin sugerencia)", "|", top ? (top.probabilidad * 100).toFixed(1) + " %" : "-", "|", r.confirmada);
  }
  console.log(`Total: ${rows.length}; con categoría sugerida: ${con} (${((con / rows.length) * 100).toFixed(1)} %); coincide con la confirmada: ${aciertos}; confianza < 60 %: ${bajas}`);
}

main();
