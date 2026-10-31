"""Plantilla Excel del pretest y el postest, con la misma hoja «Pares» que exporta el sistema.
Uso: python ml/crear_plantilla_medicion.py salida.xlsx"""
import sys
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

NAVY, GOLD, GREY = "0B1E6D", "F5C400", "F5F7FB"
head = Font(bold=True, color="FFFFFF"); fill = PatternFill("solid", fgColor=NAVY); thin = Side(style="thin", color="D0D5E0")
box = Border(left=thin, right=thin, top=thin, bottom=thin); wrap = Alignment(wrap_text=True, vertical="top")

# Mismo protocolo que src/lib/medicion.ts: muestra de 29 incidencias, una tarea por incidencia.
MESES = ["marzo", "abril", "junio", "julio", "agosto", "setiembre"]
CONS = ["Estado actual de la incidencia NKM-INC-0007", "Técnico que atendió la incidencia NKM-INC-0015", "Categoría confirmada de la incidencia NKM-INC-0019", "Fecha y hora de resolución de la incidencia NKM-INC-0022", "Número de incidencias registradas en julio de 2026", "Número de incidencias de la categoría Hardware", "Mediana del tiempo de atención de las incidencias de prioridad Baja"]
VERIF = ["Número de incidencias registradas en julio 2026", "Número de incidencias registradas en agosto 2026", "Tiempo medio de atención (min) de las incidencias de julio 2026", "Tiempo medio de atención (min) de las incidencias de agosto 2026", "Tiempo medio de atención (min) de las incidencias de setiembre 2026", "Número de incidencias de prioridad Media", "Número de incidencias de prioridad Baja"]
CASOS = ["0012", "0016", "0019", "0020", "0021", "0024", "0006"]
TAREAS = ([("I1", f"R{k+1:02d}", f"Reporte mensual de incidencias de la muestra — {m} 2026") for k, m in enumerate(MESES)]
          + [("I1", "R07", "Reporte de atención por categoría (muestra de 29 incidencias)"), ("I1", "R08", "Reporte de atención por prioridad (muestra de 29 incidencias)")]
          + [("I3", f"C{k+1:02d}", c) for k, c in enumerate(CONS)]
          + [("I4", f"V{k+1:02d}", v) for k, v in enumerate(VERIF)]
          + [("ML", f"T{k+1:02d}", f"Clasificar la incidencia NKM-INC-{c} y decidir a quién asignarla") for k, c in enumerate(CASOS)])
NOMBRE = {"I1": "Generación de reportes", "I3": "Disponibilidad de información", "I4": "Precisión de indicadores", "ML": "Clasificación de incidencias (ML)"}
CRITERIO = {"I1": "No aplica (solo tiempo)", "I3": "Sí, si la respuesta salió con datos actualizados en 60 s o menos", "I4": "Sí, si el valor difiere de la referencia 1 % o menos (0,5 en conteos)", "ML": "Sí, si la categoría elegida es la confirmada por el técnico"}

wb = Workbook()
ins = wb.active; ins.title = "Instrucciones"
lines = [
    ("Plantilla de medición del pretest y el postest", True),
    ("Lo más fácil es no llenarla a mano: el sistema genera este mismo archivo en Reportes → «Comparación manual vs. sistema». Usa esta plantilla solo si mediste fuera del sistema.", False),
    ("", False),
    ("Cómo llenarla (hoja «Pares», una fila por tarea): llena solo las celdas de color ANARANJADO.", True),
    ("1. Manual (s): segundos que tardó la tarea hecha a mano con Excel (pretest).", False),
    ("2. Sistema (s): segundos que tardó la misma tarea hecha con el sistema (postest).", False),
    ("3. Manual cumple / Sistema cumple: «Sí» o «No» según el criterio de la columna «Criterio» (en reportes I1 se deja vacío).", False),
    ("4. Fecha manual / Fecha sistema: día en que se midió cada fase (dd/mm/aaaa).", False),
    ("5. Observación: solo si una tarea se interrumpió y se repitió.", False),
    ("", False),
    ("Reglas del protocolo:", True),
    ("• Todas las tareas del pretest se hacen antes de empezar el postest.", False),
    ("• La misma persona, la misma computadora y el mismo cronómetro en ambas fases.", False),
    ("• No se repite una tarea para mejorar el tiempo; si se interrumpe, se anota en Observación.", False),
    ("", False),
    ("La hoja «Resumen» calcula sola las medianas y porcentajes. Envía el archivo completo para el análisis estadístico (Shapiro-Wilk, Wilcoxon y McNemar).", False),
]
for i, (t, b) in enumerate(lines, start=1):
    c = ins.cell(row=i, column=1, value=t); c.font = Font(bold=b, size=13 if i == 1 else 11, color=NAVY if b else "1E2433"); c.alignment = Alignment(wrap_text=True)
