// Cuenta los registros de cada tabla que alimenta los módulos del sistema y muestra de dónde vienen los registros
// de reportes y consultas (fechas, responsable y tipo).
// Uso: DATABASE_URL=... pnpm exec tsx scripts/estado-modulos.ts
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const tablas = ["incidencias", "incidencia_eventos", "reporte_registros", "consulta_registros", "verificaciones", "actividades", "modelos_ml", "mediciones", "usuarios", "areas", "categorias"];
  for (const t of tablas) { const [r] = await sql.query(`select count(*)::int as n from ${t}`); console.log(t.padEnd(20), r.n); }
  for (const t of ["reporte_registros", "consulta_registros"]) {
    const cols = await sql`select column_name from information_schema.columns where table_name = ${t} order by ordinal_position`;
    console.log(t, cols.map((c) => c.column_name).join(", "));
    console.log(await sql.query(`select * from ${t} order by 1 limit 3`));
    console.log(await sql.query(`select date_trunc('day', creado_en) as dia, count(*)::int as n from ${t} group by 1 order by 1`));
  }
}

main();
