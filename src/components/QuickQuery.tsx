"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Group = { incidencias: number; cerradas: number; sinCierre: number; promedioMin: number | null; medianaMin: number | null; pctMas8h: number | null };
type One = { id: number; codigo: string; titulo: string; estado: string; prioridad: string; categoria: string | null; tecnico: string | null; area: string | null; registradaEn: string; cierre: string | null; minutos: number | null };
type Options = { categorias: string[]; tecnicos: string[]; areas: string[] };
const fmt = (m: number | null) => m == null ? "—" : `${m.toFixed(1)} min`;
const EMPTY = { desde: "2026-03-01", hasta: "2026-10-31", origen: "todos", categoria: "", prioridad: "", tecnico: "", area: "", estado: "" };

export default function QuickQuery() {
  const [mode, setMode] = useState<"grupo" | "incidencia">("grupo");
  const [f, setF] = useState(EMPTY); const [codigo, setCodigo] = useState("");
  const [group, setGroup] = useState<Group | null>(null); const [one, setOne] = useState<One | null>(null);
  const [opts, setOpts] = useState<Options | null>(null); const [ms, setMs] = useState<number | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function run(params: Record<string, string>) {
    setBusy(true); setError("");
    try { const r = await fetch(`/api/consulta?${new URLSearchParams(Object.entries(params).filter(([, v]) => v))}`, { cache: "no-store" }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setOpts(d.opciones); setMs(d.respuestaMs); if (d.tipo === "incidencia") { setOne(d.incidencia); setGroup(null); } else { setGroup(d.resultado); setOne(null); } }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo consultar."); } finally { setBusy(false); }
  }
  useEffect(() => { void fetch("/api/consulta?solo=opciones", { cache: "no-store" }).then((r) => r.json()).then((d) => d.opciones && setOpts(d.opciones)).catch(() => {}); }, []);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  return <section className="panel stack" style={{ marginBottom: 17 }}>
    <div className="panel-head"><div><h2>Consulta rápida</h2><div className="panel-note">Responde al instante cuántas incidencias hay y cuánto tardan, o busca una incidencia por su código</div></div>
      <div className="filterbar"><button className={`btn ${mode === "grupo" ? "gold" : "ghost"}`} onClick={() => setMode("grupo")}>Totales y tiempos</button><button className={`btn ${mode === "incidencia" ? "gold" : "ghost"}`} onClick={() => setMode("incidencia")}>Buscar incidencia</button></div></div>
    {mode === "incidencia" ? <form className="filterbar" onSubmit={(e) => { e.preventDefault(); void run({ codigo }); }}><input id="consulta-codigo" className="field" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código, ej. H-INC-0150" aria-label="Código de incidencia" required/><button className="btn" disabled={busy}>{busy ? "Buscando…" : "Buscar"}</button></form>
      : <form className="filterbar" onSubmit={(e) => { e.preventDefault(); void run(f); }}>
        <label className="subtle">Desde <input id="consulta-desde" className="field" type="date" value={f.desde} onChange={set("desde")}/></label>
        <label className="subtle">Hasta <input id="consulta-hasta" className="field" type="date" value={f.hasta} onChange={set("hasta")}/></label>
        <select id="consulta-origen" className="select" value={f.origen} onChange={set("origen")} aria-label="Origen"><option value="todos">Todas</option><option value="historico">Histórico</option><option value="sistema">Registradas en el sistema</option></select>
        <select id="consulta-categoria" className="select" value={f.categoria} onChange={set("categoria")} aria-label="Categoría"><option value="">Toda categoría</option>{opts?.categorias.map((c) => <option key={c}>{c}</option>)}</select>
        <select id="consulta-prioridad" className="select" value={f.prioridad} onChange={set("prioridad")} aria-label="Prioridad"><option value="">Toda prioridad</option>{["Crítica", "Alta", "Media", "Baja"].map((p) => <option key={p}>{p}</option>)}</select>
        <select id="consulta-tecnico" className="select" value={f.tecnico} onChange={set("tecnico")} aria-label="Técnico"><option value="">Todo técnico</option>{opts?.tecnicos.map((t) => <option key={t}>{t}</option>)}</select>
        <select id="consulta-area" className="select" value={f.area} onChange={set("area")} aria-label="Área"><option value="">Toda área</option>{opts?.areas.map((a) => <option key={a}>{a}</option>)}</select>
        <select id="consulta-estado" className="select" value={f.estado} onChange={set("estado")} aria-label="Estado"><option value="">Todo estado</option>{["Abierto", "Asignado", "En proceso", "Resuelto", "Cerrado"].map((s) => <option key={s}>{s}</option>)}</select>
        <button className="btn" disabled={busy}>{busy ? "Consultando…" : "Consultar"}</button><button type="button" className="btn ghost" onClick={() => { setF(EMPTY); setGroup(null); }}>Limpiar</button>
      </form>}
    {error && <div className="alert">{error}</div>}
    {group && mode === "grupo" && <div className="kpi-list" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
      <div className="card"><div className="metric-label">Incidencias</div><div className="metric-value">{group.incidencias}</div></div>
      <div className="card"><div className="metric-label">Cerradas / sin cierre</div><div className="metric-value">{group.cerradas} / {group.sinCierre}</div></div>
      <div className="card"><div className="metric-label">Mediana de atención</div><div className="metric-value">{fmt(group.medianaMin)}</div></div>
      <div className="card"><div className="metric-label">Promedio de atención</div><div className="metric-value">{fmt(group.promedioMin)}</div></div>
      <div className="card"><div className="metric-label">Más de 8 h</div><div className="metric-value">{group.pctMas8h == null ? "—" : `${group.pctMas8h.toFixed(1)}%`}</div></div>
    </div>}
    {one && mode === "incidencia" && <div className="kpi-list" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
      <div className="card"><div className="metric-label">{one.codigo}</div><div><Link href={`/incidencias/${one.id}`}><strong>{one.titulo}</strong></Link></div></div>
      <div className="card"><div className="metric-label">Estado</div><div className="metric-value" style={{ fontSize: 20 }}>{one.estado}</div></div>
      <div className="card"><div className="metric-label">Técnico</div><div className="metric-value" style={{ fontSize: 20 }}>{one.tecnico ?? "—"}</div></div>
      <div className="card"><div className="metric-label">Categoría</div><div className="metric-value" style={{ fontSize: 20 }}>{one.categoria ?? "—"}</div></div>
      <div className="card"><div className="metric-label">Cierre</div><div style={{ fontSize: 15 }}>{one.cierre ? new Date(one.cierre).toLocaleString("es-PE") : "Sin cierre"}</div><div className="metric-foot">{one.minutos != null ? `${one.minutos} min de atención` : ""}</div></div>
    </div>}
    {ms != null && <div className="subtle" style={{ fontSize: 12 }}>Respondido en {ms} ms con datos actualizados.</div>}
  </section>;
}
