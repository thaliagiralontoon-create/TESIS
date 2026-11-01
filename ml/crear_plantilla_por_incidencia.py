"""Plantilla del pretest y el postest con una fila por incidencia de la muestra: las mismas incidencias,
primero a mano con Excel (hoja «Pretest») y luego con el sistema (hoja «Postest»).
Uso: python ml/crear_plantilla_por_incidencia.py base_muestra.xlsx salida.xlsx"""
import sys
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

NAVY, ORANGE = "0B1E6D", "FFD3A3"
head = Font(bold=True, color="FFFFFF"); thin = Side(style="thin", color="D0D5E0")
box = Border(left=thin, right=thin, top=thin, bottom=thin); wrap = Alignment(wrap_text=True, vertical="top")
GRUPO = {"I3": "1E6B52", "I4": "7A4B00", "ML": "5B2A86", "I1": NAVY}
CATEGORIAS = ["Accesos", "Audio", "Conectividad", "Correo electrónico", "Hardware", "Impresora", "Seguridad", "Software/licencias"]

base = load_workbook(sys.argv[1], read_only=True)["Incidencias"]
MUESTRA = [(r[0], r[1]) for r in base.iter_rows(min_row=2, values_only=True) if r[0]]

# (encabezado, ancho, grupo, tipo): tipo s = segundos, sn = Sí/No, cat = categoría, num = número, f = fecha, t = texto
COLS = [
    ("Incidencia", 15, None, None), ("Título", 42, None, None), ("Fecha (dd/mm/aaaa)", 13, None, "f"),
    ("1. Consulta: tiempo (s)", 13, "I3", "s"), ("1. ¿Encontró estado, técnico y fecha de resolución?", 16, "I3", "sn"),
    ("2. Indicador: tiempo (s)", 13, "I4", "s"), ("2. Tiempo de atención calculado (min)", 15, "I4", "num"),
    ("3. Clasificación: tiempo (s)", 14, "ML", "s"), ("3. Categoría elegida", 20, "ML", "cat"),
    ("4. Reporte: tiempo (s)", 13, "I1", "s"),
    ("Observación", 30, None, "t"),
]
TAREAS = [
    ("1. Consulta (I3 · disponibilidad de información)", "Ubicar la incidencia y obtener su estado, el técnico que la atendió y su fecha y hora de resolución."),
    ("2. Indicador (I4 · precisión de indicadores)", "Calcular el tiempo de atención de la incidencia en minutos (desde el registro hasta el cierre o la resolución)."),
    ("3. Clasificación (componente ML)", "Leer el título y la descripción y elegir la categoría (y a quién asignarla). Con el sistema, se parte de la sugerencia del modelo."),
    ("4. Reporte (I1 · eficiencia en reportes)", "Elaborar el reporte de la incidencia (código, categoría, prioridad, técnico, fechas y tiempo de atención)."),
]

wb = Workbook()
ins = wb.active; ins.title = "Instrucciones"
lines = [
    ("Medición del pretest y el postest — muestra de 29 incidencias", True),
    ("Las mismas 29 incidencias se trabajan dos veces: primero a mano con Excel (hoja «Pretest») y después con el sistema (hoja «Postest»).", False),
    ("", False),
    ("Con cada incidencia se hacen 4 tareas, en este orden, cronometrando cada una por separado:", True),
    *[(f"{t} — {d}", False) for t, d in TAREAS],
    ("", False),
    ("Qué llenar (solo las celdas ANARANJADAS):", True),
    ("• Fecha: día en que se trabajó la incidencia en esa fase.", False),
    ("• Tiempo (s): segundos de cada tarea, del inicio al fin del cronómetro.", False),
    ("• ¿Encontró…?: «Sí» si se obtuvieron los tres datos; «No» si faltó alguno.", False),
    ("• Tiempo de atención calculado y Categoría elegida: el resultado que se obtuvo. No se corrige después: la comparación con el valor correcto se hace en el análisis.", False),
    ("• Observación: solo si una tarea se interrumpió.", False),
    ("", False),
    ("Reglas del protocolo:", True),
    ("• Pretest: solo con el Excel de las 29 incidencias, sin abrir el sistema. Postest: solo con el sistema.", False),
    ("• Las 29 incidencias del pretest se terminan antes de empezar el postest.", False),
    ("• La misma persona, la misma computadora y el mismo cronómetro en ambas fases.", False),
    ("• No se repite una tarea para mejorar el tiempo; si se interrumpe, se anota en Observación.", False),
    ("", False),
    ("La hoja «Resumen» calcula sola las medianas. Envía el archivo completo para el análisis (Shapiro-Wilk, Wilcoxon y McNemar).", False),
]
for i, (t, b) in enumerate(lines, start=1):
    c = ins.cell(row=i, column=1, value=t); c.font = Font(bold=b, size=13 if i == 1 else 11, color=NAVY if b else "1E2433"); c.alignment = Alignment(wrap_text=True)
