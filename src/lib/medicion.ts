import { mean, median } from "./indicadores";

export type Fase = "pretest" | "postest";
export type IndicadorMedicion = "I1" | "I3" | "I4" | "ML";
export type Referencia =
  | { tipo: "conteo_mes"; mes: string }
  | { tipo: "media_mes"; mes: string }
  | { tipo: "conteo_prioridad"; prioridad: string };
export interface Tarea { codigo: string; indicador: IndicadorMedicion; descripcion: string; referencia?: Referencia; incidencia?: string }
export const CATEGORIAS = ["Accesos", "Audio", "Conectividad", "Correo electrónico", "Hardware", "Impresora", "Seguridad", "Software/licencias"];

// Protocolo del Anexo 2 de la tesis: 10 reportes (I1), 20 consultas (I3) y 20 verificaciones (I4).
const MESES = [["2026-03", "marzo"], ["2026-04", "abril"], ["2026-05", "mayo"], ["2026-06", "junio"], ["2026-07", "julio"], ["2026-08", "agosto"], ["2026-09", "setiembre"], ["2026-10", "octubre"]] as const;
const PRIORIDADES = ["Crítica", "Alta", "Media", "Baja"] as const;
const pad = (n: number) => String(n).padStart(2, "0");

const REPORTES: Tarea[] = [
  ...MESES.map(([, nombre], i) => ({ codigo: `R${pad(i + 1)}`, indicador: "I1" as const, descripcion: `Reporte mensual de incidencias — ${nombre} 2026` })),
  { codigo: "R09", indicador: "I1", descripcion: "Reporte de atención por categoría (marzo–octubre 2026)" },
  { codigo: "R10", indicador: "I1", descripcion: "Reporte de atención por prioridad (marzo–octubre 2026)" },
];

const CONSULTAS: Tarea[] = [
  "Estado actual de la incidencia H-INC-0150",
  "Técnico que atendió la incidencia H-INC-0300",
  "Categoría confirmada de la incidencia H-INC-0450",
  "Fecha y hora de cierre de la incidencia H-INC-0600",
  "Estado actual de la incidencia H-INC-0750",
  "Técnico que atendió la incidencia H-INC-0900",
  "Categoría confirmada de la incidencia H-INC-1050",
  "Fecha y hora de cierre de la incidencia H-INC-1200",
  "Número de incidencias registradas en julio de 2026",
  "Número de incidencias registradas en setiembre de 2026",
  "Número de incidencias de la categoría Hardware (marzo–octubre)",
  "Número de incidencias de la categoría Conectividad (marzo–octubre)",
  "Número de incidencias de prioridad Alta (marzo–octubre)",
  "Número de incidencias del área con más solicitudes",
  "Número de incidencias atendidas por el técnico TEC-003",
  "Mediana del tiempo de atención en agosto de 2026",
  "Mediana del tiempo de atención de la categoría Impresora",
  "Mediana del tiempo de atención de prioridad Crítica",
  "Mediana del tiempo de atención del técnico TEC-006",
  "Número de incidencias sin cierre al corte",
].map((descripcion, i) => ({ codigo: `C${pad(i + 1)}`, indicador: "I3" as const, descripcion }));

const VERIFICACIONES: Tarea[] = [
  ...MESES.map(([mes, nombre], i) => ({ codigo: `V${pad(i + 1)}`, indicador: "I4" as const, descripcion: `Número de incidencias registradas en ${nombre} 2026`, referencia: { tipo: "conteo_mes", mes } as Referencia })),
  ...MESES.map(([mes, nombre], i) => ({ codigo: `V${pad(i + 9)}`, indicador: "I4" as const, descripcion: `Tiempo medio de atención (min) de las incidencias cerradas registradas en ${nombre} 2026`, referencia: { tipo: "media_mes", mes } as Referencia })),
  ...PRIORIDADES.map((prioridad, i) => ({ codigo: `V${pad(i + 17)}`, indicador: "I4" as const, descripcion: `Número de incidencias de prioridad ${prioridad} (marzo–octubre 2026)`, referencia: { tipo: "conteo_prioridad", prioridad } as Referencia })),
];

// Clasificación y asignación (componente ML): 20 incidencias del periodo de prueba, proporcionales por categoría
// y con descripciones distintas. Manual: el técnico lee el texto y decide; con el sistema: usa la sugerencia del modelo.
const CLASIFICACION: Tarea[] = ["H-INC-0010", "H-INC-0024", "H-INC-0640", "H-INC-0675", "H-INC-0598", "H-INC-0738", "H-INC-0773", "H-INC-0619", "H-INC-0647", "H-INC-0668", "H-INC-0626", "H-INC-0717", "H-INC-0752", "H-INC-0017", "H-INC-0031", "H-INC-0591", "H-INC-0605", "H-INC-0612", "H-INC-0633", "H-INC-0794"]
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
