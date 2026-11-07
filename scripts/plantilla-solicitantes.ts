// Genera el Excel para indicar qué colaborador (y área) reportó cada una de las 29 incidencias de la muestra.
// Uso: DATABASE_URL=... pnpm exec tsx scripts/plantilla-solicitantes.ts salida.xlsx
import ExcelJS from "exceljs";
import { neon } from "@neondatabase/serverless";

async function main() {
  const salida = process.argv[2];
  const sql = neon(process.env.DATABASE_URL!);
  const colab = await sql`select u.codigo, a.nombre as area from usuarios u join areas a on a.id = u.area_id where u.rol = 'colaborador' and u.activo order by a.nombre, u.codigo`;
  const incs = await sql`select codigo, titulo, registrada_en from incidencias where codigo between 'NKM-INC-0001' and 'NKM-INC-0029' order by codigo`;
  const libro = new ExcelJS.Workbook(); const hoja = libro.addWorksheet("Solicitantes"); const lista = libro.addWorksheet("Colaboradores");
  lista.columns = [{ header: "Opción", key: "op", width: 28 }, { header: "Código", key: "codigo", width: 10 }, { header: "Área", key: "area", width: 20 }];
  colab.forEach((c) => lista.addRow({ op: `${c.codigo} · ${c.area}`, codigo: c.codigo, area: c.area }));
  hoja.addRow(["Solicitante de cada incidencia: elige en la columna D el colaborador que la reportó, según tus registros. Si no lo sabes, déjala vacía."]);
  hoja.getRow(1).font = { bold: true };
  hoja.addRow([]);
  hoja.addRow(["Incidencia", "Título", "Registrada", "Colaborador que la reportó"]);
  hoja.getRow(3).font = { bold: true };
  for (const i of incs) hoja.addRow([i.codigo, i.titulo, new Date(i.registrada_en).toLocaleString("es-PE", { timeZone: "America/Lima" }), ""]);
  hoja.columns.forEach((c, k) => { c.width = [14, 60, 20, 30][k]; });
  for (let r = 4; r < 4 + incs.length; r++) {
    hoja.getCell(`D${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`Colaboradores!$A$2:$A$${colab.length + 1}`] };
    hoja.getCell(`D${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
  }
  await libro.xlsx.writeFile(salida); console.log(`${incs.length} incidencias, ${colab.length} colaboradores -> ${salida}`);
}

main();
