import { NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { actividades, areas, categorias, consultaRegistros, incidencias, modelosMl, reporteRegistros, usuarios, verificaciones } from "@/db/schema";
import { classificationMetrics, i1, i2, i3, i4, i5, median, num } from "@/lib/indicadores";
import { getCurrentUser, AuthError } from "@/lib/auth";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const started = Date.now();
  try {
    const user = await getCurrentUser();
    if (user.rol === "colaborador") return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("desde"); const to = searchParams.get("hasta"); const selectedOrigin = searchParams.get("origen"); const origin = selectedOrigin === "todos" ? null : selectedOrigin;
    const db = await getDb();
    const range = (column: typeof incidencias.registradaEn) => and(from ? gte(column, new Date(`${from}T00:00:00-05:00`)) : undefined, to ? lte(column, new Date(`${to}T23:59:59.999-05:00`)) : undefined);
    const incidentRows = await db.select().from(incidencias).where(and(range(incidencias.registradaEn), origin ? eq(incidencias.origen, origin) : undefined));
    const closed = incidentRows.filter((row) => row.cerradaEn || row.resueltaEn);
    const reportRows = await db.select().from(reporteRegistros).where(and(from ? gte(reporteRegistros.inicio, new Date(`${from}T00:00:00-05:00`)) : undefined, to ? lte(reporteRegistros.inicio, new Date(`${to}T23:59:59.999-05:00`)) : undefined));
    const queryRows = await db.select().from(consultaRegistros).where(and(from ? gte(consultaRegistros.solicitadaEn, new Date(`${from}T00:00:00-05:00`)) : undefined, to ? lte(consultaRegistros.solicitadaEn, new Date(`${to}T23:59:59.999-05:00`)) : undefined));
    const verificationRows = await db.select().from(verificaciones).where(and(from ? gte(verificaciones.verificadoEn, new Date(`${from}T00:00:00-05:00`)) : undefined, to ? lte(verificaciones.verificadoEn, new Date(`${to}T23:59:59.999-05:00`)) : undefined));
    const activityRows = await db.select().from(actividades).where(and(from ? gte(actividades.programadaPara, new Date(`${from}T00:00:00-05:00`)) : undefined, to ? lte(actividades.programadaPara, new Date(`${to}T23:59:59.999-05:00`)) : undefined));
    const categoryRows = await db.select().from(categorias);
    const modelRows = await db.select().from(modelosMl).where(eq(modelosMl.activo, true)).limit(1);
    const staffRows = await db.select({ id: usuarios.id, codigo: usuarios.codigo, nombre: usuarios.nombre }).from(usuarios).where(eq(usuarios.rol, "tecnico"));
    const pred = incidentRows.filter((row) => row.categoriaConfirmadaId && row.categoriaSugeridaId);
    const names = new Map(categoryRows.map((row) => [row.id, row.nombre]));
    const ml = classificationMetrics(pred.map((row) => ({ expected: names.get(row.categoriaConfirmadaId!) || "", predicted: names.get(row.categoriaSugeridaId!) || "" })));
    const now = new Date();
    const overdueOpen = incidentRows.filter((row) => !row.resueltaEn && !row.cerradaEn && now.getTime() - row.registradaEn.getTime() > 24 * 60 * 60 * 1000).length;
    const byStatus = Object.entries(incidentRows.reduce<Record<string, number>>((acc, row) => { acc[row.estado] = (acc[row.estado] || 0) + 1; return acc; }, {})).map(([name, value]) => ({ name, value }));
    const byCategory = Object.entries(incidentRows.reduce<Record<string, number>>((acc, row) => { const key = names.get(row.categoriaConfirmadaId ?? row.categoriaSugeridaId ?? 0) || "Sin clasificar"; acc[key] = (acc[key] || 0) + 1; return acc; }, {})).map(([name, value]) => ({ name, value }));
    const monthly = Object.entries(closed.reduce<Record<string, number[]>>((acc, row) => {
      const date = row.cerradaEn || row.resueltaEn!; const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      (acc[key] ||= []).push((date.getTime() - row.registradaEn.getTime()) / 60_000); return acc;
    }, {})).map(([month, values]) => ({ month, median: median(values)!, n: values.length }));
    const staff = new Map(staffRows.map((row) => [row.id, row]));
    const openRows = incidentRows.filter((row) => !row.resueltaEn && !row.cerradaEn);
    const byTechnician = Object.entries(openRows.reduce<Record<string, { abiertas: number; vencidas: number }>>((acc, row) => {
      const person = row.tecnicoId ? staff.get(row.tecnicoId) : undefined;
      const key = !person ? "Sin asignar" : person.nombre === person.codigo ? person.codigo : `${person.codigo} · ${person.nombre}`;
      const item = (acc[key] ||= { abiertas: 0, vencidas: 0 }); item.abiertas++;
      if (now.getTime() - row.registradaEn.getTime() > 24 * 60 * 60 * 1000) item.vencidas++;
      return acc;
    }, {})).map(([tecnico, value]) => ({ tecnico, ...value })).sort((a, b) => b.abiertas - a.abiertas);
    const areaRows = await db.select().from(areas);
    const areaNames = new Map(areaRows.map((row) => [row.id, row.nombre]));
    const countBy = (key: (row: (typeof incidentRows)[number]) => string) => Object.entries(incidentRows.reduce<Record<string, number>>((acc, row) => { const k = key(row); acc[k] = (acc[k] || 0) + 1; return acc; }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const byPriority = ["Crítica", "Alta", "Media", "Baja"].map((name) => ({ name, value: incidentRows.filter((row) => row.prioridad === name).length })).filter((row) => row.value > 0);
    const byArea = countBy((row) => areaNames.get(row.areaId ?? 0) ?? "Sin área").map((row) => ({ ...row, pct: 100 * row.value / incidentRows.length }));
    const resolutionByCategory = Object.entries(closed.reduce<Record<string, number[]>>((acc, row) => { const key = names.get(row.categoriaConfirmadaId ?? row.categoriaSugeridaId ?? 0) || "Sin clasificar"; (acc[key] ||= []).push(((row.cerradaEn || row.resueltaEn)!.getTime() - row.registradaEn.getTime()) / 3_600_000); return acc; }, {})).map(([name, hours]) => ({ name, horas: hours.reduce((a, b) => a + b, 0) / hours.length, n: hours.length })).sort((a, b) => b.horas - a.horas);
    // Tendencia: por día si el periodo cubre hasta tres meses; si no, por mes (hora de Lima).
    const limaDay = (date: Date) => new Date(date.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
    const spanDays = incidentRows.length ? (Math.max(...incidentRows.map((r) => r.registradaEn.getTime())) - Math.min(...incidentRows.map((r) => r.registradaEn.getTime()))) / 86_400_000 : 0;
    const trendKey = spanDays <= 92 ? limaDay : (date: Date) => limaDay(date).slice(0, 7);
    const trend = countBy((row) => trendKey(row.registradaEn)).sort((a, b) => a.name.localeCompare(b.name));
    const startOfToday =new Date(new Date(now.getTime() - 5 * 3_600_000).toISOString().slice(0, 10) + "T00:00:00-05:00");
    const today = { registradas: incidentRows.filter((row) => row.registradaEn >= startOfToday).length, cerradas: closed.filter((row) => (row.cerradaEn || row.resueltaEn)! >= startOfToday).length };
    const payload = {
      indicadores: {
        I1: { valor: i1(reportRows.map((row) => row.duracionMs)), n: reportRows.length, unidad: "min" },
        I2: { ...i2(closed.map((row) => ({ registered: row.registradaEn, closed: row.cerradaEn || row.resueltaEn }))), unidad: "min" },
        I3: { valor: i3(queryRows.map((row) => ({ updated: row.datosActualizados, responseMs: row.respuestaMs }))), n: queryRows.length, unidad: "%" },
        I4: { valor: i4(verificationRows.map((row) => ({ system: num(row.valorSistema), recalculated: num(row.valorRecalculado) }))), n: verificationRows.length, unidad: "%" },
        I5: { valor: i5(activityRows.map((row) => ({ state: row.estado, executed: row.ejecutadaEn, due: row.venceEn }))), n: activityRows.filter((row) => row.estado !== "Cancelada").length, unidad: "%" },
        ML: { valor: ml.exactitud, n: ml.n, unidad: "%", f1Macro: ml.f1Macro, kappa: ml.kappa, version: modelRows[0]?.version ?? null },
      },
      totalIncidencias: incidentRows.length,
      pendientes: incidentRows.filter((row) => !row.resueltaEn && !row.cerradaEn).length,
      overdueOpen, byStatus, byCategory, monthly, byTechnician, today, byPriority, byArea, resolutionByCategory, trend, trendUnit: spanDays <= 92 ? "día" : "mes",
    };
    const responseMs = Date.now() - started;
    await db.insert(consultaRegistros).values({ usuarioId: user.id, modulo: "Tablero de indicadores", solicitadaEn: new Date(), respuestaMs: responseMs, datosActualizados: true, inmediata: responseMs <= 3000 });
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("No se pudo calcular indicadores", error);
    return NextResponse.json({ error: "No se pudieron calcular los indicadores. Intenta de nuevo en unos segundos." }, { status: 500 });
  }
}
