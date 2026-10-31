"use client";
import Link from "next/link";
import { useState } from "react";
import type { ModeloML } from "@/lib/ml/clasificador";
import { entrenar, evaluar, particionTemporal, type Evaluacion, type Fila } from "@/lib/ml/entrenamiento";

type Result = { nuevo: Evaluacion; actual: Evaluacion | null; final: ModeloML; nEntrenamiento: number; nPrueba: number; segundos: number };
const pct = (v: number) => `${(v * 100).toFixed(2)} %`;
const clean = (s: unknown) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
function cellText(v: unknown): string { if (v && typeof v === "object" && "richText" in v) return (v as { richText: Array<{ text: string }> }).richText.map((r) => r.text).join(""); if (v && typeof v === "object" && "text" in v) return String((v as { text: unknown }).text); return v == null ? "" : String(v); }

async function leerExcel(file: File): Promise<Fila[]> {
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook(); await book.xlsx.load(await file.arrayBuffer());
  const sheet = book.worksheets.find((w) => clean(w.name) === "incidencias") ?? book.worksheets[0];
  if (!sheet) throw new Error("El archivo no tiene hojas.");
  const headers = new Map<string, number>(); sheet.getRow(1).eachCell((c, i) => headers.set(clean(cellText(c.value)), i));
  const col = (...names: string[]) => names.map((n) => headers.get(n)).find((i) => i !== undefined);
  const desc = col("descripcion"), title = col("titulo"), cat = col("categoria confirmada"), date = col("fecha de registro", "registrada", "registro", "fecha");
  if (!desc || !cat || !date) throw new Error("El Excel debe tener las columnas «Descripción», «Categoría confirmada» y «Fecha de registro» (o «Registrada»).");
  const filas: Fila[] = [];
  sheet.eachRow((row, i) => {
    if (i === 1) return;
    const d = cellText(row.getCell(desc).value).trim(), c = cellText(row.getCell(cat).value).trim(), t = title ? cellText(row.getCell(title).value).trim() : "";
    const raw = row.getCell(date).value; const fecha = raw instanceof Date ? raw : new Date(cellText(raw));
    if (d && c && !Number.isNaN(fecha.getTime())) filas.push({ texto: t && t !== d ? `${t} ${d}` : d, categoria: c, fecha });
  });
  return filas;
}

