import { NextResponse } from "next/server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categorias, incidenciaEventos, incidencias, usuarios } from "@/db/schema";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { chooseLeastLoaded } from "@/lib/flujo-incidencias";
import { MODELO_RIESGO } from "@/lib/ml/modelos";
import { compararDecisiones, decidir } from "@/lib/ml/riesgo";

export const runtime = "nodejs";
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (user.rol === "colaborador") return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const db = await getDb();
    const pending = and(isNull(incidencias.resueltaEn), isNull(incidencias.cerradaEn), user.rol === "tecnico" ? eq(incidencias.tecnicoId, user.id) : undefined);
    const [rows, cats, techs, lastEvents] = await Promise.all([
      db.select().from(incidencias).where(pending),
      db.select().from(categorias),
      db.select().from(usuarios).where(and(eq(usuarios.rol, "tecnico"), eq(usuarios.activo, true))),
      db.select({ id: incidenciaEventos.incidenciaId, ultimo: sql<string>`max(${incidenciaEventos.ocurridoEn})` }).from(incidenciaEventos).innerJoin(incidencias, eq(incidencias.id, incidenciaEventos.incidenciaId)).where(pending).groupBy(incidenciaEventos.incidenciaId),
    ]);
    const catNames = new Map(cats.map((c) => [c.id, c.nombre]));
    const techCodes = new Map(techs.map((t) => [t.id, t.codigo]));
    const last = new Map(lastEvents.map((e) => [e.id, new Date(e.ultimo)]));
    const assigned = techs.length ? await db.select({ techId: incidencias.tecnicoId }).from(incidencias).where(and(inArray(incidencias.estado, ["Asignado", "En proceso"]), inArray(incidencias.tecnicoId, techs.map((t) => t.id)))) : [];
    const loads = new Map<number, number>(); for (const row of assigned) if (row.techId) loads.set(row.techId, (loads.get(row.techId) || 0) + 1);
    const now = Date.now();
    const items = rows.map((r) => {
      const minutosAbierta = (now - r.registradaEn.getTime()) / 60_000;
      const ultimo = last.get(r.id) ?? r.asignadaEn ?? r.registradaEn;
      const categoriaId = r.categoriaConfirmadaId ?? r.categoriaSugeridaId;
      const decision = decidir(MODELO_RIESGO, { prioridad: r.prioridad, minutosAbierta, minutosSinMovimiento: (now - ultimo.getTime()) / 60_000, tieneTecnico: !!r.tecnicoId, categoriaConfirmada: !!r.categoriaConfirmadaId, confianza: r.confianzaSugerencia == null ? null : Number(r.confianzaSugerencia) });
      const sugerido = decision.accion === "Asignar técnico" ? chooseLeastLoaded(techs.filter((t) => t.especialidadId === categoriaId), techs, loads) : undefined;
      return { id: r.id, codigo: r.codigo, titulo: r.titulo, prioridad: r.prioridad, estado: r.estado, origen: r.origen, categoria: catNames.get(categoriaId ?? 0) ?? null, tecnico: techCodes.get(r.tecnicoId ?? 0) ?? null, registradaEn: r.registradaEn, minutosAbierta, ultimoMovimiento: ultimo, decision, tecnicoSugerido: sugerido?.codigo ?? null };
    }).sort(compararDecisiones);
    const resumen = items.reduce<Record<string, number>>((acc, item) => { acc[item.decision.accion] = (acc[item.decision.accion] || 0) + 1; return acc; }, {});
    return NextResponse.json({ modelo: { version: MODELO_RIESGO.version, algoritmo: MODELO_RIESGO.algoritmo, umbralMin: MODELO_RIESGO.umbral_min, metricas: MODELO_RIESGO.metricas }, total: items.length, activas: items.filter((i) => !i.decision.detenida).length, detenidas: items.filter((i) => i.decision.detenida).length, resumen, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("No se pudo priorizar", error);
    return NextResponse.json({ error: "No se pudo calcular la priorización." }, { status: 500 });
  }
}
