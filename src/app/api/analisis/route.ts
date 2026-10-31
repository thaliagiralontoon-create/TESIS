import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { areas, incidencias, usuarios } from "@/db/schema";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { MODELO_RIESGO } from "@/lib/ml/modelos";
import { mesLima, nivelProbabilidad, pronosticar, probabilidadesReincidencia, serieMensual, validarPronostico, validarReincidencia } from "@/lib/ml/prediccion";
import { riesgoDemora } from "@/lib/ml/riesgo";

export const runtime = "nodejs";
const PRIORIDADES = ["Crítica", "Alta", "Media", "Baja"];
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (user.rol === "colaborador") return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const mes = new URL(request.url).searchParams.get("mes") || "";
    const db = await getDb();
    const [rows, people, areaRows] = await Promise.all([
      db.select({ id: incidencias.id, usuarioId: incidencias.usuarioId, prioridad: incidencias.prioridad, registradaEn: incidencias.registradaEn, resueltaEn: incidencias.resueltaEn, cerradaEn: incidencias.cerradaEn }).from(incidencias),
      db.select().from(usuarios).where(and(eq(usuarios.rol, "colaborador"), eq(usuarios.activo, true))),
      db.select().from(areas),
    ]);
    const now = new Date();
    const serie = serieMensual(rows.map((r) => r.registradaEn), now);
    const pronostico = pronosticar(serie);
    const errorPronostico = validarPronostico(serie);

    // Mezcla de prioridades del periodo base: el mes elegido o los últimos 90 días.
    const base = mes ? rows.filter((r) => mesLima(r.registradaEn) === mes) : rows.filter((r) => now.getTime() - r.registradaEn.getTime() <= 90 * 86_400_000);
    const porPrioridad = PRIORIDADES.map((p) => { const n = base.filter((r) => r.prioridad === p).length; return { prioridad: p, n, pct: base.length ? 100 * n / base.length : 0, riesgoDemora: 100 * riesgoDemora(MODELO_RIESGO, p, 0) }; }).filter((p) => p.n > 0);
    const riesgoEsperado = porPrioridad.reduce((s, p) => s + p.pct / 100 * p.riesgoDemora, 0);
    const pendientes = rows.filter((r) => !r.resueltaEn && !r.cerradaEn);
    const riesgo = riesgoEsperado;

    // Reincidencia por empleado (colaboradores que alguna vez reportaron).
    const codes = new Map(people.map((p) => [p.id, p]));
    const eventos = rows.filter((r) => r.usuarioId && codes.has(r.usuarioId)).map((r) => ({ usuario: String(r.usuarioId), fecha: r.registradaEn }));
    const reportantes = [...new Set(eventos.map((e) => e.usuario))];
    const probs = probabilidadesReincidencia(eventos, reportantes, now);
    const validacion = validarReincidencia(eventos, reportantes, now);
    const areaNames = new Map(areaRows.map((a) => [a.id, a.nombre]));
    const empleados = reportantes.map((id) => {
      const person = codes.get(Number(id))!; const p = probs.get(id)!;
      return { codigo: person.codigo, nombre: person.nombre, area: areaNames.get(person.areaId ?? 0) ?? "", actuales: pendientes.filter((r) => r.usuarioId === person.id).length, enElMes: mes ? rows.filter((r) => r.usuarioId === person.id && mesLima(r.registradaEn) === mes).length : null, ultimos90: p.recientes, probabilidad: 100 * p.probabilidad, proyeccion: nivelProbabilidad(p.probabilidad) };
    }).sort((a, b) => b.probabilidad - a.probabilidad);
    const top = empleados[0];
    const resumen = [
      pronostico ? `Se estiman ${pronostico.estimado} incidencias para ${pronostico.mes} (rango probable ${pronostico.minimo}–${pronostico.maximo}); la tendencia de los últimos meses está ${pronostico.tendencia}.` : "",
      top ? `${top.nombre}${top.area ? ` (${top.area})` : ""} tiene la mayor probabilidad de reportar una incidencia en los próximos 30 días (${top.probabilidad.toFixed(0)} %).` : "",
      `Con la mezcla de prioridades ${mes ? "del mes elegido" : "de los últimos 90 días"}, ${riesgo.toFixed(0)} % de las incidencias nuevas superaría 8 h de atención.`,
    ].filter(Boolean).join(" ");
    return NextResponse.json({
      meses: serie.map((p) => p.mes), mes,
      riesgo: { valor: riesgo, nivel: riesgo >= 25 ? "Alto" : riesgo >= 15 ? "Medio" : "Bajo", pendientes: pendientes.length },
      pronostico, errorPronostico, serie, porPrioridad, empleados, validacion, resumen,
      modelos: { riesgo: MODELO_RIESGO.version, pronostico: "Tendencia lineal de la tasa diaria mensual", reincidencia: "Poisson con suavizado gamma (90 días)" },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("No se pudo calcular el análisis predictivo", error);
    return NextResponse.json({ error: "No se pudo calcular el análisis predictivo." }, { status: 500 });
  }
}
