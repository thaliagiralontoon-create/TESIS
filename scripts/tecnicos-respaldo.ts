// Cuenta las incidencias por técnico en un respaldo JSON del histórico (solo lectura).
// Uso: $env:DATABASE_URL="..."; pnpm exec tsx scripts/tecnicos-respaldo.ts respaldo.json
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL?.trim(); const file = process.argv[2]; if (!url || !file) throw new Error("Indica el respaldo y DATABASE_URL.");
  const { incidencias } = JSON.parse(readFileSync(file, "utf8")) as { incidencias: Array<{ tecnicoId: number | null; registradaEn: string }> };
  const codigos = new Map((await neon(url)`select id, codigo from usuarios`).map((u) => [u.id as number, u.codigo as string]));
  const porTecnico = new Map<string, { n: number; desde: string; hasta: string }>();
  for (const i of incidencias) {
    const codigo = i.tecnicoId ? codigos.get(i.tecnicoId) ?? `id ${i.tecnicoId}` : "Sin técnico"; const fecha = i.registradaEn.slice(0, 10);
    const actual = porTecnico.get(codigo) ?? { n: 0, desde: fecha, hasta: fecha };
    porTecnico.set(codigo, { n: actual.n + 1, desde: fecha < actual.desde ? fecha : actual.desde, hasta: fecha > actual.hasta ? fecha : actual.hasta });
  }
  console.table([...porTecnico].sort(([a], [b]) => a.localeCompare(b)).map(([codigo, v]) => ({ codigo, ...v })));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
