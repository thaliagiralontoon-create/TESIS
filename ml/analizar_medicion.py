"""Contraste de hipótesis del pretest y postest a partir de la ficha de medición exportada.

Uso: python ml/analizar_medicion.py nakama-medicion-AAAA-MM-DD.xlsx
I1: Shapiro-Wilk de las diferencias, Wilcoxon de rangos con signo y r = |Z| / sqrt(N).
I3 e I4: prueba exacta de McNemar.
ML (clasificación y asignación): Wilcoxon del tiempo y McNemar del acierto. Todas bilaterales con alfa = 0,05.
"""
import json
import math
import sys

import pandas as pd
from scipy import stats

ALFA = 0.05


def describir(valores):
    s = pd.Series(valores, dtype=float)
    return {
        "n": int(s.count()), "media": round(s.mean(), 4), "de": round(s.std(ddof=1), 4),
        "mediana": round(s.median(), 4), "q1": round(s.quantile(0.25), 4), "q3": round(s.quantile(0.75), 4),
        "min": round(s.min(), 4), "max": round(s.max(), 4),
    }


def analizar_tiempos(pares, indicador="I1", divisor=60):
    p = pares[pares["Indicador"] == indicador].dropna(subset=["Manual (s)", "Sistema (s)"])
    pre, post = p["Manual (s)"].astype(float) / divisor, p["Sistema (s)"].astype(float) / divisor
    if len(p) < 3:
        return {"error": f"Faltan pares de {indicador}: {len(p)}"}
    dif = pre - post
    sw = stats.shapiro(dif)
    w = stats.wilcoxon(pre, post, alternative="two-sided", method="approx")
    z = float(w.zstatistic) if hasattr(w, "zstatistic") else float(stats.norm.isf(w.pvalue / 2))
    mediana_pre, mediana_post = pre.median(), post.median()
    return {
        "unidad": "min" if divisor == 60 else "s", "pretest": describir(pre), "postest": describir(post),
        "variacion_mediana_pct": round((mediana_pre - mediana_post) / mediana_pre * 100, 2),
        "shapiro_wilk_diferencias": {"W": round(sw.statistic, 4), "p": round(sw.pvalue, 4), "normal": bool(sw.pvalue >= ALFA)},
        "wilcoxon": {"W": float(w.statistic), "Z": round(abs(z), 4), "p": round(float(w.pvalue), 6),
                     "r": round(abs(z) / math.sqrt(len(p)), 4), "rechaza_H0": bool(w.pvalue < ALFA)},
    }


def analizar_proporcion(pares, medidas, indicador):
    p = pares[pares["Indicador"] == indicador]
    p = p[p["Manual cumple"].isin(["Sí", "No"]) & p["Sistema cumple"].isin(["Sí", "No"])]
    if not len(p):
        return {"error": f"Faltan pares de {indicador}"}
    pre, post = p["Manual cumple"] == "Sí", p["Sistema cumple"] == "Sí"
    a_favor = int((~pre & post).sum())     # no cumplía en el pretest y cumplió en el postest
    en_contra = int((pre & ~post).sum())   # cumplía y dejó de cumplir
    discordantes = a_favor + en_contra
    p_valor = 1.0 if discordantes == 0 else float(stats.binomtest(a_favor, discordantes, 0.5).pvalue)
    hoja = medidas.get(indicador)
    if hoja is not None:
        tiempos = {fase: round(hoja[hoja["Fase"] == etiqueta]["Segundos"].astype(float).median(), 2) for fase, etiqueta in (("pretest", "Manual"), ("postest", "Sistema"))}
    else:  # plantilla llenada a mano: los tiempos están en la hoja Pares
        tiempos = {"pretest": round(p["Manual (s)"].astype(float).median(), 2), "postest": round(p["Sistema (s)"].astype(float).median(), 2)}
    pct_pre, pct_post = 100 * pre.mean(), 100 * post.mean()
    return {
        "n_pares": len(p), "pretest_cumple_pct": round(pct_pre, 2), "postest_cumple_pct": round(pct_post, 2),
        "cambio_pp": round(pct_post - pct_pre, 2), "mediana_segundos": tiempos,
        "mcnemar_exacta": {"a_favor": a_favor, "en_contra": en_contra, "p": round(p_valor, 6), "rechaza_H0": bool(p_valor < ALFA)},
    }


def main():
    archivo = sys.argv[1]
    pares = pd.read_excel(archivo, sheet_name="Pares")
    hojas = pd.ExcelFile(archivo).sheet_names
    medidas = {code: pd.read_excel(archivo, sheet_name=f"M_{code}") for code in ("I3", "I4", "ML") if f"M_{code}" in hojas}
    resultado = {
        "I1": analizar_tiempos(pares, "I1", 60),
        "I3": analizar_proporcion(pares, medidas, "I3"), "I4": analizar_proporcion(pares, medidas, "I4"),
        # Clasificación y asignación: tiempo (Wilcoxon) y acierto de la categoría (McNemar).
        "ML": {"tiempo": analizar_tiempos(pares, "ML", 1), "acierto": analizar_proporcion(pares, medidas, "ML")},
    }
    print(json.dumps(resultado, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
