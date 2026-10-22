"""IA 1 · Agrupamiento (aprendizaje NO supervisado): junta búsquedas que piden lo mismo.

"gta 6", "gta vi", "grand theft auto 6" y "gta6 ps5" son la misma intención. Pasos:
  1. Normalizar el texto (minúsculas, "vi" -> "6", "grand theft auto" -> "gta"...).
  2. Convertirlo en números con TF-IDF de "pedacitos" de letras (n-gramas de caracteres).
  3. Probar K-Means con varios K y DBSCAN con varios radios; quedarse con el de mejor
     coeficiente de silueta (qué tan juntos y separados quedan los grupos).
  4. Medir contra los grupos que ya estaban hechos a mano (Adjusted Rand Index).
  5. Guardar el grupo de cada búsqueda nueva para que el tablero las cuente juntas.

Uso:  python -m app.ia.busquedas   (muestra el reporte sin guardar nada)
"""
import re
import warnings
from collections import Counter

import pandas as pd
from sklearn.cluster import DBSCAN, KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import adjusted_rand_score, silhouette_score
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import GrupoInteres, Interes

# Conocimiento del negocio: formas distintas de decir lo mismo en una tienda de videojuegos
SINONIMOS = [
    (r"\bgrand theft auto\b", "gta"), (r"\bgran turismo\b", "gt"), (r"\bcall of duty\b", "cod"),
    (r"\bblack ops\b", "bo"), (r"\bcontrol\b", "mando"), (r"\bvi\b", "6"), (r"\biv\b", "4"), (r"\bv\b", "5"),
    (r"\bps[2-5]\b", ""), (r"\bpara\b", ""), (r"\bremake\b", ""), (r"\bnintendo\b", ""),
]


def normalizar(texto: str) -> str:
    t = texto.lower()
    for patron, cambio in SINONIMOS:
        t = re.sub(patron, cambio, t)
    t = re.sub(r"([a-z])(\d)", r"\1 \2", t)  # "gta6" -> "gta 6", "bo7" -> "bo 7"
    return re.sub(r"\s+", " ", t).strip()


def agrupar(textos: list[str]) -> dict:
    """Devuelve la etiqueta (número de grupo) de cada texto y las métricas de cada algoritmo."""
    limpios = [normalizar(t) for t in textos]
    X = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4)).fit_transform(limpios)
    distintos = len(set(limpios))
    pruebas = []

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for k in range(2, min(20, distintos)):  # K-Means: probar varios K
            etiquetas = KMeans(n_clusters=k, n_init=10, random_state=0).fit_predict(X)
            pruebas.append({"algoritmo": "K-Means", "parametro": f"K = {k}", "etiquetas": etiquetas,
                            "silueta": silhouette_score(X, etiquetas, metric="cosine")})
        for eps in (0.3, 0.4, 0.5, 0.6, 0.7):  # DBSCAN: probar varios radios
            etiquetas = DBSCAN(eps=eps, min_samples=1, metric="cosine").fit_predict(X)
            if 1 < len(set(etiquetas)) < len(textos):
                pruebas.append({"algoritmo": "DBSCAN", "parametro": f"eps = {eps}", "etiquetas": etiquetas,
                                "silueta": silhouette_score(X, etiquetas, metric="cosine")})

    mejor = {alg: max((p for p in pruebas if p["algoritmo"] == alg), key=lambda p: p["silueta"], default=None)
             for alg in ("K-Means", "DBSCAN")}
    ganador = max((p for p in mejor.values() if p), key=lambda p: p["silueta"])
    return {"etiquetas": list(ganador["etiquetas"]), "ganador": ganador, "mejor": mejor}


def ejecutar(db: Session, guardar: bool = True) -> dict:
    filas = db.execute(select(Interes.id, Interes.texto, Interes.grupo_clave)).all()
    df = pd.DataFrame(filas, columns=["id", "texto", "grupo"])
    textos = sorted(df["texto"].unique())
    if len(textos) < 4:
        return {"mensaje": "Todavía hay muy pocas búsquedas para agrupar."}

    r = agrupar(textos)
    grupo_de_texto = dict(zip(textos, r["etiquetas"]))

    # Evaluación: los grupos hechos a mano (no los creados por la IA) sirven como "respuestas correctas"
    manual = df.dropna(subset=["grupo"]).drop_duplicates("texto")
    manual = manual[~manual["grupo"].str.startswith("ia-")]
    ari = adjusted_rand_score(manual["grupo"], [grupo_de_texto[t] for t in manual["texto"]]) if len(manual) > 1 else None

    # Cada grupo de la IA hereda el grupo manual que más se repite dentro de él; si no hay, se crea uno nuevo
    df["cluster"] = df["texto"].map(grupo_de_texto)
    nuevos, asignadas, grupos = 0, 0, []
    for cluster, miembros in df.groupby("cluster"):
        conocidos = miembros["grupo"].dropna()
        nombre_comun = Counter(miembros["texto"]).most_common(1)[0][0]
        if len(conocidos):
            clave = Counter(conocidos).most_common(1)[0][0]
        else:
            clave = "ia-" + re.sub(r"[^a-z0-9]+", "-", normalizar(nombre_comun)).strip("-")[:50]
            if guardar and db.get(GrupoInteres, clave) is None:
                db.add(GrupoInteres(clave=clave, nombre=nombre_comun[:1].upper() + nombre_comun[1:]))
                db.flush()
                nuevos += 1
        sin_grupo = miembros[miembros["grupo"].isna()]
        if guardar and len(sin_grupo):
            for interes in db.scalars(select(Interes).where(Interes.id.in_(sin_grupo["id"].tolist()))):
                interes.grupo_clave = clave
            asignadas += len(sin_grupo)
        grupos.append({"clave": clave, "textos": sorted(miembros["texto"].unique())})
    if guardar:
        db.commit()

    def resumen(p):
        return {"parametro": p["parametro"], "silueta": round(float(p["silueta"]), 3), "grupos": len(set(p["etiquetas"]))} if p else None

    return {
        "algoritmo_elegido": r["ganador"]["algoritmo"], "kmeans": resumen(r["mejor"]["K-Means"]),
        "dbscan": resumen(r["mejor"]["DBSCAN"]), "ari_vs_grupos_manuales": round(float(ari), 3) if ari is not None else None,
        "textos_distintos": len(textos), "grupos_nuevos": nuevos, "busquedas_agrupadas": asignadas, "grupos": grupos,
    }


if __name__ == "__main__":
    from app.database import SessionLocal

    with SessionLocal() as db:
        reporte = ejecutar(db, guardar=False)
    for clave in ("algoritmo_elegido", "kmeans", "dbscan", "ari_vs_grupos_manuales", "textos_distintos"):
        print(f"{clave}: {reporte.get(clave)}")
    for g in reporte.get("grupos", []):
        print(" -", g["clave"], g["textos"])