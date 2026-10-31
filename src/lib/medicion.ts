import { mean, median } from "./indicadores";

export type Fase = "pretest" | "postest";
export type IndicadorMedicion = "I1" | "I3" | "I4" | "ML";
export type Referencia =
  | { tipo: "conteo_mes"; mes: string }
  | { tipo: "media_mes"; mes: string }
  | { tipo: "conteo_prioridad"; prioridad: string };
export interface Tarea { codigo: string; indicador: IndicadorMedicion; descripcion: string; referencia?: Referencia; incidencia?: string }
export const CATEGORIAS = ["Accesos", "Audio", "Conectividad", "Correo electrónico", "Hardware", "Impresora", "Seguridad", "Software/licencias"];

// Protocolo sobre la muestra de 29 incidencias (una tarea por incidencia): 8 reportes (I1), 7 consultas (I3),
// 7 verificaciones (I4) y 7 clasificaciones (componente ML). Las mismas tareas se miden en el pretest y el postest.
const MESES = [["2026-03", "marzo"], ["2026-04", "abril"], ["2026-06", "junio"], ["2026-07", "julio"], ["2026-08", "agosto"], ["2026-09", "setiembre"]] as const;
const pad = (n: number) => String(n).padStart(2, "0");

const REPORTES: Tarea[] = [
  ...MESES.map(([, nombre], i) => ({ codigo: `R${pad(i + 1)}`, indicador: "I1" as const, descripcion: `Reporte mensual de incidencias de la muestra — ${nombre} 2026` })),
  { codigo: "R07", indicador: "I1", descripcion: "Reporte de atención por categoría (muestra de 29 incidencias)" },
  { codigo: "R08", indicador: "I1", descripcion: "Reporte de atención por prioridad (muestra de 29 incidencias)" },
];

const CONSULTAS: Tarea[] = [
  "Estado actual de la incidencia NKM-INC-0007",
  "Técnico que atendió la incidencia NKM-INC-0015",
  "Categoría confirmada de la incidencia NKM-INC-0019",
  "Fecha y hora de resolución de la incidencia NKM-INC-0022",
  "Número de incidencias registradas en julio de 2026",
  "Número de incidencias de la categoría Hardware",
  "Mediana del tiempo de atención de las incidencias de prioridad Baja",
].map((descripcion, i) => ({ codigo: `C${pad(i + 1)}`, indicador: "I3" as const, descripcion }));

const VERIFICACIONES: Tarea[] = [
  { codigo: "V01", indicador: "I4", descripcion: "Número de incidencias registradas en julio 2026", referencia: { tipo: "conteo_mes", mes: "2026-07" } },
  { codigo: "V02", indicador: "I4", descripcion: "Número de incidencias registradas en agosto 2026", referencia: { tipo: "conteo_mes", mes: "2026-08" } },
  { codigo: "V03", indicador: "I4", descripcion: "Tiempo medio de atención (min) de las incidencias de julio 2026", referencia: { tipo: "media_mes", mes: "2026-07" } },
  { codigo: "V04", indicador: "I4", descripcion: "Tiempo medio de atención (min) de las incidencias de agosto 2026", referencia: { tipo: "media_mes", mes: "2026-08" } },
  { codigo: "V05", indicador: "I4", descripcion: "Tiempo medio de atención (min) de las incidencias de setiembre 2026", referencia: { tipo: "media_mes", mes: "2026-09" } },
  { codigo: "V06", indicador: "I4", descripcion: "Número de incidencias de prioridad Media", referencia: { tipo: "conteo_prioridad", prioridad: "Media" } },
  { codigo: "V07", indicador: "I4", descripcion: "Número de incidencias de prioridad Baja", referencia: { tipo: "conteo_prioridad", prioridad: "Baja" } },
];

// Clasificación y asignación (componente ML): 7 incidencias de la muestra de seis categorías distintas.
// A mano: se lee el texto y se decide; con el sistema: se parte de la sugerencia del modelo.
const CLASIFICACION: Tarea[] = ["NKM-INC-0012", "NKM-INC-0016", "NKM-INC-0019", "NKM-INC-0020", "NKM-INC-0021", "NKM-INC-0024", "NKM-INC-0006"]
  .map((incidencia, i) => ({ codigo: `T${pad(i + 1)}`, indicador: "ML" as const, incidencia, descripcion: `Clasificar la incidencia ${incidencia} y decidir a quién asignarla` }));

export const PROTOCOLO: Tarea[] = [...REPORTES, ...CONSULTAS, ...VERIFICACIONES, ...CLASIFICACION];
export const tareaPorCodigo = (codigo: string) => PROTOCOLO.find((tarea) => tarea.codigo === codigo);

// I3: cumple si la respuesta se obtuvo en 60 s o menos con datos actualizados.
export function cumpleDisponibilidad(duracionMs: number, datosActualizados: boolean) {
  return datosActualizados && duracionMs <= 60_000;
}

// I4: cumple si difiere del valor de referencia en 1 % o menos; en conteos, en 0,5 o menos.
export function cumplePrecision(obtenido: number, referencia: number, esConteo: boolean) {
  const diferencia = Math.abs(obtenido - referencia);
  return esConteo ? diferencia <= 0.5 : diferencia <= 0.01 * Math.abs(referencia);
}

// Mes de registro en hora de Lima (UTC-5, sin horario de verano).
export const mesLima = (fecha: Date) => new Date(fecha.getTime() - 5 * 3_600_000).toISOString().slice(0, 7);

export function valorReferencia(referencia: Referencia, filas: Array<{ registradaEn: Date; cerradaEn: Date | null; resueltaEn: Date | null; prioridad: string }>) {
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