ins.column_dimensions["A"].width = 110

ws = wb.create_sheet("Pares")
cols = ["Indicador", "Tarea", "Descripción", "Criterio de cumplimiento", "Manual (s)", "Sistema (s)", "Diferencia (s)", "Manual cumple", "Sistema cumple", "Fecha manual", "Fecha sistema", "Observación"]
widths = [12, 8, 60, 42, 12, 12, 14, 14, 14, 14, 14, 30]
for j, (h, w) in enumerate(zip(cols, widths), start=1):
    c = ws.cell(row=1, column=j, value=h); c.font = head; c.fill = fill; c.alignment = Alignment(wrap_text=True, vertical="center"); c.border = box
    ws.column_dimensions[c.column_letter].width = w
yes_no = DataValidation(type="list", formula1='"Sí,No"', allow_blank=True); ws.add_data_validation(yes_no)
secs = DataValidation(type="decimal", operator="greaterThan", formula1="0", allow_blank=True, error="Escribe los segundos como número mayor que 0."); ws.add_data_validation(secs)
for i, (ind, tarea, desc) in enumerate(TAREAS, start=2):
    vals = [ind, tarea, desc, CRITERIO[ind], None, None, f'=IF(AND(ISNUMBER(E{i}),ISNUMBER(F{i})),E{i}-F{i},"")', None, None, None, None, None]
    for j, v in enumerate(vals, start=1):
        c = ws.cell(row=i, column=j, value=v); c.border = box; c.alignment = wrap
        if j in (5, 6, 10, 11) or (j in (8, 9) and ind != "I1"): c.fill = PatternFill("solid", fgColor="FFD3A3")
        if j in (8, 9) and ind == "I1": c.value = "No aplica"; c.font = Font(color="9AA3B5", italic=True)
    secs.add(f"E{i}"); secs.add(f"F{i}")
    if ind != "I1": yes_no.add(f"H{i}"); yes_no.add(f"I{i}")
    ws.cell(row=i, column=10).number_format = "dd/mm/yyyy"; ws.cell(row=i, column=11).number_format = "dd/mm/yyyy"
ws.freeze_panes = "E2"; ws.auto_filter.ref = f"A1:L{len(TAREAS) + 1}"

rs = wb.create_sheet("Resumen")
hdr = ["Indicador", "Tareas", "Medidas manual", "Medidas sistema", "Mediana manual (s)", "Mediana sistema (s)", "Variación de la mediana (%)", "Manual cumple (%)", "Sistema cumple (%)", "Cambio (p. p.)"]
for j, h in enumerate(hdr, start=1):
    c = rs.cell(row=1, column=j, value=h); c.font = head; c.fill = fill; c.alignment = Alignment(wrap_text=True); c.border = box
    rs.column_dimensions[c.column_letter].width = 18
rs.column_dimensions["A"].width = 34
rows = {}
for i, (ind, *_ ) in enumerate(TAREAS, start=2):
    rows.setdefault(ind, [i, i])[1] = i
for r, (ind, (a, b)) in enumerate(rows.items(), start=2):
    E, F, H, I = f"Pares!E{a}:E{b}", f"Pares!F{a}:F{b}", f"Pares!H{a}:H{b}", f"Pares!I{a}:I{b}"
    vals = [f"{ind} · {NOMBRE[ind]}", b - a + 1, f"=COUNT({E})", f"=COUNT({F})", f'=IF(COUNT({E})=0,"",MEDIAN({E}))', f'=IF(COUNT({F})=0,"",MEDIAN({F}))', f'=IF(OR(E{r}="",F{r}=""),"",(E{r}-F{r})/E{r}*100)']
    if ind == "I1":
        vals += ["—", "—", "—"]
    else:
        vals += [f'=IF(COUNTA({H})=0,"",COUNTIF({H},"Sí")/COUNTA({H})*100)', f'=IF(COUNTA({I})=0,"",COUNTIF({I},"Sí")/COUNTA({I})*100)', f'=IF(OR(H{r}="",I{r}=""),"",I{r}-H{r})']
    for j, v in enumerate(vals, start=1):
        c = rs.cell(row=r, column=j, value=v); c.border = box
        if j >= 5: c.number_format = "0.0"
rs.cell(row=7, column=1, value="En I1 la tesis presenta el tiempo en minutos: divide las medianas entre 60.").font = Font(italic=True, color="5B6479")
wb.save(sys.argv[1])
print(f"{len(TAREAS)} tareas")