export default function Training() {
  const [filas, setFilas] = useState<Fila[]>([]); const [fuente, setFuente] = useState(""); const [corte, setCorte] = useState("2026-07-01"); const [C, setC] = useState(10);
  const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [result, setResult] = useState<Result | null>(null); const [activated, setActivated] = useState("");
  async function fromSystem() { setBusy("datos"); setError(""); setResult(null); try { const r = await fetch("/api/modelo/dataset", { cache: "no-store" }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setFilas(d.filas.map((f: { texto: string; categoria: string; fecha: string }) => ({ ...f, fecha: new Date(f.fecha) }))); setFuente("Incidencias con categoría confirmada en el sistema"); } catch (e) { setError(e instanceof Error ? e.message : "No se cargaron los datos."); } finally { setBusy(""); } }
  async function fromFile(file: File) { setBusy("datos"); setError(""); setResult(null); try { const f = await leerExcel(file); if (f.length < 20) throw new Error(`Solo se encontraron ${f.length} filas válidas.`); setFilas(f); setFuente(`Archivo ${file.name}`); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo leer el Excel."); } finally { setBusy(""); } }
  async function train() {
    setBusy("entrenando"); setError(""); setActivated("");
    await new Promise((r) => setTimeout(r, 50));
    try {
      const t0 = performance.now();
      const { entrenamiento, prueba } = particionTemporal(filas, new Date(`${corte}T00:00:00-05:00`));
      if (entrenamiento.length < 20 || prueba.length < 10) throw new Error("La fecha de corte deja muy pocos casos para entrenar o para probar. Elige otra fecha.");
      const candidato = entrenar(entrenamiento, C);
      const nuevo = evaluar(candidato, prueba);
      const activo = await fetch("/api/modelo/versiones", { cache: "no-store" }).then((r) => r.ok ? r.json() as Promise<ModeloML> : null).catch(() => null);
      const actual = activo ? evaluar(activo, prueba) : null;
      const final = entrenar(filas, C);
      setResult({ nuevo, actual, final, nEntrenamiento: entrenamiento.length, nPrueba: prueba.length, segundos: (performance.now() - t0) / 1000 });
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo entrenar."); } finally { setBusy(""); }
  }
  async function activate() {
    if (!result) return; setBusy("activando"); setError("");
    try { const r = await fetch("/api/modelo/versiones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modelo: result.final, metricas: { ...result.nuevo, fuente, corte, C, nEntrenamiento: result.nEntrenamiento, nPrueba: result.nPrueba }, nEntrenamiento: filas.length, nPrueba: result.nPrueba, exactitud: result.nuevo.exactitud, f1Macro: result.nuevo.f1Macro, kappa: result.nuevo.kappa }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setActivated(d.version); } catch (e) { setError(e instanceof Error ? e.message : "No se activó el modelo."); } finally { setBusy(""); }
  }
  const counts = filas.reduce<Record<string, number>>((a, f) => { a[f.categoria] = (a[f.categoria] ?? 0) + 1; return a; }, {});
  const fechas = filas.map((f) => f.fecha.getTime());
  const m = result?.nuevo; const maxCell = m ? Math.max(...m.matriz.flat()) : 1;
  const approved = m ? m.f1Macro >= 0.8 : false;
  return <><div className="page-head"><div><h1>Entrenar modelo de clasificación</h1><div className="subtle">Carga las incidencias etiquetadas, entrena, revisa la evaluación y decide si activar la nueva versión.</div></div><Link href="/modelo" className="btn ghost">← Panel del modelo</Link></div>
    {error && <div className="alert" style={{ marginBottom: 14 }}>{error}</div>}
    <section className="panel stack" style={{ marginBottom: 17 }}><h2>1. Datos de entrenamiento</h2>
      <div className="filterbar"><button className="btn" onClick={() => void fromSystem()} disabled={!!busy}>{busy === "datos" ? "Cargando…" : "Usar incidencias del sistema"}</button><label className="btn ghost" style={{ cursor: "pointer" }}>Subir Excel (.xlsx)<input id="excel" type="file" accept=".xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void fromFile(f); e.target.value = ""; }}/></label></div>
      <div className="help">El Excel necesita las columnas «Descripción», «Categoría confirmada» y «Fecha de registro» (o «Registrada»). Sirve el histórico original o el «Reporte de incidencias» que descarga el sistema.</div>
      {filas.length > 0 && <div className="kpi-list"><div><div className="metric-label">Fuente</div><div>{fuente}</div></div><div><div className="metric-label">Casos etiquetados</div><div><strong>{filas.length}</strong> · {Object.keys(counts).length} categorías</div></div><div><div className="metric-label">Periodo</div><div>{new Date(Math.min(...fechas)).toLocaleDateString("es-PE")} a {new Date(Math.max(...fechas)).toLocaleDateString("es-PE")}</div></div></div>}
    </section>
    {filas.length > 0 && <section className="panel stack" style={{ marginBottom: 17 }}><h2>2. Entrenar y evaluar</h2>
      <div className="filterbar"><label className="subtle">Fecha de corte <input id="corte" className="field" type="date" value={corte} onChange={(e) => setCorte(e.target.value)}/></label><label className="subtle">Regularización C <input id="c" className="field" type="number" min={0.1} step={0.1} value={C} onChange={(e) => setC(Number(e.target.value) || 10)} style={{ width: 80 }}/></label><button className="btn gold" onClick={() => void train()} disabled={!!busy}>{busy === "entrenando" ? "Entrenando…" : "Entrenar y evaluar"}</button></div>
      <div className="help">Partición temporal: el modelo aprende con lo registrado antes del corte y se evalúa con lo posterior, como pasaría en la operación real. Umbral de aceptación: F1 macro ≥ 0,80.</div>
    </section>}
    {result && m && <>
      <section className="panel stack" style={{ marginBottom: 17 }}><div className="panel-head"><div><h2>3. Resultados de la evaluación</h2><div className="panel-note">{result.nEntrenamiento} casos de entrenamiento · {result.nPrueba} de prueba · {result.segundos.toFixed(1)} s</div></div><span className={`badge ${approved ? "green" : "red"}`}>{approved ? "Supera el umbral" : "No supera el umbral"}</span></div>
        <div style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Métrica (casos de prueba)</th><th>Nuevo entrenamiento</th><th>Modelo activo</th></tr></thead><tbody>
          <tr><td>Exactitud</td><td><strong>{pct(m.exactitud)}</strong></td><td>{result.actual ? pct(result.actual.exactitud) : "—"}</td></tr>
          <tr><td>F1 macro</td><td><strong>{m.f1Macro.toFixed(3)}</strong></td><td>{result.actual ? result.actual.f1Macro.toFixed(3) : "—"}</td></tr>
          <tr><td>Kappa de Cohen</td><td><strong>{m.kappa.toFixed(3)}</strong></td><td>{result.actual ? result.actual.kappa.toFixed(3) : "—"}</td></tr>
        </tbody></table></div>
        <div className="subtle" style={{ fontSize: 12 }}>El modelo activo pudo haber visto estos casos al entrenarse; su resultado aquí puede ser optimista.</div>
      </section>
      <div className="grid2">
        <section className="panel"><h2>Matriz de confusión</h2><div className="panel-note">Filas: categoría real · columnas: categoría predicha</div><div style={{ overflowX: "auto" }}><table className="data-table" style={{ fontSize: 12 }}><thead><tr><th></th>{m.clases.map((c) => <th key={c} title={c}>{c.slice(0, 6)}</th>)}</tr></thead><tbody>{m.clases.map((c, i) => <tr key={c}><td><strong>{c}</strong></td>{m.matriz[i].map((v, j) => <td key={j} style={{ textAlign: "center", background: v ? (i === j ? `rgba(0,184,148,${0.15 + 0.6 * v / maxCell})` : `rgba(214,48,49,${0.15 + 0.6 * v / maxCell})`) : undefined }}>{v || ""}</td>)}</tr>)}</tbody></table></div></section>
        <section className="panel"><h2>Desempeño por categoría</h2><div style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Categoría</th><th>Casos</th><th>Precisión</th><th>Sensibilidad</th><th>F1</th></tr></thead><tbody>{m.porClase.filter((c) => c.n > 0).map((c) => <tr key={c.clase}><td>{c.clase}</td><td>{c.n}</td><td>{c.precision.toFixed(3)}</td><td>{c.recall.toFixed(3)}</td><td>{c.f1.toFixed(3)}</td></tr>)}</tbody></table></div></section>
      </div>
      <section className="panel stack" style={{ marginTop: 17 }}><h2>4. Activar</h2><div className="help">Al activar, la versión final se entrena con todos los casos cargados ({filas.length}) y reemplaza al modelo actual para las incidencias nuevas. Puedes volver a una versión anterior desde el panel del modelo.</div>
        {activated ? <div className="success">Modelo {activated} activado. Las nuevas sugerencias ya lo usan.</div> : <div><button className="btn gold" onClick={() => void activate()} disabled={!!busy || !approved}>{busy === "activando" ? "Activando…" : "Activar este modelo"}</button>{!approved && <span className="subtle" style={{ marginLeft: 10 }}>Solo se puede activar si supera el umbral.</span>}</div>}
      </section>
    </>}
  </>;
}
