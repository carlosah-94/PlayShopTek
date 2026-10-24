"""IA 2 · Clasificación (aprendizaje SUPERVISADO): entender qué quiere el cliente en el chat.

Aprende de ejemplos ya etiquetados (datos/intenciones.csv), como un practicante que lee
un cuaderno con mensajes de clientes y el área a la que corresponde cada uno. Pasos:
  1. pandas carga los ejemplos (texto + intención).
  2. TF-IDF convierte cada mensaje en números: sus palabras y sus pedacitos de 3 a 5 letras
     (así entiende "drift", "driff" y "dirft" casi igual).
  3. Se comparan SVM y regresión logística con validación cruzada de 5 partes.
  4. Con el 25 % de ejemplos que el modelo no vio se mide la exactitud y la matriz de confusión.
  5. El ganador se entrena con todo y se guarda con joblib para no repetirlo en cada mensaje.

Uso:  python -m app.ia.asistente   (entrena y muestra el reporte)
"""
import re
import unicodedata
from pathlib import Path

import joblib
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import make_pipeline, make_union
from sklearn.svm import LinearSVC

CARPETA = Path(__file__).parent
DATOS = CARPETA / "datos" / "intenciones.csv"
MODELO = CARPETA / "modelos" / "asistente.joblib"
UMBRAL = 0.40  # si el modelo está menos seguro que esto, se deriva a un asesor por WhatsApp


def limpiar(texto: str) -> str:
    """'¿Tienen el GTA V?' -> 'tienen el gta v' (sin tildes, signos ni espacios dobles)."""
    t = unicodedata.normalize("NFKD", texto.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[^a-z0-9ñ ]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _nuevo_modelo(algoritmo: str):
    vectorizador = make_union(  # une las dos "miradas" del texto: palabras completas y pedacitos de letras
        TfidfVectorizer(preprocessor=limpiar, ngram_range=(1, 2), sublinear_tf=True),
        TfidfVectorizer(preprocessor=limpiar, analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True),
    )
    if algoritmo == "SVM":
        # La SVM solo dice "es esta"; calibrarla le permite decir también "qué tan segura está"
        clasificador = CalibratedClassifierCV(LinearSVC(C=1.0), cv=3)
    else:
        clasificador = LogisticRegression(C=10.0, max_iter=2000)
    return make_pipeline(vectorizador, clasificador)


def entrenar(guardar: bool = True) -> dict:
    """Compara los dos algoritmos, guarda el mejor y devuelve sus métricas."""
    df = pd.read_csv(DATOS)
    X, y = df["texto"], df["intencion"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, stratify=y, random_state=0)

    resultados = {}
    for algoritmo in ("SVM", "Regresión logística"):
        partes = StratifiedKFold(n_splits=5, shuffle=True, random_state=0)
        validacion = cross_val_score(_nuevo_modelo(algoritmo), X, y, cv=partes, scoring="accuracy").mean()
        modelo = _nuevo_modelo(algoritmo).fit(X_tr, y_tr)
        prediccion = modelo.predict(X_te)
        resultados[algoritmo] = {
            "exactitud_validacion": round(float(validacion), 3),
            "exactitud_prueba": round(accuracy_score(y_te, prediccion), 3),
            "f1_macro": round(f1_score(y_te, prediccion, average="macro"), 3),
            "_prediccion": prediccion,
        }

    ganador = max(resultados, key=lambda a: resultados[a]["exactitud_validacion"])
    etiquetas = sorted(y.unique())
    matriz = confusion_matrix(y_te, resultados[ganador].pop("_prediccion"), labels=etiquetas)
    for r in resultados.values():
        r.pop("_prediccion", None)

    final = _nuevo_modelo(ganador).fit(X, y)  # el ganador aprende con TODOS los ejemplos
    reporte = {"algoritmo_elegido": ganador, "ejemplos": len(df), "intenciones": etiquetas,
               "resultados": resultados, "matriz_confusion": matriz.tolist()}
    if guardar:
        MODELO.parent.mkdir(exist_ok=True)
        joblib.dump({"modelo": final, "reporte": reporte}, MODELO)
    _cache.clear()
    return reporte


_cache: dict = {}


def _cargar():
    if "modelo" not in _cache:
        if not MODELO.exists():  # en la nube el disco se borra al reiniciar: se vuelve a entrenar (tarda 1 s)
            entrenar(guardar=True)
        _cache.update(joblib.load(MODELO))
    return _cache["modelo"]


def clasificar(texto: str) -> tuple[str, float]:
    """Devuelve la intención y qué tan seguro está el modelo (de 0 a 1)."""
    modelo = _cargar()
    probabilidades = modelo.predict_proba([texto])[0]
    mejor = probabilidades.argmax()
    intencion, confianza = modelo.classes_[mejor], float(probabilidades[mejor])
    if confianza < UMBRAL:
        return "no_entendi", confianza
    return intencion, confianza


if __name__ == "__main__":
    # Se importa a sí mismo con su nombre completo: así el modelo guardado sabe que "limpiar"
    # vive en app.ia.asistente y no en "__main__" (si no, la API no podría abrirlo).
    from app.ia.asistente import clasificar, entrenar

    r = entrenar(guardar=True)
    pd.set_option("display.width", 200)
    pd.set_option("display.max_columns", None)
    print(f"Ejemplos: {r['ejemplos']} · Intenciones: {len(r['intenciones'])}")
    for algoritmo, m in r["resultados"].items():
        print(f"  {algoritmo:20} validación cruzada {m['exactitud_validacion']:.3f} · "
              f"prueba {m['exactitud_prueba']:.3f} · F1 {m['f1_macro']:.3f}")
    print(f"Ganó: {r['algoritmo_elegido']}\n\nMatriz de confusión (filas = real, columnas = predicho):")
    print(pd.DataFrame(r["matriz_confusion"], index=r["intenciones"], columns=[i[:6] for i in r["intenciones"]]))
    for frase in ("tienen el gta 5 pa la play 4?", "mi mando tiene drift", "abren el domingo?", "aceptan yape"):
        print(f"  '{frase}' -> {clasificar(frase)}")
