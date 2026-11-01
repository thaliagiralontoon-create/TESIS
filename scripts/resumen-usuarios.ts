// Resumen de usuarios por rol y área, y técnicos que atienden las incidencias registradas (solo lectura).
// Uso: $env:DATABASE_URL="..."; pnpm exec tsx scripts/resumen-usuarios.ts
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL?.trim(); if (!url) throw new Error("Falta DATABASE_URL.");
  const q = neon(url);
  console.log("Usuarios por rol, área y estado:");
  console.table(await q`select u.rol, coalesce(a.nombre, '—') as area, u.activo, count(*)::int as n from usuarios u left join areas a on a.id = u.area_id group by 1, 2, 3 order by 1, 2`);
  console.log("Áreas:", (await q`select nombre from areas order by nombre`).map((a) => a.nombre).join(", "));
  console.log("Técnicos de las incidencias registradas:");
  console.table(await q`select t.codigo, t.nombre, t.activo, count(*)::int as incidencias from incidencias i join usuarios t on t.id = i.tecnico_id group by 1, 2, 3 order by 4 desc`);
  console.log("Incidencias con solicitante:", (await q`select count(*)::int as n from incidencias where usuario_id is not null`)[0].n);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
