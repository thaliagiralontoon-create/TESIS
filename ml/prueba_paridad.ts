import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sugerir, type ModeloML } from "../src/lib/ml/clasificador";

const modelPath = resolve(process.cwd(), "src/lib/ml/modelo.json");
const controlPath = resolve(process.cwd(), "ml/modelo_control.json");
const modelo = JSON.parse(readFileSync(modelPath, "utf8")) as ModeloML;
const control = JSON.parse(readFileSync(controlPath, "utf8")) as Array<{
  texto: string;
  categoria: string;
  probabilidad: number;
}>;
let iguales = 0;
let maxDiferencia = 0;

for (const sample of control) {
  const [suggestion] = sugerir(modelo, "", sample.texto, 1);
  if (suggestion?.categoria === sample.categoria) iguales++;
  if (suggestion) maxDiferencia = Math.max(maxDiferencia, Math.abs(suggestion.probabilidad - sample.probabilidad));
}

console.log(`Coinciden ${iguales}/${control.length}; diferencia máxima ${maxDiferencia.toExponential(2)}`);
if (iguales !== control.length || maxDiferencia > 0.000001) process.exitCode = 1;
