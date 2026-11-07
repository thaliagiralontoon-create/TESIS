// Cambia el código y el nombre de prueba del supervisor (SUP-LOCAL «Supervisor local») por uno definitivo.
// Uso: DATABASE_URL=... pnpm exec tsx scripts/renombrar-supervisor.ts [--aplicar]
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const [sup] = await sql`select id, codigo, nombre from usuarios where codigo = 'SUP-LOCAL'`;
  if (!sup) { console.log("No hay usuario SUP-LOCAL (ya se renombró)."); return; }
  const [ocupado] = await sql`select id from usuarios where codigo = 'SUP-01'`;
  if (ocupado) throw new Error("El código SUP-01 ya existe.");
  console.log(`${sup.codigo} «${sup.nombre}» -> SUP-01 «Supervisión TIC»`);
  if (process.argv.includes("--aplicar")) { await sql`update usuarios set codigo = 'SUP-01', nombre = 'Supervisión TIC' where id = ${sup.id}`; console.log("Aplicado."); }
}

main();
