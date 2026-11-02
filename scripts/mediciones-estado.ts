// Resumen de la tabla de mediciones (cuántas hay por fase, indicador y si están anuladas).
// Uso: DATABASE_URL=... pnpm exec tsx scripts/mediciones-estado.ts
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`select fase, indicador, anulada, count(*)::int as n, min(inicio) as desde, max(inicio) as hasta from mediciones group by 1, 2, 3 order by 1, 2, 3`;
  console.log(rows.length ? rows : "La tabla de mediciones está vacía.");
  const [sup] = await sql`select id, codigo, nombre from usuarios where rol = 'supervisor' and activo order by id limit 1`;
  console.log("Supervisor:", sup);
}

main();
