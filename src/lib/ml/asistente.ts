// Asistente ML: relaciona una incidencia con el procedimiento conocido más parecido y con casos ya resueltos.
// Usa similitud de coseno sobre TF-IDF de palabras recortadas (prefijo de 5 letras) para tolerar variantes
// como «teclado/teclas» o «imprime/imprimir».
import { normalizar } from "./clasificador";

export interface Procedimiento { id: string; categoria: string; titulo: string; remoto: boolean; repuesto: string | null; pasos: string[]; texto: string; casos: number; cerradas: number; medianaMin: number | null; p75Min: number | null; pctMas8h: number | null }
export interface BaseConocimiento { version: string; estado: string; procedimientos: Procedimiento[] }

const STOP = new Set("el la los las de del en y a un una unos unas con para por que se su sus al lo no mi es esta este estos estas son o u le les me nos ya muy mas pero como hay tiene presenta".split(" "));

export function tokens(texto: string) {
  return (normalizar(texto).match(/\b\w\w+\b/g) ?? []).filter((t) => !STOP.has(t)).map((t) => t.slice(0, 5));
}

type Vector = Map<string, number>;
function vector(toks: string[], idf: Map<string, number>): Vector {
  const counts = new Map<string, number>(); for (const t of toks) if (idf.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
  const v: Vector = new Map(); let norm = 0;
  for (const [t, c] of counts) { const w = (1 + Math.log(c)) * idf.get(t)!; v.set(t, w); norm += w * w; }
  norm = Math.sqrt(norm) || 1; for (const [t, w] of v) v.set(t, w / norm);
  return v;
}
const coseno = (a: Vector, b: Vector) => { let s = 0; for (const [t, w] of a) s += w * (b.get(t) ?? 0); return s; };

export interface Indice<T> { items: T[]; idf: Map<string, number>; vectores: Vector[] }
export function indexar<T>(items: T[], texto: (item: T) => string): Indice<T> {
  const docs = items.map((i) => tokens(texto(i)));
  const df = new Map<string, number>(); for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = new Map([...df].map(([t, n]) => [t, Math.log((1 + docs.length) / (1 + n)) + 1]));
  return { items, idf, vectores: docs.map((d) => vector(d, idf)) };
}
export function buscar<T>(indice: Indice<T>, texto: string, top = 3, bonus?: (item: T) => number) {
  const q = vector(tokens(texto), indice.idf);
  return indice.items.map((item, i) => ({ item, similitud: coseno(q, indice.vectores[i]) + (bonus?.(item) ?? 0) }))
    .filter((r) => r.similitud > 0).sort((a, b) => b.similitud - a.similitud).slice(0, top);
}

let cacheBase: { base: BaseConocimiento; indice: Indice<Procedimiento> } | null = null;
export function indiceBase(base: BaseConocimiento) {
  if (cacheBase?.base !== base) cacheBase = { base, indice: indexar(base.procedimientos, (p) => p.texto) };
  return cacheBase.indice;
}

// Procedimiento recomendado: el más parecido, con un pequeño refuerzo si coincide con la categoría sugerida o confirmada.
export function recomendarProcedimiento(base: BaseConocimiento, texto: string, categoria: string | null) {
  const resultados = buscar(indiceBase(base), texto, 3, (p) => (categoria && p.categoria === categoria ? 0.1 : 0));
  const mejor = resultados[0];
  if (!mejor || mejor.similitud < 0.2) return { procedimiento: null, confianza: 0, alternativas: [] as Procedimiento[] };
  return { procedimiento: mejor.item, confianza: Math.min(1, mejor.similitud), alternativas: resultados.slice(1).map((r) => r.item) };
}

// Acción concreta para ahorrar tiempo según el procedimiento recomendado.
export function accionPreparacion(p: Procedimiento | null) {
  if (!p) return null;
  if (p.repuesto) return `Llevar «${p.repuesto}» desde el almacén antes de ir, para resolver en una sola visita.`;
  if (p.remoto) return "Se puede resolver en remoto: atender por acceso remoto o llamada antes de desplazarse.";
  return "Requiere visita en sitio: revisar el procedimiento antes de ir.";
}