ins.column_dimensions["A"].width = 120

for fase, como in (("Pretest", "a mano con Excel"), ("Postest", "con el sistema")):
    ws = wb.create_sheet(fase)
    ws.cell(row=1, column=1, value=f"{fase.upper()} — {como}").font = Font(bold=True, size=13, color=NAVY)
    for j, (h, w, g, _) in enumerate(COLS, start=1):
        c = ws.cell(row=2, column=j, value=h); c.font = head; c.fill = PatternFill("solid", fgColor=GRUPO.get(g, NAVY))
        c.alignment = Alignment(wrap_text=True, vertical="center"); c.border = box
        ws.column_dimensions[c.column_letter].width = w
    ws.row_dimensions[2].height = 62
    secs = DataValidation(type="decimal", operator="greaterThan", formula1="0", allow_blank=True, error="Escribe los segundos como número mayor que 0.")
    num = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="0", allow_blank=True)
    sn = DataValidation(type="list", formula1='"Sí,No"', allow_blank=True)
    cat = DataValidation(type="list", formula1='"' + ",".join(CATEGORIAS) + '"', allow_blank=True)
    for v in (secs, num, sn, cat): ws.add_data_validation(v)
    for i, (codigo, titulo) in enumerate(MUESTRA, start=3):
        for j, (_, _, _, tipo) in enumerate(COLS, start=1):
            c = ws.cell(row=i, column=j, value=codigo if j == 1 else titulo if j == 2 else None); c.border = box; c.alignment = wrap
            if tipo: c.fill = PatternFill("solid", fgColor=ORANGE)
            if tipo in ("s", "num", "sn", "cat"): {"s": secs, "num": num, "sn": sn, "cat": cat}[tipo].add(c.coordinate)
            if tipo == "f": c.number_format = "dd/mm/yyyy"
    ws.freeze_panes = "C3"

rs = wb.create_sheet("Resumen")
hdr = ["Tarea", "Medidas pretest", "Medidas postest", "Mediana pretest (s)", "Mediana postest (s)", "Variación de la mediana (%)"]
for j, h in enumerate(hdr, start=1):
    c = rs.cell(row=1, column=j, value=h); c.font = head; c.fill = PatternFill("solid", fgColor=NAVY); c.alignment = Alignment(wrap_text=True); c.border = box
    rs.column_dimensions[c.column_letter].width = 18
rs.column_dimensions["A"].width = 48
last = len(MUESTRA) + 2
for r, (col, (tarea, _)) in enumerate(zip("DFHJ", TAREAS), start=2):
    pre, post = f"Pretest!{col}3:{col}{last}", f"Postest!{col}3:{col}{last}"
    vals = [tarea, f"=COUNT({pre})", f"=COUNT({post})", f'=IF(COUNT({pre})=0,"",MEDIAN({pre}))', f'=IF(COUNT({post})=0,"",MEDIAN({post}))', f'=IF(OR(D{r}="",E{r}=""),"",(D{r}-E{r})/D{r}*100)']
    for j, v in enumerate(vals, start=1):
        c = rs.cell(row=r, column=j, value=v); c.border = box
        if j >= 4: c.number_format = "0.0"
rs.cell(row=7, column=1, value="Consultas con los tres datos encontrados (%)").border = box
for j, hoja in ((4, "Pretest"), (5, "Postest")):
    rango = f"{hoja}!E3:E{last}"
    c = rs.cell(row=7, column=j, value=f'=IF(COUNTA({rango})=0,"",COUNTIF({rango},"Sí")/COUNTA({rango})*100)'); c.number_format = "0.0"; c.border = box
rs.cell(row=9, column=1, value="La exactitud del tiempo de atención (I4) y de la categoría (ML) se calcula en el análisis, comparando con los valores registrados.").font = Font(italic=True, color="5B6479")
wb.save(sys.argv[2])
print(f"{len(MUESTRA)} incidencias")
