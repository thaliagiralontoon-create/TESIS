import { NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { areas, categorias, consultaRegistros, incidencias, usuarios } from "@/db/schema";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { mean, median } from "@/lib/indicadores";

export const runtime = "nodejs";
// Consulta rápida: una incidencia por código, o totales y tiempos de un grupo filtrado. Cada consulta se registra para I3.
export async function GET(request: Request) {
  const started = Date.now();
  try {
    const user = await getCurrentUser();
    if (user.rol === "colaborador") return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const q = new URL(request.url).searchParams;
    const db = await getDb();
    const [cats, people, areaRows] = await Promise.all([db.select().from(categorias), db.select({ id: usuarios.id, codigo: usuarios.codigo }).from(usuarios), db.select().from(areas)]);
    const catName = new Map(cats.map((c) => [c.id, c.nombre])); const code = new Map(people.map((p) => [p.id, p.codigo])); const areaName = new Map(areaRows.map((a) => [a.id, a.nombre]));
    const opciones = { categorias: cats.map((c) => c.nombre), tecnicos: people.filter((p) => p.codigo.startsWith("TEC")).map((p) => p.codigo).sort(), areas: areaRows.map((a) => a.nombre).sort() };
    if (q.get("solo") === "opciones") return NextResponse.json({ opciones });
    let payload: Record<string, unknown>;
    const codigo = q.get("codigo")?.trim().toUpperCase();
    if (codigo) {
      const [r] = await db.select().from(incidencias).where(eq(incidencias.codigo, codigo)).limit(1);
      if (!r) return NextResponse.json({ error: `No existe la incidencia ${codigo}.` }, { status: 404 });
      const fin = r.cerradaEn ?? r.resueltaEn;
      payload = { tipo: "incidencia", incidencia: { id: r.id, codigo: r.codigo, titulo: r.titulo, estado: r.estado, prioridad: r.prioridad, categoria: catName.get(r.categoriaConfirmadaId ?? r.categoriaSugeridaId ?? 0) ?? null, tecnico: code.get(r.tecnicoId ?? 0) ?? null, area: areaName.get(r.areaId ?? 0) ?? null, registradaEn: r.registradaEn, cierre: fin, minutos: fin ? Math.round((fin.getTime() - r.registradaEn.getTime()) / 60_000) : null } };
    } else {
      const desde = q.get("desde"), hasta = q.get("hasta"), origen = q.get("origen");
      const rows = await db.select().from(incidencias).where(and(desde ? gte(incidencias.registradaEn, new Date(`${desde}T00:00:00-05:00`)) : undefined, hasta ? lte(incidencias.registradaEn, new Date(`${hasta}T23:59:59.999-05:00`)) : undefined, origen && origen !== "todos" ? eq(incidencias.origen, origen) : undefined));
      const f = { categoria: q.get("categoria"), prioridad: q.get("prioridad"), tecnico: q.get("tecnico"), area: q.get("area"), estado: q.get("estado") };
      const sel = rows.filter((r) => (!f.categoria || catName.get(r.categoriaConfirmadaId ?? r.categoriaSugeridaId ?? 0) === f.categoria) && (!f.prioridad || r.prioridad === f.prioridad) && (!f.tecnico || code.get(r.tecnicoId ?? 0) === f.tecnico) && (!f.area || areaName.get(r.areaId ?? 0) === f.area) && (!f.estado || r.estado === f.estado));
      const min = sel.map((r) => { const fin = r.cerradaEn ?? r.resueltaEn; return fin ? (fin.getTime() - r.registradaEn.getTime()) / 60_000 : null; }).filter((m): m is number => m != null);
      payload = { tipo: "grupo", resultado: { incidencias: sel.length, cerradas: min.length, sinCierre: sel.length - min.length, promedioMin: mean(min), medianaMin: median(min), pctMas8h: min.length ? 100 * min.filter((m) => m > 480).length / min.length : null } };
    }
    const ms = Date.now() - started;
    await db.insert(consultaRegistros).values({ usuarioId: user.id, modulo: "Consulta rápida", solicitadaEn: new Date(), respuestaMs: ms, datosActualizados: true, inmediata: ms <= 3000 });
    return NextResponse.json({ ...payload, respuestaMs: ms, opciones }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Consulta rápida", error);
    return NextResponse.json({ error: "No se pudo hacer la consulta." }, { status: 500 });
  }
}
