import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categorias, incidenciaEventos, incidencias } from "@/db/schema";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { analizarIncidencia } from "@/lib/ml/analizar-incidencia";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(); const { id } = await params; const db = await getDb();
    const [row] = await db.select().from(incidencias).where(eq(incidencias.id, Number(id))).limit(1);
    if (!row) return NextResponse.json({ error: "Incidencia no encontrada." }, { status: 404 });
    if (user.rol === "colaborador" && row.usuarioId !== user.id) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    if (user.rol === "tecnico" && row.tecnicoId !== user.id) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const [[category], [last]] = await Promise.all([
      row.categoriaConfirmadaId ? db.select().from(categorias).where(eq(categorias.id, row.categoriaConfirmadaId)).limit(1) : Promise.resolve([]),
      db.select({ ultimo: sql<string>`max(${incidenciaEventos.ocurridoEn})` }).from(incidenciaEventos).where(eq(incidenciaEventos.incidenciaId, row.id)),
    ]);
    const analisis = await analizarIncidencia(db, { id: row.id, titulo: row.titulo, descripcion: row.descripcion, prioridad: row.prioridad, categoriaConfirmada: category?.nombre ?? null, registradaEn: row.registradaEn, pendiente: !row.resueltaEn && !row.cerradaEn, tieneTecnico: !!row.tecnicoId, ultimoMovimiento: last?.ultimo ? new Date(last.ultimo) : undefined, confianza: row.confianzaSugerencia == null ? null : Number(row.confianzaSugerencia) });
    return NextResponse.json({ ...analisis, procedimientoUtil: row.procedimientoUtil, procedimientoRegistrado: row.procedimientoId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Asistente ML", error);
    return NextResponse.json({ error: "No se pudo calcular el análisis ML." }, { status: 500 });
  }
}
