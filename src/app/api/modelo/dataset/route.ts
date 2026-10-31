import { NextResponse } from "next/server";
import { eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categorias, incidencias } from "@/db/schema";
import { AuthError, getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
// Incidencias con categoría confirmada por un técnico: son las etiquetas para entrenar.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (user.rol !== "supervisor") return NextResponse.json({ error: "Solo supervisión puede entrenar el modelo." }, { status: 403 });
    const db = await getDb();
    const rows = await db.select({ titulo: incidencias.titulo, descripcion: incidencias.descripcion, categoria: categorias.nombre, fecha: incidencias.registradaEn, origen: incidencias.origen })
      .from(incidencias).innerJoin(categorias, eq(categorias.id, incidencias.categoriaConfirmadaId)).where(isNotNull(incidencias.categoriaConfirmadaId));
    return NextResponse.json({ filas: rows.map((r) => ({ texto: r.titulo && r.titulo !== r.descripcion ? `${r.titulo} ${r.descripcion}` : r.descripcion, categoria: r.categoria, fecha: r.fecha, origen: r.origen })) });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "No se pudieron cargar los datos de entrenamiento." }, { status: 500 });
  }
}
