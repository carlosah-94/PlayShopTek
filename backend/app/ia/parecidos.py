"""IA · KNN (k vecinos más cercanos): "productos parecidos" en la ficha de cada producto.

Como un vendedor que dice "si te gustó el FIFA, mira el PES":
  1. pandas arma una tabla con una fila por producto: su categoría, plataforma, géneros,
     estado (nuevo/usado) y precio, todo convertido en números.
  2. KNN mide la distancia entre las filas: mientras más se parecen los números, más cerca están.
  3. Los 4 productos más cercanos son los "parecidos".

Uso:  python -m app.ia.parecidos   (muestra ejemplos y cuántos comparten género)
"""
import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Producto

# Cuánto importa cada característica al comparar (la categoría pesa más: una consola no se parece a un juego)
PESOS = {"cat": 3.0, "plat": 1.0, "gen": 2.0, "cond": 0.5, "precio": 1.0}


def tabla_de_productos(db: Session) -> pd.DataFrame:
    productos = db.scalars(select(Producto).where(Producto.activo.is_(True)).options(
        selectinload(Producto.categoria), selectinload(Producto.condicion), selectinload(Producto.generos)))
    return pd.DataFrame([{"id": p.id, "nombre": p.nombre, "categoria": p.categoria.nombre,
                          "plataforma": p.plataforma or "otra", "condicion": p.condicion.grupo.value,
                          "precio": float(p.precio), "generos": [g.id for g in p.generos]}
                         for p in productos]).set_index("id")


def caracteristicas(df: pd.DataFrame) -> pd.DataFrame:
    """Convierte cada producto en una fila de números (0 y 1, y el precio entre 0 y 1)."""
    generos = df["generos"].explode().dropna()
    partes = [
        pd.get_dummies(df["categoria"], prefix="cat").astype(float) * PESOS["cat"],
        pd.get_dummies(df["plataforma"], prefix="plat").astype(float) * PESOS["plat"],
        pd.crosstab(generos.index, generos).reindex(df.index, fill_value=0).clip(upper=1) * PESOS["gen"],
        pd.get_dummies(df["condicion"], prefix="cond").astype(float) * PESOS["cond"],
    ]
    precio = np.log(df["precio"].clip(lower=1))  # S/ 30 vs S/ 60 pesa igual que S/ 1000 vs S/ 2000
    partes.append(((precio - precio.min()) / (precio.max() - precio.min() or 1)).to_frame("precio") * PESOS["precio"])
    return pd.concat(partes, axis=1).fillna(0)


def parecidos(db: Session, producto_id: int, k: int = 4) -> list[int]:
    """Devuelve los id de los k productos más parecidos (sin contar el mismo)."""
    df = tabla_de_productos(db)
    if producto_id not in df.index:
        return []
    X = caracteristicas(df)
    knn = NearestNeighbors(n_neighbors=min(k + 1, len(X))).fit(X)
    _, posiciones = knn.kneighbors(X.loc[[producto_id]])
    return [int(i) for i in X.index[posiciones[0]] if i != producto_id][:k]


if __name__ == "__main__":
    from app.database import SessionLocal

    with SessionLocal() as db:
        df = tabla_de_productos(db)
        comparten = []
        for pid in df.index:
            vecinos = parecidos(db, pid)
            mios = set(df.at[pid, "generos"])
            if mios:  # solo los juegos tienen géneros
                comparten += [bool(mios & set(df.at[v, "generos"])) for v in vecinos]
        for nombre in ("FIFA 26 (PS5)", "Mando DualSense Blanco", "GTA V (PS3)"):
            pid = df.index[df["nombre"] == nombre]
            if len(pid):
                print(f"{nombre} -> {', '.join(df.loc[parecidos(db, int(pid[0])), 'nombre'])}")
        print(f"\nEl {np.mean(comparten):.0%} de los juegos parecidos comparte al menos un género (acción, deportes...).")
