// Entrenamiento del clasificador en TypeScript (se ejecuta en el navegador del supervisor).
// Reproduce el esquema del script de Python: TF-IDF de unigramas y bigramas con tf sublineal e idf suavizado,
// normalización L2 y regresión logística multinomial con regularización L2 (C) y pesos balanceados por clase.
import { normalizar, sugerir, terminos, type ModeloML } from "./clasificador";

export const STOPWORDS = [...new Set("el la los las de del en y a un una unos unas con para por que se su sus al lo no mi es esta este estos estas son o u le les me nos ya muy mas pero como".split(" "))].sort();
export interface Fila { texto: string; categoria: string; fecha: Date }
export interface MetricasClase { clase: string; n: number; precision: number; recall: number; f1: number }
export interface Evaluacion { exactitud: number; f1Macro: number; kappa: number; n: number; clases: string[]; matriz: number[][]; porClase: MetricasClase[] }

type Muestra = { terms: Map<number, number>; y: number; peso: number };

function ajustarTfidf(textos: string[]) {
  const stop = new Set(STOPWORDS); const vocab = new Map<string, number>(); const df: number[] = [];
  const docs = textos.map((t) => terminos(normalizar(t), stop));
  for (const d of docs) for (const term of new Set(d)) { let j = vocab.get(term); if (j === undefined) { j = vocab.size; vocab.set(term, j); df.push(0); } df[j]++; }
  const n = docs.length; const idf = df.map((d) => Math.log((1 + n) / (1 + d)) + 1);
  return { vocab, idf, stop };
}
function vectorizar(texto: string, vocab: Map<string, number>, idf: number[], stop: Set<string>) {
  const counts = new Map<number, number>();
  for (const term of terminos(normalizar(texto), stop)) { const j = vocab.get(term); if (j !== undefined) counts.set(j, (counts.get(j) ?? 0) + 1); }
  const v = new Map<number, number>(); let norm = 0;
  for (const [j, c] of counts) { const w = (1 + Math.log(c)) * idf[j]; v.set(j, w); norm += w * w; }
  norm = Math.sqrt(norm) || 1; for (const [j, w] of v) v.set(j, w / norm);
  return v;
}

export function entrenar(filas: Fila[], C = 10, iteraciones = 400): ModeloML {
  const clases = [...new Set(filas.map((f) => f.categoria))].sort();
  const { vocab, idf, stop } = ajustarTfidf(filas.map((f) => f.texto));
  // Agrupa textos repetidos para acelerar: el histórico tiene pocas descripciones distintas.
  const grupos = new Map<string, { texto: string; y: number; n: number }>();
  for (const f of filas) { const y = clases.indexOf(f.categoria); const k = `${y}\u0000${f.texto}`; const g = grupos.get(k); if (g) g.n++; else grupos.set(k, { texto: f.texto, y, n: 1 }); }
  const porClase = clases.map((_, k) => filas.filter((f) => f.categoria === clases[k]).length);
  const pesoClase = porClase.map((n) => filas.length / (clases.length * n));
  const muestras: Muestra[] = [...grupos.values()].map((g) => ({ terms: vectorizar(g.texto, vocab, idf, stop), y: g.y, peso: g.n * pesoClase[g.y] }));
  const K = clases.length, V = vocab.size;
  const W = clases.map(() => new Float64Array(V)); const b = new Float64Array(K);
  const mW = clases.map(() => new Float64Array(V)), vW = clases.map(() => new Float64Array(V)); const mb = new Float64Array(K), vb = new Float64Array(K);
  const lr = 0.05, b1 = 0.9, b2 = 0.999, eps = 1e-8;
  for (let it = 1; it <= iteraciones; it++) {
    const gW = clases.map(() => new Float64Array(V)); const gb = new Float64Array(K);
    for (const s of muestras) {
      const z = new Float64Array(K); for (let k = 0; k < K; k++) { let v = b[k]; for (const [j, x] of s.terms) v += W[k][j] * x; z[k] = v; }
      const max = Math.max(...z); let sum = 0; const p = new Float64Array(K); for (let k = 0; k < K; k++) { p[k] = Math.exp(z[k] - max); sum += p[k]; }
      for (let k = 0; k < K; k++) { const g = s.peso * (p[k] / sum - (k === s.y ? 1 : 0)); gb[k] += g; for (const [j, x] of s.terms) gW[k][j] += g * x; }
    }
    // Pérdida: C·Σ peso·entropía cruzada + ½‖W‖²  (misma formulación que scikit-learn), escalada por 1/C.
    for (let k = 0; k < K; k++) {
      for (let j = 0; j < V; j++) { const g = gW[k][j] + W[k][j] / C; mW[k][j] = b1 * mW[k][j] + (1 - b1) * g; vW[k][j] = b2 * vW[k][j] + (1 - b2) * g * g; W[k][j] -= lr * (mW[k][j] / (1 - b1 ** it)) / (Math.sqrt(vW[k][j] / (1 - b2 ** it)) + eps); }
      mb[k] = b1 * mb[k] + (1 - b1) * gb[k]; vb[k] = b2 * vb[k] + (1 - b2) * gb[k] ** 2; b[k] -= lr * (mb[k] / (1 - b1 ** it)) / (Math.sqrt(vb[k] / (1 - b2 ** it)) + eps);
    }
  }
  const round = (x: number) => Math.round(x * 1e6) / 1e6;
  return { version: "", algoritmo: "TF-IDF + regresión logística multinomial (entrenado en el sistema)", clases, vocabulario: Object.fromEntries(vocab), idf: idf.map(round), coeficientes: W.map((row) => [...row].map(round)), intercepto: [...b].map(round), stopwords: STOPWORDS };
}

export function evaluar(modelo: ModeloML, filas: Fila[]): Evaluacion {
  const clases = [...new Set([...modelo.clases, ...filas.map((f) => f.categoria)])].sort();
  const idx = new Map(clases.map((c, i) => [c, i])); const matriz = clases.map(() => clases.map(() => 0));
  for (const f of filas) { const pred = sugerir(modelo, "", f.texto, 1)[0]?.categoria ?? ""; matriz[idx.get(f.categoria)!][idx.get(pred) ?? 0]++; }
  const n = filas.length; const diag = clases.reduce((s, _, i) => s + matriz[i][i], 0);
  const porClase = clases.map((clase, i) => { const tp = matriz[i][i]; const real = matriz[i].reduce((a, b) => a + b, 0); const pred = matriz.reduce((a, row) => a + row[i], 0); const precision = pred ? tp / pred : 0, recall = real ? tp / real : 0; return { clase, n: real, precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0 }; });
  const presentes = porClase.filter((c) => c.n > 0);
  const azar = clases.reduce((s, _, i) => s + (matriz[i].reduce((a, b) => a + b, 0) / n) * (matriz.reduce((a, row) => a + row[i], 0) / n), 0);
  return { exactitud: n ? diag / n : 0, f1Macro: presentes.reduce((s, c) => s + c.f1, 0) / Math.max(1, presentes.length), kappa: azar === 1 ? 0 : (diag / n - azar) / (1 - azar), n, clases, matriz, porClase };
}

// Partición temporal: entrena con lo registrado antes del corte y evalúa con lo posterior.
export function particionTemporal(filas: Fila[], corte: Date) {
  return { entrenamiento: filas.filter((f) => f.fecha < corte), prueba: filas.filter((f) => f.fecha >= corte) };
}
