// Análisis predictivo de incidencias: pronóstico del próximo mes y probabilidad de reincidencia por usuario.
const DAY = 86_400_000;
export const mesLima = (date: Date) => new Date(date.getTime() - 5 * 3_600_000).toISOString().slice(0, 7);
const diasDelMes = (mes: string) => { const [y, m] = mes.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export const mesSiguiente = (mes: string) => { const [y, m] = mes.split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };

export interface PuntoMensual { mes: string; incidencias: number; dias: number; porDia: number }

// Serie mensual con los días observados: el mes en curso se cuenta hasta la fecha de referencia.
export function serieMensual(fechas: Date[], hasta: Date): PuntoMensual[] {
  if (!fechas.length) return [];
  const counts = new Map<string, number>();
  for (const f of fechas) counts.set(mesLima(f), (counts.get(mesLima(f)) ?? 0) + 1);
  const meses = [...counts.keys()].sort(); const actual = mesLima(hasta);
  const serie: PuntoMensual[] = [];
  for (let mes = meses[0]; mes <= meses[meses.length - 1]; mes = mesSiguiente(mes)) {
    const dias = mes === actual ? Number(new Date(hasta.getTime() - 5 * 3_600_000).toISOString().slice(8, 10)) : diasDelMes(mes);
    const n = counts.get(mes) ?? 0;
    serie.push({ mes, incidencias: n, dias, porDia: n / dias });
  }
  return serie;
}

// Regresión lineal de la tasa diaria sobre el número de mes; intervalo de predicción al 80 %.
export function pronosticar(serie: PuntoMensual[]) {
  const n = serie.length;
  if (n < 3) return null;
  const xs = serie.map((_, i) => i), ys = serie.map((p) => p.porDia);
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const b = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / sxx, a = my - b * mx;
  const residuos = ys.map((y, i) => y - (a + b * xs[i]));
  const s = Math.sqrt(residuos.reduce((t, r) => t + r * r, 0) / (n - 2));
  const x0 = n; const mes = mesSiguiente(serie[n - 1].mes); const dias = diasDelMes(mes);
  const tasa = Math.max(0, a + b * x0);
  const margen = 1.28 * s * Math.sqrt(1 + 1 / n + (x0 - mx) ** 2 / sxx) * dias;
  const t = s > 0 ? b / (s / Math.sqrt(sxx)) : Math.sign(b) * Infinity;
  const tendencia = Math.abs(t) < 2 ? "estable" : b > 0 ? "en aumento" : "en descenso";
  return { mes, estimado: Math.round(tasa * dias), minimo: Math.max(0, Math.round(tasa * dias - margen)), maximo: Math.round(tasa * dias + margen), tendencia, cambioMensualPct: my > 0 ? 100 * b / my : 0 };
}

// Validación: pronostica cada uno de los últimos meses completos con los meses previos y mide el error porcentual.
export function validarPronostico(serie: PuntoMensual[], pruebas = 3) {
  const errores: number[] = [];
  for (let k = serie.length - pruebas; k < serie.length; k++) {
    if (k < 3) continue;
    const p = pronosticar(serie.slice(0, k)); const real = serie[k];
    if (!p || !real.incidencias) continue;
    const estimadoMismosDias = p.estimado / diasDelMes(p.mes) * real.dias;
    errores.push(Math.abs(estimadoMismosDias - real.incidencias) / real.incidencias);
  }
  return errores.length ? 100 * errores.reduce((a, b) => a + b, 0) / errores.length : null;
}

// Probabilidad de que un usuario reporte al menos una incidencia en los próximos 30 días.
// Poisson con tasa suavizada hacia el promedio del grupo (gamma-Poisson), con ventana de 90 días.
export function probabilidadesReincidencia(eventos: Array<{ usuario: string; fecha: Date }>, usuarios: string[], referencia: Date, ventanaDias = 90) {
  const desde = referencia.getTime() - ventanaDias * DAY;
  const conteo = new Map<string, number>(usuarios.map((u) => [u, 0]));
  for (const e of eventos) if (e.fecha.getTime() > desde && e.fecha.getTime() <= referencia.getTime() && conteo.has(e.usuario)) conteo.set(e.usuario, conteo.get(e.usuario)! + 1);
  const meses = ventanaDias / 30;
  const promedio = usuarios.length ? [...conteo.values()].reduce((a, b) => a + b, 0) / usuarios.length / meses : 0;
  const peso = 1; // equivale a un mes de evidencia del promedio del grupo
  return new Map(usuarios.map((u) => { const lambda = (conteo.get(u)! + promedio * peso) / (meses + peso); return [u, { probabilidad: 1 - Math.exp(-lambda), recientes: conteo.get(u)!, esperadas: lambda }]; }));
}

export function auc(puntajes: number[], reales: boolean[]) {
  const pos = puntajes.filter((_, i) => reales[i]), neg = puntajes.filter((_, i) => !reales[i]);
  if (!pos.length || !neg.length) return null;
  let suma = 0;
  for (const p of pos) for (const q of neg) suma += p > q ? 1 : p === q ? 0.5 : 0;
  return suma / (pos.length * neg.length);
}

// Validación temporal: con los datos hasta hace 30 días, ¿quiénes reportaron en los últimos 30?
export function validarReincidencia(eventos: Array<{ usuario: string; fecha: Date }>, usuarios: string[], referencia: Date) {
  const corte = new Date(referencia.getTime() - 30 * DAY);
  const pred = probabilidadesReincidencia(eventos, usuarios, corte);
  const reportaron = new Set(eventos.filter((e) => e.fecha > corte && e.fecha <= referencia).map((e) => e.usuario));
  const prob = usuarios.map((u) => pred.get(u)!.probabilidad), real = usuarios.map((u) => reportaron.has(u));
  return { auc: auc(prob, real), esperado: 100 * prob.reduce((a, b) => a + b, 0) / Math.max(1, usuarios.length), observado: 100 * real.filter(Boolean).length / Math.max(1, usuarios.length) };
}

export const nivelProbabilidad = (p: number) => p >= 0.7 ? "Alta" : p >= 0.4 ? "Media" : "Baja";
