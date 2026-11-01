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
const MUTED = "#6B7090", LINE = "#EEF0F5";
const etiqueta = { fontSize: 12, color: MUTED, marginBottom: 6 } as const;
const cifra = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 14, fontWeight: 600 } as const;

// Confianza de la categoría sugerida con barra; indica si coincide con la categoría ya confirmada.
function Confianza({ categoria, valor, actual }: { categoria: string; valor: number; actual?: string | null }) {
  const alta = valor >= 0.6; const color = alta ? "#067647" : "#B54708";
  return <div>
    <div style={etiqueta}>Categoría sugerida</div>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}><div style={{ fontSize: 17, fontWeight: 600 }}>{categoria}</div><div style={{ ...cifra, color }}>{pct(valor)}</div></div>
    <div style={{ height: 6, borderRadius: 3, background: LINE, marginTop: 10, overflow: "hidden" }}><div style={{ width: `${valor * 100}%`, height: "100%", background: alta ? "#12A150" : "#E8692C" }} /></div>
    <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Confianza {alta ? "alta" : "baja: revisa la descripción"}{actual ? (actual === categoria ? " · coincide con la categoría actual" : ` · la categoría actual es ${actual}`) : ""}</div>
  </div>;
}

// Riesgo de superar 8 h en tres zonas (bajo < 20 %, medio < 40 %, alto), con la lectura en frecuencias.
function Riesgo({ valor, abierta }: { valor: number; abierta: number | null }) {
  const nivel = valor >= 0.4 ? { t: "Alto", c: "#B42318" } : valor >= 0.2 ? { t: "Medio", c: "#B54708" } : { t: "Bajo", c: "#067647" };
  const deDiez = Math.round(valor * 10);
  return <div>
    <div style={etiqueta}>Riesgo de superar 8 h</div>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}><div style={{ fontSize: 17, fontWeight: 600, color: nivel.c }}>{nivel.t}</div><div style={{ ...cifra, color: nivel.c }}>{pct(valor)}</div></div>
    <div style={{ display: "flex", gap: 3, marginTop: 10, position: "relative" }}>
      <div style={{ flex: 20, height: 6, borderRadius: "3px 0 0 3px", background: "#CDEEDB" }} /><div style={{ flex: 20, height: 6, background: "#FDE3C4" }} /><div style={{ flex: 60, height: 6, borderRadius: "0 3px 3px 0", background: "#FBD1CD" }} />
      <div style={{ position: "absolute", left: `calc(${Math.min(valor, 1) * 100}% - 1px)`, top: -3, width: 3, height: 12, background: "#1A1D2E", borderRadius: 2 }} />
    </div>
    <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>{deDiez < 1 ? "Menos de 1 de cada 10" : `Unas ${deDiez} de cada 10`} incidencias similares superan la meta{abierta != null ? ` · abierta hace ${minutes(abierta)}` : ""}</div>
  </div>;
}

export default function AssistantPanel({ data, compact = false, categoriaActual }: { data: Analysis; compact?: boolean; categoriaActual?: string | null }) {
  const p = data.procedimiento; const top = data.sugerencias[0]; const riesgo = data.riesgo.actual ?? data.riesgo.inicial;
  return <section style={{ background: "#fff", border: "1px solid #E4E6EE", borderRadius: 12, overflow: "hidden" }} aria-label="Asistente ML">
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 22px", borderBottom: `1px solid ${LINE}` }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: "#F5C400" }} /><h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Asistente ML</h2>
      <span style={{ fontSize: 12, color: MUTED }}>{data.riesgo.actual != null ? "Se actualiza mientras la incidencia sigue abierta" : "Estimado al registrar la incidencia"}</span>
    </div>
    {data.decision && <div className="alert-strip" style={{ margin: "14px 22px 0" }}><span><strong>{data.decision.accion}.</strong> {data.decision.motivo}</span></div>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", borderBottom: `1px solid ${LINE}` }}>
      <div style={{ padding: "18px 22px", borderRight: `1px solid ${LINE}` }}>{top ? <Confianza categoria={top.categoria} valor={top.probabilidad} actual={categoriaActual} /> : <div style={etiqueta}>Sin categoría sugerida</div>}</div>
      <div style={{ padding: "18px 22px" }}><Riesgo valor={riesgo} abierta={data.riesgo.actual != null ? data.riesgo.minutosAbierta : null} /></div>
    </div>
    {p && <div style={{ padding: "18px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: MUTED }}>Procedimiento</div><div style={{ fontSize: 15, fontWeight: 600 }}>{p.titulo}</div>
        <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 9px", borderRadius: 999, background: p.remoto ? "#ECEEFB" : "#F4F5F8", color: p.remoto ? "#1B2A8F" : MUTED }}>{p.remoto ? "Remoto" : "Presencial"}</span>
      </div>
      {data.preparacion && <div style={{ fontSize: 13, lineHeight: 1.5, background: "#FFFBEB", border: "1px solid #F6E3A1", borderRadius: 8, padding: "10px 14px", marginBottom: compact ? 0 : 12, color: "#5C4400" }}><b>Preparación:</b> {data.preparacion}</div>}
      {!compact && <div style={{ border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>{p.pasos.map((s, i) => <div key={s} style={{ display: "flex", gap: 12, padding: "11px 14px", borderTop: i ? `1px solid ${LINE}` : "none", fontSize: 14 }}><span style={{ width: 22, height: 22, borderRadius: "50%", background: "#ECEEFB", color: "#1B2A8F", fontSize: 12, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>{i + 1}</span>{s}</div>)}</div>}
    </div>}
    {!compact && data.similares.length > 0 && <div style={{ padding: "0 22px 18px" }}><div style={etiqueta}>Casos parecidos resueltos</div><ul style={{ margin: 0, paddingLeft: 18 }}>{data.similares.map((s) => <li key={s.id}><Link href={`/incidencias/${s.id}`}>{s.codigo}</Link> · {s.titulo} · {minutes(s.minutos)}<div style={{ fontSize: 12, color: MUTED }}>{[s.solucion, s.causa && `Causa: ${s.causa}`, s.repuesto && `Repuesto: ${s.repuesto}`].filter(Boolean).join(" · ")}</div></li>)}</ul></div>}
  </section>;
}
