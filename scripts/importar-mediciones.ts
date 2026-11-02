// Carga en el módulo de Medición las mediciones reales del pretest y el postest (ficha de observación en Excel):
// 29 incidencias × 4 tareas × 2 fases. La hora de inicio no se registró en la ficha: se usa la fecha de medición
// y se deja constancia en la observación.
// Uso: DATABASE_URL=... pnpm exec tsx scripts/importar-mediciones.ts ficha.xlsx [--aplicar]
import ExcelJS from "exceljs";
import { neon } from "@neondatabase/serverless";
import { categoriaCorrecta, cumplePrecision, tareaPorCodigo, valorReferencia } from "../src/lib/medicion";

const DIA_MEDICION = new Date("2026-11-01T00:00:00-05:00");
const num = (v: ExcelJS.CellValue) => { const n = typeof v === "object" && v && "result" in v ? Number(v.result) : Number(v); if (!Number.isFinite(n)) throw new Error(`Valor no numérico: ${String(v)}`); return n; };
const texto = (v: ExcelJS.CellValue) => String(v ?? "").trim();
const fechaTexto = (d: Date) => d.toLocaleDateString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric" });

async function main() {
  const [archivo] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const aplicar = process.argv.includes("--aplicar");
  const sql = neon(process.env.DATABASE_URL!);
  const [{ n: existentes }] = await sql`select count(*)::int as n from mediciones where not anulada`;
  if (existentes > 0) throw new Error(`Ya hay ${existentes} mediciones activas; no se importa encima.`);
  const [tic01] = await sql`select id from usuarios where codigo = 'TIC-01'`;
  const incs = await sql`select i.codigo, i.registrada_en, i.resuelta_en, i.cerrada_en, i.prioridad, c.nombre as confirmada from incidencias i left join categorias c on c.id = i.categoria_confirmada_id where i.codigo between 'NKM-INC-0001' and 'NKM-INC-0029'`;
  const porCodigo = new Map(incs.map((r) => [r.codigo as string, r]));

  const libro = new ExcelJS.Workbook(); await libro.xlsx.readFile(archivo);
  const filas: Array<Record<string, unknown>> = []; const resumen: Record<string, [number, number]> = {};
  for (const fase of ["pretest", "postest"] as const) {
    const hoja = libro.getWorksheet(fase === "pretest" ? "Pretest" : "Postest")!;
    for (let r = 3; r <= 31; r++) {
      const fila = hoja.getRow(r); const codigo = texto(fila.getCell(1).value); const n = r - 2; const pad = String(n).padStart(2, "0");
      const inc = porCodigo.get(codigo); if (!inc || codigo !== `NKM-INC-${String(n).padStart(4, "0")}`) throw new Error(`Fila ${r} de ${fase}: incidencia inesperada ${codigo}`);
      const fechaConsulta = fase === "pretest" ? (fila.getCell(3).value as Date) : DIA_MEDICION;
      const tareas = [
        { codigo: `C${pad}`, seg: num(fila.getCell(4).value), inicio: fechaConsulta },
        { codigo: `V${pad}`, seg: num(fila.getCell(6).value), inicio: DIA_MEDICION },
        { codigo: `T${pad}`, seg: num(fila.getCell(8).value), inicio: DIA_MEDICION },
        { codigo: `R${pad}`, seg: num(fila.getCell(10).value), inicio: DIA_MEDICION },
      ];
      for (const t of tareas) {
        const tarea = tareaPorCodigo(t.codigo)!; const ms = Math.round(t.seg * 1000);
        const nota = fase === "pretest" && tarea.indicador === "I3" ? "Medida durante la atención de la incidencia (fecha de su registro)" : `Medida el ${fechaTexto(t.inicio)}`;
        const reg: Record<string, unknown> = { indicador: tarea.indicador, fase, tarea: t.codigo, inicio: t.inicio.toISOString(), fin: new Date(t.inicio.getTime() + ms).toISOString(), duracionMs: ms, respuesta: null, datosActualizados: null, valorObtenido: null, valorReferencia: null, cumple: null, observacion: `Importada de la ficha de observación (Excel). ${nota}; la hora de inicio no se registró.`, responsableId: tic01.id };
        if (tarea.indicador === "I3") { const completa = texto(fila.getCell(5).value).toLowerCase().replace("í", "i") === "si"; reg.datosActualizados = completa; reg.cumple = completa; }
        if (tarea.indicador === "I4") { const obtenido = num(fila.getCell(7).value); const ref = valorReferencia(tarea.referencia!, [{ codigo, registradaEn: new Date(inc.registrada_en), resueltaEn: inc.resuelta_en ? new Date(inc.resuelta_en) : null, cerradaEn: inc.cerrada_en ? new Date(inc.cerrada_en) : null, prioridad: inc.prioridad }])!; reg.valorObtenido = obtenido.toFixed(4); reg.valorReferencia = ref.toFixed(4); reg.cumple = cumplePrecision(obtenido, ref, false); }
        if (tarea.indicador === "ML") { const elegida = texto(fila.getCell(9).value); reg.respuesta = elegida; reg.cumple = categoriaCorrecta(elegida, inc.confirmada); }
        if (reg.cumple != null) { const k = `${tarea.indicador} ${fase}`; resumen[k] ??= [0, 0]; resumen[k][0] += reg.cumple ? 1 : 0; resumen[k][1]++; }
        filas.push(reg);
      }
    }
  }
  for (const [k, [si, total]] of Object.entries(resumen).sort()) console.log(`${k}: cumple ${si}/${total}`);
  console.log(`Mediciones a cargar: ${filas.length}`);
  if (!aplicar) { console.log("Simulación: use --aplicar para guardar."); return; }
  for (const f of filas) await sql`insert into mediciones (indicador, fase, tarea, inicio, fin, duracion_ms, respuesta, datos_actualizados, valor_obtenido, valor_referencia, cumple, observacion, responsable_id) values (${f.indicador}, ${f.fase}, ${f.tarea}, ${f.inicio}, ${f.fin}, ${f.duracionMs}, ${f.respuesta}, ${f.datosActualizados}, ${f.valorObtenido}, ${f.valorReferencia}, ${f.cumple}, ${f.observacion}, ${f.responsableId})`;
  console.log(`Guardadas ${filas.length} mediciones.`);
}

main();
