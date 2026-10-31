// Riesgo de demora y acción sugerida para las incidencias pendientes.
export interface ModeloRiesgo { version: string; umbral_min: number; paso_min: number; curvas: Record<string, number[]> }
export type Nivel = "vencida" | "alto" | "medio" | "bajo";
export interface Pendiente { prioridad: string; minutosAbierta: number; minutosSinMovimiento: number; tieneTecnico: boolean; categoriaConfirmada: boolean; confianza: number | null }
export interface Decision { riesgo: number; nivel: Nivel; detenida: boolean; accion: string; motivo: string }

const DIA = 24 * 60;

// P(T > umbral | T > t) = S(umbral) / S(t), con S estimada por Kaplan-Meier para la prioridad.
export function riesgoDemora(modelo: ModeloRiesgo, prioridad: string, minutos: number) {
  if (minutos >= modelo.umbral_min) return 1;
  const s = modelo.curvas[prioridad] ?? modelo.curvas.Media;
  const k = Math.min(Math.floor(Math.max(minutos, 0) / modelo.paso_min), s.length - 1);
  return s[k] <= 0 ? 0 : Math.min(1, s[s.length - 1] / s[k]);
}

export function nivelRiesgo(riesgo: number, minutos: number, umbral: number): Nivel {
  if (minutos >= umbral) return "vencida";
  return riesgo >= 0.4 ? "alto" : riesgo >= 0.2 ? "medio" : "bajo";
}

export function decidir(modelo: ModeloRiesgo, p: Pendiente): Decision {
  const riesgo = riesgoDemora(modelo, p.prioridad, p.minutosAbierta);
  const nivel = nivelRiesgo(riesgo, p.minutosAbierta, modelo.umbral_min);
  const detenida = p.minutosSinMovimiento >= DIA;
  const horas = (p.minutosAbierta / 60).toFixed(1);
  if (!p.tieneTecnico) return { riesgo, nivel, detenida, accion: "Asignar técnico", motivo: "No tiene técnico responsable" };
  if (p.minutosAbierta >= 3 * DIA) return { riesgo, nivel, detenida, accion: "Verificar y cerrar", motivo: `Abierta hace ${Math.floor(p.minutosAbierta / DIA)} días: confirmar si ya se resolvió y registrar el cierre` };
  if (detenida) return { riesgo, nivel, detenida, accion: "Reactivar", motivo: "Sin movimientos en las últimas 24 h" };
  if (nivel === "vencida") return { riesgo, nivel, detenida, accion: "Escalar", motivo: `Supera 8 h de atención (${horas} h)` };
  if (!p.categoriaConfirmada && p.confianza != null && p.confianza < 0.6) return { riesgo, nivel, detenida, accion: "Confirmar categoría", motivo: `Sugerencia del modelo con confianza baja (${Math.round(p.confianza * 100)} %)` };
  if (nivel === "alto") return { riesgo, nivel, detenida, accion: "Atender primero", motivo: `${Math.round(riesgo * 100)} % de probabilidad de superar 8 h` };
  return { riesgo, nivel, detenida, accion: "Seguimiento normal", motivo: `${Math.round(riesgo * 100)} % de probabilidad de superar 8 h` };
}

// Primero lo que se puede salvar hoy; los casos antiguos sin cierre van al final para revisarlos aparte.
export const ACCIONES = ["Escalar", "Asignar técnico", "Atender primero", "Reactivar", "Confirmar categoría", "Seguimiento normal", "Verificar y cerrar"];
export function compararDecisiones(a: { decision: Decision; minutosAbierta: number }, b: { decision: Decision; minutosAbierta: number }) {
  return ACCIONES.indexOf(a.decision.accion) - ACCIONES.indexOf(b.decision.accion) || b.decision.riesgo - a.decision.riesgo || a.minutosAbierta - b.minutosAbierta;
}
