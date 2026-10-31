export type NumberLike = number | string | null | undefined;
export const num = (value: NumberLike) => Number(value ?? 0);
export const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
export function minutesBetween(start: Date | string, end: Date | string) {
  return (new Date(end).getTime() - new Date(start).getTime()) / 60_000;
}
export function i1(durationsMs: number[]) { return mean(durationsMs.map((value) => value / 60_000)); }
export function i2(rows: Array<{ registered: Date | string; closed?: Date | string | null }>) {
  const durations = rows.filter((row) => row.closed).map((row) => minutesBetween(row.registered, row.closed!));
  return { promedio: mean(durations), mediana: median(durations), n: durations.length };
}
export function i3(rows: Array<{ updated: boolean; responseMs: number }>) {
  return rows.length ? 100 * rows.filter((row) => row.updated && row.responseMs <= 3000).length / rows.length : null;
}
export function i4(rows: Array<{ system: number; recalculated: number }>) {
  return rows.length ? 100 * rows.filter((row) => Math.abs(row.system - row.recalculated) <= .01 * Math.abs(row.recalculated)).length / rows.length : null;
}
export function i5(rows: Array<{ state: string; executed?: Date | string | null; due: Date | string }>) {
  const planned = rows.filter((row) => row.state !== "Cancelada");
  return planned.length ? 100 * planned.filter((row) => row.state === "Ejecutada" && row.executed && new Date(row.executed) <= new Date(row.due)).length / planned.length : null;
}
export function classificationMetrics(rows: Array<{ expected: string; predicted: string }>) {
  if (!rows.length) return { exactitud: null, f1Macro: null, kappa: null, n: 0 };
  const classes = [...new Set(rows.flatMap((row) => [row.expected, row.predicted]))];
  const exact = rows.filter((row) => row.expected === row.predicted).length / rows.length;
  const f1 = classes.map((category) => {
    const tp = rows.filter((row) => row.expected === category && row.predicted === category).length;
    const fp = rows.filter((row) => row.expected !== category && row.predicted === category).length;
    const fn = rows.filter((row) => row.expected === category && row.predicted !== category).length;
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    return precision + recall ? 2 * precision * recall / (precision + recall) : 0;
  }).reduce((a, b) => a + b, 0) / classes.length;
  const predictedMarginals = classes.map((category) => rows.filter((row) => row.predicted === category).length / rows.length);
  const expectedMarginals = classes.map((category) => rows.filter((row) => row.expected === category).length / rows.length);
  const chance = predictedMarginals.reduce((sum, value, index) => sum + value * expectedMarginals[index], 0);
  const kappa = chance === 1 ? null : (exact - chance) / (1 - chance);
  return { exactitud: exact * 100, f1Macro: f1, kappa, n: rows.length };
}
