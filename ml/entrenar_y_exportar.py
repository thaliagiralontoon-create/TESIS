import argparse
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, cohen_kappa_score, f1_score, precision_recall_fscore_support
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC
from sklearn.naive_bayes import MultinomialNB
from sklearn.ensemble import RandomForestClassifier

STOPWORDS = sorted(set((
    "el la los las de del en y a un una unos unas con para por que se su sus al lo no mi "
    "es esta este estos estas son o u le les me nos ya muy mas pero como"
).split()))


def normalizar(value):
    text = unicodedata.normalize("NFKD", str(value or "").lower())
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", text)).strip()


def pipeline():
    return Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words=STOPWORDS)),
        ("clf", LogisticRegression(max_iter=2000, C=10, class_weight="balanced")),
    ])


def main():
    parser = argparse.ArgumentParser(description="Entrena y exporta TF-IDF + regresión logística para Nakama.")
    parser.add_argument("excel", type=Path)
    parser.add_argument("salida", type=Path)
    parser.add_argument("--corte", default="2026-07-01")
    args = parser.parse_args()

    frame = pd.read_excel(args.excel, sheet_name="Incidencias")
    required = {"Descripción", "Categoría confirmada", "Fecha de registro"}
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"Faltan columnas requeridas: {', '.join(sorted(missing))}")
    frame = frame.dropna(subset=["Descripción", "Categoría confirmada", "Fecha de registro"]).copy()
    frame["texto"] = frame["Descripción"].map(normalizar)
    frame = frame[frame["texto"].str.len() > 0]
    frame["fecha"] = pd.to_datetime(frame["Fecha de registro"], errors="coerce")
    frame = frame.dropna(subset=["fecha"]).sort_values("fecha")
    cutoff = pd.Timestamp(args.corte)
    train = frame[frame["fecha"] < cutoff]
    test = frame[frame["fecha"] >= cutoff]
    if train.empty or test.empty:
        raise ValueError(f"El corte {args.corte} deja un conjunto vacío (entrenamiento={len(train)}, prueba={len(test)}).")
    absent_test_classes = sorted(set(train["Categoría confirmada"]) - set(test["Categoría confirmada"]))
    absent_train_classes = sorted(set(test["Categoría confirmada"]) - set(train["Categoría confirmada"]))
    if absent_test_classes or absent_train_classes:
        raise ValueError(
            "El corte temporal no contiene las mismas categorías en ambos grupos. "
            f"Solo en entrenamiento: {absent_test_classes}; solo en prueba: {absent_train_classes}."
        )

    validation_model = pipeline().fit(train["texto"], train["Categoría confirmada"])
    predicted = validation_model.predict(test["texto"])
    actual = test["Categoría confirmada"]
    metrics = {
        "exactitud": round(float(accuracy_score(actual, predicted)), 6),
        "f1_macro": round(float(f1_score(actual, predicted, average="macro", zero_division=0)), 6),
        "kappa": round(float(cohen_kappa_score(actual, predicted)), 6),
        "n_entrenamiento": int(len(train)),
        "n_prueba": int(len(test)),
        "fecha_corte": args.corte,
        "categorias": {},
    }
    precision, recall, f1, support = precision_recall_fscore_support(
        actual, predicted, labels=validation_model.named_steps["clf"].classes_, zero_division=0
    )
    for index, category in enumerate(validation_model.named_steps["clf"].classes_):
        metrics["categorias"][str(category)] = {
            "precision": round(float(precision[index]), 6),
            "recall": round(float(recall[index]), 6),
            "f1": round(float(f1[index]), 6),
            "casos_prueba": int(support[index]),
        }

    candidates = {
        "Regresión logística": pipeline(),
        "SVM lineal": Pipeline([
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words=STOPWORDS)),
            ("clf", LinearSVC(C=1, class_weight="balanced", random_state=42)),
        ]),
        "Naive Bayes multinomial": Pipeline([
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words=STOPWORDS)),
            ("clf", MultinomialNB()),
        ]),
        "Bosque aleatorio": Pipeline([
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words=STOPWORDS)),
            ("clf", RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=42, n_jobs=-1)),
        ]),
    }
    comparison = []
    for name, candidate in candidates.items():
        fitted = validation_model if name == "Regresión logística" else candidate.fit(train["texto"], train["Categoría confirmada"])
        estimate = fitted.predict(test["texto"])
        comparison.append({
            "algoritmo": name,
            "exactitud": round(float(accuracy_score(actual, estimate)), 6),
            "f1_macro": round(float(f1_score(actual, estimate, average="macro", zero_division=0)), 6),
            "kappa": round(float(cohen_kappa_score(actual, estimate)), 6),
        })

    final_model = pipeline().fit(frame["texto"], frame["Categoría confirmada"])
    vectorizer = final_model.named_steps["tfidf"]
    classifier = final_model.named_steps["clf"]
    vocabulary = {term: int(index) for term, index in vectorizer.vocabulary_.items()}
    version = "logreg-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    model = {
        "version": version,
        "algoritmo": "TF-IDF + regresión logística multinomial",
        "entrenado_en": datetime.now(timezone.utc).isoformat(),
        "clases": [str(category) for category in classifier.classes_],
        "vocabulario": vocabulary,
        "idf": [round(float(value), 8) for value in vectorizer.idf_],
        "coeficientes": [[round(float(value), 8) for value in row] for row in classifier.coef_],
        "intercepto": [round(float(value), 8) for value in classifier.intercept_],
        "stopwords": STOPWORDS,
        "ngramas": [1, 2],
        "metricas_prueba": metrics,
        "comparacion_algoritmos": comparison,
    }
    args.salida.parent.mkdir(parents=True, exist_ok=True)
    args.salida.write_text(json.dumps(model, ensure_ascii=False), encoding="utf-8")

    control = []
    samples = test.sample(min(40, len(test)), random_state=1)
    for text, expected in zip(samples["texto"], final_model.predict(samples["texto"])):
        probabilities = final_model.predict_proba([text])[0]
        control.append({
            "texto": text,
            "categoria": str(expected),
            "probabilidad": round(float(max(probabilities)), 8),
        })
    control_path = Path("ml/modelo_control.json")
    control_path.parent.mkdir(parents=True, exist_ok=True)
    control_path.write_text(json.dumps(control, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"version": version, **metrics, "comparacion_algoritmos": comparison, "control": len(control)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
