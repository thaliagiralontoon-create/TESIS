import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { analizarIncidencia } from "@/lib/ml/analizar-incidencia";
import { AuthError, getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
const input = z.object({ titulo: z.string().max(160), descripcion: z.string().max(5000), prioridad: z.enum(["Baja", "Media", "Alta", "Crítica"]).default("Media") });
export async function POST(request: Request) {
  try {
    await getCurrentUser();
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Revisa el título y la descripción." }, { status: 400 });
    const analisis = await analizarIncidencia(await getDb(), parsed.data);
    return NextResponse.json({ disponible: true, version: analisis.modelo.clasificador, ...analisis });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Sugerencia ML", error);
    return NextResponse.json({ error: "No se pudo generar la sugerencia." }, { status: 500 });
  }
}
