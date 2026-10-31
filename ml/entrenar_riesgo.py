"""Modelo de riesgo de demora por prioridad (supervivencia de Kaplan-Meier).

Uso: python ml/entrenar_riesgo.py ml/incidencias_riesgo.csv src/lib/ml/modelo_riesgo.json --corte 2026-07-01
Estima, para una incidencia abierta hace t minutos, la probabilidad de superar el umbral (8 h):
P(T > umbral | T > t) = S(umbral) / S(t). Las incidencias sin cierre entran como casos censurados.
Se eligió solo la prioridad porque categoría, área, franja horaria y día no mejoraron el AUC en la prueba temporal.
"""
import argparse
import json
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

PRIORIDADES = ["Crítica", "Alta", "Media", "Baja"]
PASO = 15


def kaplan_meier(duraciones, eventos, rejilla):
    orden = np.argsort(duraciones)
    d, e = np.asarray(duraciones)[orden], np.asarray(eventos)[orden]
    supervivencia, s, i, n = [], 1.0, 0, len(d)
    for t in rejilla:
        while i < n and d[i] <= t:
            en_riesgo = n - i
            if e[i]:
                s *= 1 - 1 / en_riesgo
            i += 1
        supervivencia.append(s)
    return supervivencia


def ajustar(df, umbral, corte):
    rejilla = list(range(0, int(umbral) + PASO, PASO))
    curvas = {}
    for prioridad in PRIORIDADES:
        g = df[df["prioridad"] == prioridad]
        cerradas = g["minutos"].notna()
        duraciones = np.where(cerradas, g["minutos"], (corte - g["fecha"]).dt.total_seconds() / 60)
        curvas[prioridad] = [round(float(v), 6) for v in kaplan_meier(duraciones, cerradas.to_numpy(), rejilla)]
    return rejilla, curvas


def riesgo(curvas, rejilla, prioridad, transcurrido, umbral):
    if transcurrido >= umbral:
        return 1.0
    s = curvas[prioridad]
    k = min(int(transcurrido // PASO), len(rejilla) - 1)
    return 0.0 if s[k] <= 0 else min(1.0, s[-1] / s[k])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv"); ap.add_argument("salida")
    ap.add_argument("--corte", default="2026-07-01"); ap.add_argument("--umbral", type=float, default=480)
    a = ap.parse_args()
    df = pd.read_csv(a.csv, keep_default_na=False, na_values=[""])
    df = df[df["origen"] == "historico"].copy()
    df["fecha"] = pd.to_datetime(df["registrada"], utc=True)
    df["minutos"] = pd.to_numeric(df["minutos"], errors="coerce")
    fin_datos = df["fecha"].max()
    corte = pd.Timestamp(a.corte, tz="America/Lima")

    # Prueba temporal: curvas con los casos previos al corte; se evalúa en los posteriores ya cerrados.
    rejilla, curvas_tr = ajustar(df[df["fecha"] < corte], a.umbral, corte)
    prueba = df[(df["fecha"] >= corte) & df["minutos"].notna()]
    metricas = {"n_entrenamiento": int((df["fecha"] < corte).sum()), "n_prueba": int(len(prueba)), "umbral_min": a.umbral, "fecha_corte": a.corte,
                "tasa_base_prueba": round(float((prueba["minutos"] > a.umbral).mean()), 4)}
    for t in (0, 60, 120, 240):
        vivos = prueba[prueba["minutos"] > t]
        y = (vivos["minutos"] > a.umbral).astype(int)
        p = [riesgo(curvas_tr, rejilla, r["prioridad"], t, a.umbral) for _, r in vivos.iterrows()]
        metricas[f"auc_a_{t}_min"] = round(float(roc_auc_score(y, p)), 4) if y.nunique() > 1 else None
        metricas[f"n_abiertas_a_{t}_min"] = int(len(vivos))
        metricas[f"tasa_real_a_{t}_min"] = round(float(y.mean()), 4) if len(y) else None

    # Modelo final: todo el histórico, con los casos sin cierre censurados al último registro.
    rejilla, curvas = ajustar(df, a.umbral, fin_datos)
    salida = {"version": "riesgo-" + datetime.now().strftime("%Y%m%d-%H%M%S"),
              "algoritmo": "Supervivencia de Kaplan-Meier por prioridad", "umbral_min": a.umbral, "paso_min": PASO,
              "curvas": curvas, "metricas": metricas}
    json.dump(salida, open(a.salida, "w", encoding="utf-8"), ensure_ascii=False)
    print(json.dumps(metricas, ensure_ascii=False))
    print("Riesgo al registrar (P de superar el umbral):", {p: round(c[-1], 3) for p, c in curvas.items()})


if __name__ == "__main__":
    main()
