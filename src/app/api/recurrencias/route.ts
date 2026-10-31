import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { areas, incidencias, usuarios } from "@/db/schema";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { recomendarProcedimiento } from "@/lib/ml/asistente";
import { BASE_CONOCIMIENTO } from "@/lib/ml/modelos";
import { median } from "@/lib/indicadores";

export const runtime = "nodejs";
const DAY = 86_400_000;
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (user.rol === "colaborador") return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const db = await getDb();
    const [rows, people, areaRows] = await Promise.all([
      db.select({ id: incidencias.id, codigo: incidencias.codigo, titulo: incidencias.titulo, descripcion: incidencias.descripcion, prioridad: incidencias.prioridad, usuarioId: incidencias.usuarioId, areaId: incidencias.areaId, registradaEn: incidencias.registradaEn, resueltaEn: incidencias.resueltaEn, cerradaEn: incidencias.cerradaEn }).from(incidencias),
      db.select({ id: usuarios.id, codigo: usuarios.codigo, nombre: usuarios.nombre }).from(usuarios).where(eq(usuarios.rol, "colaborador")),
      db.select().from(areas),
    ]);
    // El tipo de falla se obtiene con el mismo buscador del asistente; se memoriza por texto porque se repiten mucho.
    const memo = new Map<string, string | null>();
    const tipo = (r: (typeof rows)[number]) => { const t = `${r.titulo} ${r.descripcion}`; if (!memo.has(t)) memo.set(t, recomendarProcedimiento(BASE_CONOCIMIENTO, t, null).procedimiento?.id ?? null); return memo.get(t)!; };
    const procs = new Map(BASE_CONOCIMIENTO.procedimientos.map((p) => [p.id, p]));
    const now = Date.now(); const last = Math.max(...rows.map((r) => r.registradaEn.getTime()), 0); const ref = Math.min(now, last + DAY);
    const minutos = (r: (typeof rows)[number]) => { const f = r.cerradaEn ?? r.resueltaEn; return f ? (f.getTime() - r.registradaEn.getTime()) / 60_000 : null; };

    const grupos = new Map<string, (typeof rows)>();
    for (const r of rows) { const k = tipo(r) ?? "sin-tipo"; (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(r); }
    const fallas = [...grupos.entries()].map(([id, g]) => {
      const t = g.map(minutos).filter((m): m is number => m != null);
      const recientes = g.filter((r) => ref - r.registradaEn.getTime() <= 90 * DAY).length, previas = g.filter((r) => { const a = ref - r.registradaEn.getTime(); return a > 90 * DAY && a <= 180 * DAY; }).length;
      const p = procs.get(id);
      return { id, titulo: p?.titulo ?? "Sin tipo conocido", categoria: p?.categoria ?? "", casos: g.length, usuarios: new Set(g.map((r) => r.usuarioId)).size, medianaMin: median(t), pctMas8h: t.length ? 100 * t.filter((m) => m > 480).length / t.length : null, ultimos90: recientes, previos90: previas, repuesto: p?.repuesto ?? null };
    }).sort((a, b) => b.casos - a.casos);

    const masLargas = rows.map((r) => ({ id: r.id, codigo: r.codigo, titulo: r.titulo, prioridad: r.prioridad, minutos: minutos(r) })).filter((r) => r.minutos != null).sort((a, b) => b.minutos! - a.minutos!).slice(0, 10);

    // Misma persona con el mismo tipo de falla dos o más veces en 30 días.
    const names = new Map(people.map((p) => [p.id, p])); const areaNames = new Map(areaRows.map((a) => [a.id, a.nombre]));
    const porPersona = new Map<string, (typeof rows)>();
    for (const r of rows) { const k = tipo(r); if (!r.usuarioId || !k) continue; const key = `${r.usuarioId}|${k}`; (porPersona.get(key) ?? porPersona.set(key, []).get(key)!).push(r); }
    const reincidentes = [...porPersona.entries()].flatMap(([key, g]) => {
      const fechas = g.map((r) => r.registradaEn.getTime()).sort((a, b) => a - b);
      let max = 1; for (let i = 0, j = 0; j < fechas.length; j++) { while (fechas[j] - fechas[i] > 30 * DAY) i++; max = Math.max(max, j - i + 1); }
      if (max < 2) return [];
      const [uid, pid] = key.split("|"); const person = names.get(Number(uid)); const p = procs.get(pid);
      return [{ persona: person ? (person.nombre === person.codigo ? person.codigo : `${person.nombre} (${person.codigo})`) : uid, area: areaNames.get(g[g.length - 1].areaId ?? 0) ?? "", falla: p?.titulo ?? pid, enTreintaDias: max, total: g.length, ultima: new Date(fechas[fechas.length - 1]), recomendacion: p?.categoria === "Hardware" || p?.repuesto ? "Evaluar reemplazo del equipo o accesorio" : "Revisar la causa de fondo o capacitar al usuario" }];
    }).sort((a, b) => b.enTreintaDias - a.enTreintaDias || b.total - a.total).slice(0, 30);
    return NextResponse.json({ fallas, masLargas, reincidentes }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Recurrencias", error);
    return NextResponse.json({ error: "No se pudieron calcular las fallas recurrentes." }, { status: 500 });
  }
}
