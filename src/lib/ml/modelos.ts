// Los modelos se importan como módulos para que viajen dentro del paquete del Worker
// (en Cloudflare no hay sistema de archivos) y se carguen una sola vez por instancia.
import { and, eq, isNotNull } from "drizzle-orm";
import modeloJson from "./modelo.json";
import riesgoJson from "./modelo_riesgo.json";
import baseJson from "./base_conocimiento.json";
import type { ModeloML } from "./clasificador";
import type { ModeloRiesgo } from "./riesgo";
import type { BaseConocimiento } from "./asistente";
import type { AppDb } from "@/db/client";
import { modelosMl } from "@/db/schema";

export type ModeloClasificador = ModeloML & { algoritmo: string; entrenado_en: string; metricas_prueba: unknown; comparacion_algoritmos: unknown };
export const MODELO = modeloJson as unknown as ModeloClasificador;
export const MODELO_RIESGO = riesgoJson as unknown as ModeloRiesgo & { algoritmo: string; metricas: Record<string, number | string | null> };
export const BASE_CONOCIMIENTO = baseJson as unknown as BaseConocimiento;

// Modelo activo: el entrenado desde la pantalla «Entrenar modelo» si está activado; si no, el incluido en el sistema.
let cache: { version: string; modelo: ModeloML } | null = null;
export async function getModeloActivo(db: AppDb): Promise<ModeloML> {
  const [row] = await db.select({ version: modelosMl.version, json: modelosMl.modeloJson }).from(modelosMl).where(and(eq(modelosMl.activo, true), isNotNull(modelosMl.modeloJson))).limit(1);
  if (!row?.json) return MODELO;
  if (cache?.version !== row.version) cache = { version: row.version, modelo: JSON.parse(row.json) as ModeloML };
  return cache.modelo;
}
