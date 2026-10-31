process.env.NAKAMA_LOCAL_DB ??= "1";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db/client";
import { modelosMl } from "../src/db/schema";
import { closeLocalDatabase } from "../src/db/local-client";

async function main(){const path=resolve(process.argv[2]||"src/lib/ml/modelo.json");const model=JSON.parse(await readFile(path,"utf8"));const metrics=model.metricas_prueba;const db=await getDb();await db.update(modelosMl).set({activo:false});await db.insert(modelosMl).values({version:model.version,algoritmo:model.algoritmo,entrenadoEn:new Date(model.entrenado_en),nEntrenamiento:metrics.n_entrenamiento,nPrueba:metrics.n_prueba,exactitud:String(metrics.exactitud),f1Macro:String(metrics.f1_macro),kappa:String(metrics.kappa),metricasJson:metrics,activo:true}).onConflictDoUpdate({target:modelosMl.version,set:{activo:true,metricasJson:metrics}});const [active]=await db.select().from(modelosMl).where(eq(modelosMl.version,model.version));console.log(`Modelo ${active.version} registrado como activo.`);}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(closeLocalDatabase);
