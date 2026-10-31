import { NextResponse } from "next/server";
import { eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { modelosMl } from "@/db/schema";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { getModeloActivo, MODELO } from "@/lib/ml/modelos";

export const runtime = "nodejs";
// GET: pesos del modelo activo (para comparar en la pantalla de entrenamiento).
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (user.rol !== "supervisor") return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    return NextResponse.json(await getModeloActivo(await getDb()));
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "No se pudo leer el modelo activo." }, { status: 500 });
  }
}

const modeloSchema = z.object({ clases: z.array(z.string()).min(2), vocabulario: z.record(z.string(), z.number()), idf: z.array(z.number()), coeficientes: z.array(z.array(z.number())), intercepto: z.array(z.number()), stopwords: z.array(z.string()), algoritmo: z.string() });
const body = z.union([
  z.object({ activar: z.string().min(1) }),
  z.object({ modelo: modeloSchema, metricas: z.record(z.string(), z.unknown()), nEntrenamiento: z.number().int().positive(), nPrueba: z.number().int().nonnegative(), exactitud: z.number(), f1Macro: z.number(), kappa: z.number() }),
]);
// POST: guarda y activa un modelo entrenado en pantalla, o reactiva una versión existente.
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (user.rol !== "supervisor") return NextResponse.json({ error: "Solo supervisión puede activar modelos." }, { status: 403 });
    const parsed = body.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "El modelo enviado no tiene el formato esperado." }, { status: 400 });
    const db = await getDb();
    if ("activar" in parsed.data) {
      const [row] = await db.select().from(modelosMl).where(eq(modelosMl.version, parsed.data.activar)).limit(1);
      if (!row) return NextResponse.json({ error: "Versión no encontrada." }, { status: 404 });
      // Las versiones entrenadas fuera del sistema solo se pueden activar si son la que viene incluida.
      if (!row.modeloJson && row.version !== MODELO.version) return NextResponse.json({ error: `Los pesos de ${row.version} no están guardados en el sistema; solo se puede activar ${MODELO.version} o un modelo entrenado aquí.` }, { status: 400 });
      await db.update(modelosMl).set({ activo: false }).where(ne(modelosMl.version, row.version));
      await db.update(modelosMl).set({ activo: true }).where(eq(modelosMl.version, row.version));
      return NextResponse.json({ version: row.version });
    }
    const d = parsed.data; const stamp = new Date(Date.now() - 5 * 3_600_000).toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const version = `logreg-web-${stamp.slice(0, 8)}-${stamp.slice(8)}`;
    const modelo = { ...d.modelo, version };
    if (modelo.coeficientes.length !== modelo.clases.length || modelo.idf.length !== Object.keys(modelo.vocabulario).length) return NextResponse.json({ error: "Las dimensiones del modelo no coinciden." }, { status: 400 });
    await db.update(modelosMl).set({ activo: false });
    await db.insert(modelosMl).values({ version, algoritmo: modelo.algoritmo, entrenadoEn: new Date(), nEntrenamiento: d.nEntrenamiento, nPrueba: d.nPrueba, exactitud: d.exactitud.toFixed(4), f1Macro: d.f1Macro.toFixed(4), kappa: d.kappa.toFixed(4), metricasJson: d.metricas, modeloJson: JSON.stringify(modelo), activo: true });
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Activar modelo", error);
    return NextResponse.json({ error: "No se pudo guardar el modelo." }, { status: 500 });
  }
}
