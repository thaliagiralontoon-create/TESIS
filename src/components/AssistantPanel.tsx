"use client";
import Link from "next/link";

export type Analysis = {
  modelo: { clasificador: string; riesgo: string; baseConocimiento: string; estadoBase: string };
  sugerencias: Array<{ categoria: string; probabilidad: number }>; categoria: string | null;
  procedimiento: null | { id: string; titulo: string; categoria: string; remoto: boolean; repuesto: string | null; pasos: string[]; casos: number; cerradas: number; medianaMin: number | null; p75Min: number | null; pctMas8h: number | null; confianza: number };
  alternativas: Array<{ id: string; titulo: string; categoria: string }>;
  preparacion: string | null;
  tiempo: { medianaMin: number | null; p75Min: number | null; base: string };
  riesgo: { inicial: number; actual: number | null; minutosAbierta: number | null };
  decision: null | { riesgo: number; nivel: string; detenida: boolean; accion: string; motivo: string };
  similares: Array<{ id: number; codigo: string; titulo: string; solucion: string | null; causa: string | null; repuesto: string | null; minutos: number | null; similitud: number }>;
  procedimientoUtil?: boolean | null;
};
export const minutes = (m: number | null) => m == null ? "—" : m < 60 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`;
const pct = (v: number) => `${Math.round(v * 100)} %`;
const tone = (v: number) => v >= 0.4 ? "red" : v >= 0.2 ? "orange" : "green";

// Solo lo que usa el técnico para atender: categoría sugerida, riesgo de demora, preparación y pasos, y casos parecidos ya resueltos.
export default function AssistantPanel({ data, compact = false }: { data: Analysis; compact?: boolean }) {
  const p = data.procedimiento; const top = data.sugerencias[0]; const riesgo = data.riesgo.actual ?? data.riesgo.inicial;
  return <section className="panel stack" style={{ borderTop: "4px solid #F5C400" }} aria-label="Asistente ML">
    <div className="panel-head"><h2>Asistente ML</h2></div>
    {data.decision && <div className="alert-strip" style={{ margin: 0 }}><span><strong>{data.decision.accion}.</strong> {data.decision.motivo}</span></div>}
    <div className="kpi-list">
      <div><div className="metric-label">Categoría sugerida</div><div><strong>{top?.categoria ?? "—"}</strong> {top && <span className={`badge ${top.probabilidad >= 0.6 ? "green" : "orange"}`}>{pct(top.probabilidad)}</span>}</div></div>
      <div><div className="metric-label">Riesgo de superar 8 h</div><div><span className={`badge ${tone(riesgo)}`}>{pct(riesgo)}</span>{data.riesgo.actual != null && <span className="subtle"> · abierta hace {minutes(data.riesgo.minutosAbierta)}</span>}</div></div>
    </div>
    {p && <div className="stack" style={{ gap: 8 }}>
      <div><div className="metric-label">Procedimiento</div><strong>{p.titulo}</strong>{p.remoto && <span className="badge blue" style={{ marginLeft: 8 }}>Remoto</span>}</div>
      {data.preparacion && <div className="help" style={{ margin: 0 }}><strong>Preparación:</strong> {data.preparacion}</div>}
      {!compact && <ol style={{ margin: 0, paddingLeft: 20 }}>{p.pasos.map((s) => <li key={s}>{s}</li>)}</ol>}
    </div>}
    {!compact && data.similares.length > 0 && <div><div className="metric-label">Casos parecidos resueltos</div><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{data.similares.map((s) => <li key={s.id}><Link href={`/incidencias/${s.id}`}>{s.codigo}</Link> · {s.titulo} · {minutes(s.minutos)}<div className="subtle" style={{ fontSize: 12 }}>{[s.solucion, s.causa && `Causa: ${s.causa}`, s.repuesto && `Repuesto: ${s.repuesto}`].filter(Boolean).join(" · ")}</div></li>)}</ul></div>}
  </section>;
}
