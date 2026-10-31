// Análisis ML de una incidencia: categoría, procedimiento recomendado, preparación, tiempo esperado,
// riesgo de demora, acción sugerida y casos parecidos ya resueltos en el sistema.
import { and, isNotNull, ne } from "drizzle-orm";
import type { AppDb } from "@/db/client";
import { incidencias } from "@/db/schema";
import { sugerir } from "./clasificador";
import { accionPreparacion, buscar, indexar, recomendarProcedimiento } from "./asistente";
import { BASE_CONOCIMIENTO, getModeloActivo, MODELO_RIESGO } from "./modelos";
import { decidir, riesgoDemora, type ModeloRiesgo } from "./riesgo";

export interface EntradaAnalisis { id?: number; titulo: string; descripcion: string; prioridad: string; categoriaConfirmada?: string | null; registradaEn?: Date; pendiente?: boolean; tieneTecnico?: boolean; ultimoMovimiento?: Date; confianza?: number | null }

// Mediana del tiempo de atención según la curva de supervivencia de la prioridad.
export function medianaPorPrioridad(modelo: ModeloRiesgo, prioridad: string) {
  const s = modelo.curvas[prioridad] ?? modelo.curvas.Media;
  const k = s.findIndex((v) => v <= 0.5);
  return k < 0 ? null : k * modelo.paso_min;
}

export async function analizarIncidencia(db: AppDb, e: EntradaAnalisis) {
  const modelo = await getModeloActivo(db);
  const texto = `${e.titulo} ${e.descripcion}`;
  const sugerencias = sugerir(modelo, e.titulo, e.descripcion, 3);
  const categoria = e.categoriaConfirmada ?? sugerencias[0]?.categoria ?? null;
  const { procedimiento, confianza, alternativas } = recomendarProcedimiento(BASE_CONOCIMIENTO, texto, categoria);

  // Casos parecidos resueltos en el sistema con su solución registrada (aprendizaje de casos nuevos).
  const resueltos = await db.select({ id: incidencias.id, codigo: incidencias.codigo, titulo: incidencias.titulo, descripcion: incidencias.descripcion, solucion: incidencias.solucion, causa: incidencias.causa, repuestoUsado: incidencias.repuestoUsado, registradaEn: incidencias.registradaEn, resueltaEn: incidencias.resueltaEn, cerradaEn: incidencias.cerradaEn })
    .from(incidencias).where(and(isNotNull(incidencias.solucion), e.id ? ne(incidencias.id, e.id) : undefined)).limit(500);
  const similares = resueltos.length ? buscar(indexar(resueltos, (r) => `${r.titulo} ${r.descripcion}`), texto, 3).filter((r) => r.similitud >= 0.3).map(({ item: r, similitud }) => {
    const fin = r.cerradaEn ?? r.resueltaEn;
    return { id: r.id, codigo: r.codigo, titulo: r.titulo, solucion: r.solucion, causa: r.causa, repuesto: r.repuestoUsado, minutos: fin ? Math.round((fin.getTime() - r.registradaEn.getTime()) / 60_000) : null, similitud };
  }) : [];

  const minutosAbierta = e.registradaEn ? (Date.now() - e.registradaEn.getTime()) / 60_000 : 0;
  const riesgoInicial = riesgoDemora(MODELO_RIESGO, e.prioridad, 0);
  const riesgoActual = e.pendiente ? riesgoDemora(MODELO_RIESGO, e.prioridad, minutosAbierta) : null;
  const decision = e.pendiente ? decidir(MODELO_RIESGO, { prioridad: e.prioridad, minutosAbierta, minutosSinMovimiento: e.ultimoMovimiento ? (Date.now() - e.ultimoMovimiento.getTime()) / 60_000 : minutosAbierta, tieneTecnico: !!e.tieneTecnico, categoriaConfirmada: !!e.categoriaConfirmada, confianza: e.confianza ?? sugerencias[0]?.probabilidad ?? null }) : null;

  const tiempo = procedimiento?.medianaMin != null
    ? { medianaMin: procedimiento.medianaMin, p75Min: procedimiento.p75Min, base: `${procedimiento.cerradas} casos históricos de «${procedimiento.titulo}»` }
    : { medianaMin: medianaPorPrioridad(MODELO_RIESGO, e.prioridad), p75Min: null, base: `casos históricos de prioridad ${e.prioridad}` };

  return {
    modelo: { clasificador: modelo.version, riesgo: MODELO_RIESGO.version, baseConocimiento: BASE_CONOCIMIENTO.version, estadoBase: BASE_CONOCIMIENTO.estado },
    sugerencias, categoria,
    procedimiento: procedimiento ? { ...procedimiento, confianza } : null,
    alternativas: alternativas.map((a) => ({ id: a.id, titulo: a.titulo, categoria: a.categoria })),
    preparacion: accionPreparacion(procedimiento),
    tiempo, riesgo: { inicial: riesgoInicial, actual: riesgoActual, minutosAbierta: e.pendiente ? minutosAbierta : null },
    decision, similares,
  };
}
export type AnalisisIncidencia = Awaited<ReturnType<typeof analizarIncidencia>>;
