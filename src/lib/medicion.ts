import { mean, median } from "./indicadores";

export type Fase = "pretest" | "postest";
export type IndicadorMedicion = "I1" | "I3" | "I4" | "ML";
export type Referencia =
  | { tipo: "conteo_mes"; mes: string }
  | { tipo: "media_mes"; mes: string }
  | { tipo: "conteo_prioridad"; prioridad: string }
  | { tipo: "tiempo_incidencia"; codigo: string };
export interface Tarea { codigo: string; indicador: IndicadorMedicion; descripcion: string; referencia?: Referencia; incidencia?: string }
export const CATEGORIAS = ["Accesos", "Audio", "Conectividad", "Correo electrónico", "Hardware", "Impresora", "Seguridad", "Software/licencias"];

// Protocolo de la tesis: con cada una de las 29 incidencias de la muestra se hacen cuatro tareas, en este orden:
// consulta de la información para asignarla (I3), cálculo de su tiempo de atención (I4), clasificación (ML)
// y fila del reporte (I1). Las mismas 116 tareas se miden en el pretest y en el postest.
const pad = (n: number) => String(n).padStart(2, "0");
export const MUESTRA = Array.from({ length: 29 }, (_, i) => `NKM-INC-${String(i + 1).padStart(4, "0")}`);

export const PROTOCOLO: Tarea[] = MUESTRA.flatMap((incidencia, i) => [
  { codigo: `C${pad(i + 1)}`, indicador: "I3" as const, incidencia, descripcion: `Obtener la información para asignar ${incidencia}: estado, técnico y fecha de resolución` },
  { codigo: `V${pad(i + 1)}`, indicador: "I4" as const, incidencia, descripcion: `Calcular el tiempo de atención (min) de ${incidencia}`, referencia: { tipo: "tiempo_incidencia" as const, codigo: incidencia } },
  { codigo: `T${pad(i + 1)}`, indicador: "ML" as const, incidencia, descripcion: `Clasificar la incidencia ${incidencia}` },
  { codigo: `R${pad(i + 1)}`, indicador: "I1" as const, incidencia, descripcion: `Elaborar la fila del reporte de ${incidencia}` },
]);
export const tareaPorCodigo = (codigo: string) => PROTOCOLO.find((tarea) => tarea.codigo === codigo);

// I3: cumple si se obtuvo la información completa (estado, técnico y fecha de resolución); el tiempo se compara aparte.
export function cumpleDisponibilidad(informacionCompleta: boolean) {
  return informacionCompleta;
}

// Clasificación: la categoría elegida coincide con la confirmada. Se aceptan las abreviaturas anotadas en el pretest.
const EQUIVALENTES: Record<string, string> = { correo: "correo electronico", software: "software/licencias" };
const normalizarCategoria = (c: string) => { const s = c.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase(); return EQUIVALENTES[s] ?? s; };
export function categoriaCorrecta(elegida: string, confirmada: string) {
  return normalizarCategoria(elegida) === normalizarCategoria(confirmada);
}

// I4: cumple si difiere del valor de referencia en 1 % o menos; en conteos, en 0,5 o menos.
export function cumplePrecision(obtenido: number, referencia: number, esConteo: boolean) {
  const diferencia = Math.abs(obtenido - referencia);
  return esConteo ? diferencia <= 0.5 : diferencia <= 0.01 * Math.abs(referencia);
}

// Mes de registro en hora de Lima (UTC-5, sin horario de verano).
export const mesLima = (fecha: Date) => new Date(fecha.getTime() - 5 * 3_600_000).toISOString().slice(0, 7);

export function valorReferencia(referencia: Referencia, filas: Array<{ codigo?: string; registradaEn: Date; cerradaEn: Date | null; resueltaEn: Date | null; prioridad: string }>) {
  if (referencia.tipo === "tiempo_incidencia") {
    const fila = filas.find((f) => f.codigo === referencia.codigo); const fin = fila && (fila.cerradaEn ?? fila.resueltaEn);
    return fila && fin ? Math.round((fin.getTime() - fila.registradaEn.getTime()) / 60_000) : null;
  }
  if (referencia.tipo === "conteo_mes") return filas.filter((fila) => mesLima(fila.registradaEn) === referencia.mes).length;
  if (referencia.tipo === "conteo_prioridad") return filas.filter((fila) => fila.prioridad === referencia.prioridad).length;
  const minutos = filas
    .filter((fila) => mesLima(fila.registradaEn) === referencia.mes && (fila.cerradaEn || fila.resueltaEn))
    .map((fila) => ((fila.cerradaEn ?? fila.resueltaEn)!.getTime() - fila.registradaEn.getTime()) / 60_000);
  return mean(minutos);
}

export function cuartil(values: number[], q: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  return sorted[base] + (sorted[Math.min(base + 1, sorted.length - 1)] - sorted[base]) * (pos - base);
}

export function resumen(values: number[]) {
  const promedio = mean(values);
  const de = values.length > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - promedio!) ** 2, 0) / (values.length - 1)) : null;
  return { n: values.length, media: promedio, de, mediana: median(values), q1: cuartil(values, 0.25), q3: cuartil(values, 0.75), min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null };
}
