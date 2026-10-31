export interface ModeloML {
  version: string;
  algoritmo: string;
  clases: string[];
  vocabulario: Record<string, number>;
  idf: number[];
  coeficientes: number[][];
  intercepto: number[];
  stopwords: string[];
  metricas_prueba?: {
    exactitud: number;
    f1_macro: number;
    kappa: number;
    n_entrenamiento: number;
    n_prueba: number;
    fecha_corte: string;
  };
}

export interface Sugerencia {
  categoria: string;
  probabilidad: number;
}

export function normalizar(texto: string): string {
  return (texto ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function terminos(texto: string, stopwords: Set<string>): string[] {
  const tokens = texto.match(/\b\w\w+\b/g)?.filter((token) => !stopwords.has(token)) ?? [];
  const terms = [...tokens];
  for (let index = 0; index < tokens.length - 1; index++) {
    terms.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return terms;
}

export function sugerir(modelo: ModeloML, titulo: string, descripcion: string, top = 3): Sugerencia[] {
  if (!modelo.clases.length) return [];
  const counts = new Map<number, number>();
  for (const term of terminos(normalizar(`${titulo} ${descripcion}`), new Set(modelo.stopwords))) {
    const index = modelo.vocabulario[term];
    if (index !== undefined) counts.set(index, (counts.get(index) ?? 0) + 1);
  }

  const vector = new Map<number, number>();
  let normSquared = 0;
  for (const [index, count] of counts) {
    const weight = (1 + Math.log(count)) * modelo.idf[index];
    vector.set(index, weight);
    normSquared += weight * weight;
  }
  const norm = Math.sqrt(normSquared) || 1;
  const scores = modelo.clases.map((_, classIndex) => {
    let score = modelo.intercepto[classIndex];
    for (const [index, value] of vector) {
      score += modelo.coeficientes[classIndex][index] * (value / norm);
    }
    return score;
  });

  const max = Math.max(...scores);
  const exponentials = scores.map((score) => Math.exp(score - max));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return modelo.clases
    .map((categoria, index) => ({ categoria, probabilidad: exponentials[index] / total }))
    .sort((left, right) => right.probabilidad - left.probabilidad)
    .slice(0, top);
}
