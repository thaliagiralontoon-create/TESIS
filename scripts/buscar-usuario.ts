// Busca usuarios por código o por parte del correo, para revisar con qué cuenta entra cada persona,
// y muestra quién figura como solicitante en las 29 incidencias de la muestra.
// Uso: DATABASE_URL=... pnpm exec tsx scripts/buscar-usuario.ts COL-070 thalia
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  for (const q of process.argv.slice(2)) {
    const rows = await sql`select u.id, u.codigo, u.nombre, u.correo, u.rol, u.activo, a.nombre as area from usuarios u left join areas a on a.id = u.area_id where u.codigo = ${q} or u.correo ilike ${"%" + q + "%"} order by u.id`;
    console.log(`«${q}»:`, rows.length ? rows : "sin resultados");
  }
  const solicitantes = await sql`select u.codigo, u.activo, a.nombre as area_usuario, ai.nombre as area_incidencia, count(*)::int as n, string_agg(i.codigo, ', ' order by i.codigo) as incidencias
    from incidencias i left join usuarios u on u.id = i.usuario_id left join areas a on a.id = u.area_id left join areas ai on ai.id = i.area_id
    where i.codigo between 'NKM-INC-0001' and 'NKM-INC-0029' group by 1, 2, 3, 4 order by 5 desc`;
  console.log("Solicitantes de las 29:", solicitantes);
}

main();
