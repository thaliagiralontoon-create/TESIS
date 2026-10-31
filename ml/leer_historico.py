import json
import sys
from datetime import date, datetime, time

import pandas as pd


def time_text(value):
    if pd.isna(value):
        return None
    if isinstance(value, (datetime, time)):
        return value.strftime("%H:%M:%S")
    parsed = pd.to_datetime(value, errors="coerce")
    return None if pd.isna(parsed) else parsed.strftime("%H:%M:%S")


def date_text(value):
    if pd.isna(value):
        return None
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d")
    parsed = pd.to_datetime(value, errors="coerce")
    return None if pd.isna(parsed) else parsed.strftime("%Y-%m-%d")


def main():
    frame = pd.read_excel(sys.argv[1], sheet_name="Incidencias")
    required = {
        "ID", "Fecha de registro", "Hora de registro", "Fecha de cierre",
        "Hora de cierre", "Categoría confirmada", "Prioridad", "Área",
        "Usuario (código)", "Descripción", "Técnico (código)", "Estado",
    }
    missing = required - set(frame.columns)
    if missing:
        raise ValueError("Faltan columnas requeridas: " + ", ".join(sorted(missing)))
    records = []
    skipped = []
    allowed_status = {"Abierto", "Asignado", "En proceso", "Resuelto", "Cerrado"}
    allowed_priority = {"Baja", "Media", "Alta", "Crítica"}
    for _, row in frame.iterrows():
        if pd.isna(row["ID"]):
            continue
        registered_date = date_text(row["Fecha de registro"])
        registered_time = time_text(row["Hora de registro"])
        if not registered_date or not registered_time:
            skipped.append(str(row["ID"]))
            continue
        close_date = date_text(row["Fecha de cierre"])
        close_time = time_text(row["Hora de cierre"])
        closed = f"{close_date}T{close_time}-05:00" if close_date and close_time else None
        status = str(row["Estado"]).strip() if not pd.isna(row["Estado"]) else ""
        priority = str(row["Prioridad"]).strip() if not pd.isna(row["Prioridad"]) else ""
        if status not in allowed_status:
            raise ValueError(f"Estado no reconocido en ID {row['ID']}: {status!r}")
        if priority not in allowed_priority:
            raise ValueError(f"Prioridad no reconocida en ID {row['ID']}: {priority!r}")
        records.append({
            "sourceId": str(row["ID"]).strip(),
            "registered": f"{registered_date}T{registered_time}-05:00",
            "closed": closed,
            "userCode": "" if pd.isna(row["Usuario (código)"]) else str(row["Usuario (código)"]).strip(),
            "techCode": "" if pd.isna(row["Técnico (código)"]) else str(row["Técnico (código)"]).strip(),
            "area": "" if pd.isna(row["Área"]) else str(row["Área"]).strip(),
            "description": "" if pd.isna(row["Descripción"]) else str(row["Descripción"]).strip(),
            "confirmed": "" if pd.isna(row["Categoría confirmada"]) else str(row["Categoría confirmada"]).strip(),
            "priority": priority,
            "state": status,
        })
    print(json.dumps({"records": records, "skippedRegistration": skipped}, ensure_ascii=False))


if __name__ == "__main__":
    main()
