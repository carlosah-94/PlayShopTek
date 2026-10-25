"""HU-14 · Resumen inteligente para Ángel. Usa dos técnicas de IA:

IA 3 · Regresión (aprendizaje SUPERVISADO): predecir cuántas unidades se venderán de cada producto.
  1. pandas arma una tabla: una fila por producto y semana, con sus ventas y su contexto
     (categoría, precio, oferta, mes, si fue semana de pago y lo que vendió las semanas anteriores).
  2. Se comparan Árbol de decisión y Regresión lineal. Se elige con validación en el tiempo
     (siempre se entrena con el pasado y se prueba con semanas posteriores) y se mide con
     el MAE: cuántas unidades se equivoca en promedio.
  3. Con la predicción se calcula qué reponer: lo que se venderá en 2 semanas menos el stock.

IA 4 · Búsqueda local (Hill Climbing): elegir qué ofertas poner para ganar más.
  Prueba una combinación de ofertas, cambia una cosa a la vez y se queda con el cambio si
  la ganancia sube, como subir un cerro a ciegas: siempre das el paso que más sube.

IMPORTANTE: la web recién empezó a registrar ventas, así que el historial de ventas EN TIENDA
es SIMULADO con los supuestos de abajo (se ajustan con lo que diga Ángel). Las ventas reales
que guarda la web se suman encima. Cuando Ángel entregue su historial, se reemplaza la simulación.

Uso:  python -m app.ia.demanda   (muestra el reporte)
"""
import math
from datetime import date, timedelta

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import TimeSeriesSplit
from sklearn.tree import DecisionTreeRegressor
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import GrupoInteres, Interes, Producto, Venta, VentaItem
from app.models.enums import EstadoVenta

# ── Supuestos del historial simulado (se ajustan con las respuestas de Ángel) ─────────
SEMANAS_HISTORIAL = 52
VENTA_BASE = {"PS5": 1.6, "PS4": 1.2, "PS3": 0.9, "PS2": 0.6, "Máquinas": 0.5, "Mandos": 1.8,
              "PC y periféricos": 0.7}  # unidades por semana de un producto normal
SENSIBILIDAD_OFERTA = {"PS5": 6, "PS4": 7, "PS3": 8, "PS2": 8, "Máquinas": 2, "Mandos": 4, "PC y periféricos": 3}
TEMPORADA = {12: 1.8, 7: 1.4, 1: 0.8, 3: 0.8}  # Navidad, gratificación de julio, gastos de enero y marzo
FACTOR_PAGO = 1.3  # semanas con quincena o fin de mes

# ── Reglas del negocio ────────────────────────────────────────────────────────────────
MARGEN = {"nuevo": 0.25, "usado": 0.5, "reacondicionado": 0.4}  # parte del precio que es ganancia
SEMANAS_COBERTURA = 2   # tener stock para 2 semanas, lo que tarda en llegar un pedido
NIVELES_OFERTA = [0, 10, 15, 20, 25]
MAX_OFERTAS = 5         # para que la tienda no parezca estar siempre en remate
CANIBALIZACION = 0.15   # 2 ofertas de la misma categoría se quitan clientes entre sí

CATEGORIAS = list(VENTA_BASE)
CONDICIONES = list(MARGEN)
COLUMNAS = (["precio_log", "descuento", "mes", "semana_de_pago", "venta_anterior", "promedio_4", "promedio_12"]
            + [f"cat_{c}" for c in CATEGORIAS] + [f"cond_{c}" for c in CONDICIONES])


def _lunes(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _es_semana_de_pago(lunes: date) -> bool:
    """¿En esa semana cae un 15 o un fin de mes? Son los días en que la gente cobra."""
    dias = [lunes + timedelta(days=i) for i in range(7)]
    return any(d.day == 15 or (d + timedelta(days=1)).month != d.month for d in dias)


def _oferta_en(p: Producto, lunes: date) -> int:
    for o in p.ofertas:
        if o.fecha_inicio <= lunes + timedelta(days=6) and lunes < o.fecha_inicio + timedelta(days=o.dias):
            return o.porcentaje
    return 0


def _productos(db: Session) -> list[Producto]:
    return list(db.scalars(
        select(Producto).where(Producto.activo.is_(True), Producto.es_preventa.is_(False)).order_by(Producto.id)
        .options(selectinload(Producto.categoria), selectinload(Producto.condicion), selectinload(Producto.ofertas))))


def historial(db: Session, productos: list[Producto]) -> pd.DataFrame:
    """Una fila por producto y semana: simulación de la tienda + ventas reales de la web."""
    ultima = _lunes(date.today()) - timedelta(weeks=1)  # última semana completa
    semanas = [ultima - timedelta(weeks=k) for k in range(SEMANAS_HISTORIAL - 1, -1, -1)]

    reales = pd.DataFrame(db.execute(
        select(VentaItem.producto_id, Venta.fecha, VentaItem.cantidad).join(Venta, Venta.id == VentaItem.venta_id)
        .where(Venta.estado != EstadoVenta.cancelado, VentaItem.es_preventa.is_(False))).all(),
        columns=["producto_id", "fecha", "cantidad"])
    reales["semana"] = reales["fecha"].map(_lunes)
    reales = reales.groupby(["producto_id", "semana"])["cantidad"].sum()

    filas = []
    for p in productos:
        azar = np.random.default_rng(p.id)  # mismo producto -> misma simulación siempre
        cat, cond = p.categoria.nombre, p.condicion.grupo.value
        popularidad = azar.uniform(0.5, 2.0)
        tendencia = {"PS5": 0.006, "PS3": -0.004, "PS2": -0.004}.get(cat, 0.0)
        for i, lunes in enumerate(semanas):
            descuento = _oferta_en(p, lunes)
            if not descuento and azar.random() < 0.08:  # a veces hubo ofertas en la tienda
                descuento = int(azar.choice(NIVELES_OFERTA[1:]))
            ritmo = (VENTA_BASE[cat] * popularidad * TEMPORADA.get((lunes + timedelta(days=3)).month, 1.0)
                     * (FACTOR_PAGO if _es_semana_de_pago(lunes) else 1.0) * (1 + tendencia) ** i
                     * (1 + SENSIBILIDAD_OFERTA[cat] * descuento / 100))
            unidades = azar.poisson(ritmo) + int(reales.get((p.id, lunes), 0))
            filas.append({"producto_id": p.id, "semana": lunes, "categoria": cat, "condicion": cond,
                          "precio": float(p.precio), "descuento": descuento, "unidades": unidades})
    return pd.DataFrame(filas)


def caracteristicas(df: pd.DataFrame) -> pd.DataFrame:
    """Convierte cada fila en números que el modelo entiende."""
    df = df.sort_values(["producto_id", "semana"]).copy()
    pasado = df.groupby("producto_id")["unidades"].shift(1)  # lo que vendió la semana anterior
    df["venta_anterior"] = pasado
    df["promedio_4"] = pasado.groupby(df["producto_id"]).transform(lambda s: s.rolling(4).mean())
    df["promedio_12"] = pasado.groupby(df["producto_id"]).transform(lambda s: s.rolling(12).mean())
    return _completar(df).dropna(subset=["promedio_12"]).sort_values(["semana", "producto_id"])


def _completar(df: pd.DataFrame) -> pd.DataFrame:
    df["precio_log"] = np.log(df["precio"])  # S/ 30 vs S/ 60 pesa igual que S/ 1000 vs S/ 2000
    df["mes"] = df["semana"].map(lambda d: (d + timedelta(days=3)).month)
    df["semana_de_pago"] = df["semana"].map(_es_semana_de_pago).astype(int)
    for c in CATEGORIAS:
        df[f"cat_{c}"] = (df["categoria"] == c).astype(int)
    for c in CONDICIONES:
        df[f"cond_{c}"] = (df["condicion"] == c).astype(int)
    return df


def _nuevo_modelo(algoritmo: str):
    if algoritmo == "Árbol de decisión":
        return DecisionTreeRegressor(max_depth=6, min_samples_leaf=30, random_state=0)
    return LinearRegression()


def entrenar(df: pd.DataFrame) -> tuple:
    """Compara los dos algoritmos. Las últimas 8 semanas quedan como examen final."""
    corte = sorted(df["semana"].unique())[-8]
    entreno, examen = df[df["semana"] < corte], df[df["semana"] >= corte]
    resultados = {}
    for algoritmo in ("Árbol de decisión", "Regresión lineal"):
        errores = []
        for i_tr, i_va in TimeSeriesSplit(n_splits=4).split(entreno):  # siempre pasado -> futuro
            m = _nuevo_modelo(algoritmo).fit(entreno.iloc[i_tr][COLUMNAS], entreno.iloc[i_tr]["unidades"])
            errores.append(mean_absolute_error(entreno.iloc[i_va]["unidades"], m.predict(entreno.iloc[i_va][COLUMNAS])))
        m = _nuevo_modelo(algoritmo).fit(entreno[COLUMNAS], entreno["unidades"])
        resultados[algoritmo] = {"mae_validacion": round(float(np.mean(errores)), 3),
                                 "mae_prueba": round(mean_absolute_error(examen["unidades"], m.predict(examen[COLUMNAS])), 3)}
    # Punto de comparación sin IA: "esta semana venderá lo mismo que el promedio de las 4 anteriores"
    resultados["Sin IA (promedio de 4 semanas)"] = {
        "mae_validacion": None, "mae_prueba": round(mean_absolute_error(examen["unidades"], examen["promedio_4"]), 3)}
    ganador = min(("Árbol de decisión", "Regresión lineal"), key=lambda a: resultados[a]["mae_validacion"])
    final = _nuevo_modelo(ganador).fit(df[COLUMNAS], df["unidades"])  # el ganador aprende con todo
    return final, ganador, resultados


def _filas_siguiente_semana(df: pd.DataFrame, productos: list[Producto], descuentos: dict[int, int]) -> pd.DataFrame:
    """Arma la fila de "esta semana" de cada producto, con el descuento que se quiera probar."""
    lunes = _lunes(date.today())
    orden = df.sort_values("semana").groupby("producto_id")
    ultimas, ultimas_12 = orden.tail(4).groupby("producto_id")["unidades"], orden.tail(12).groupby("producto_id")["unidades"]
    filas = pd.DataFrame([{"producto_id": p.id, "semana": lunes, "categoria": p.categoria.nombre,
                           "condicion": p.condicion.grupo.value, "precio": float(p.precio),
                           "descuento": descuentos.get(p.id, 0)} for p in productos])
    filas["venta_anterior"] = filas["producto_id"].map(ultimas.last())
    filas["promedio_4"] = filas["producto_id"].map(ultimas.mean())
    filas["promedio_12"] = filas["producto_id"].map(ultimas_12.mean())
    return _completar(filas)


def que_reponer(df, modelo, productos) -> list[dict]:
    filas = _filas_siguiente_semana(df, productos, {p.id: _oferta_en(p, _lunes(date.today())) for p in productos})
    demanda = np.clip(modelo.predict(filas[COLUMNAS]), 0, None)
    sugerencias = []
    for p, d in zip(productos, demanda):
        falta = math.ceil(d * SEMANAS_COBERTURA) - p.stock
        if falta > 0:
            sugerencias.append({"producto_id": p.id, "nombre": p.nombre, "stock": p.stock,
                                "demanda_semana": round(float(d), 1), "pedir": falta})
    return sorted(sugerencias, key=lambda s: -s["pedir"])[:8]


def que_agregar(db: Session) -> list[dict]:
    """Lo que buscan y la tienda no tiene: grupos de búsquedas sin producto (K-Means/DBSCAN de HU-11)."""
    filas = db.execute(
        select(GrupoInteres.nombre, func.count(Interes.id)).join(Interes, Interes.grupo_clave == GrupoInteres.clave)
        .where(GrupoInteres.producto_id.is_(None)).group_by(GrupoInteres.nombre).order_by(func.count(Interes.id).desc())
        .limit(5)).all()
    return [{"nombre": n, "busquedas": c} for n, c in filas]


def hill_climbing(df, modelo, productos, reinicios: int = 5) -> dict:
    """Busca la combinación de ofertas (máx. 5) que deja más ganancia esta semana."""
    candidatos = [p for p in productos if p.stock > 0]
    # El modelo predice cuánto vendería cada producto con cada nivel de descuento
    unidades = {}
    for nivel in NIVELES_OFERTA:
        filas = _filas_siguiente_semana(df, candidatos, {p.id: nivel for p in candidatos})
        for p, u in zip(candidatos, np.clip(modelo.predict(filas[COLUMNAS]), 0, None)):
            unidades[p.id, nivel] = float(u)

    def ganancia(estado: dict[int, int]) -> float:
        en_oferta = {}
        for p in candidatos:
            if estado[p.id]:
                en_oferta[p.categoria.nombre] = en_oferta.get(p.categoria.nombre, 0) + 1
        total = 0.0
        for p in candidatos:
            d, base = estado[p.id], unidades[p.id, 0]
            extra = unidades[p.id, d] - base
            if d:
                extra *= max(0.0, 1 - CANIBALIZACION * (en_oferta[p.categoria.nombre] - 1))
            vendidas = min(base + extra, p.stock)
            costo = float(p.precio) * (1 - MARGEN[p.condicion.grupo.value])
            total += vendidas * (float(p.precio) * (1 - d / 100) - costo)
        return total

    def vecinos(estado):
        """Todas las combinaciones que cambian el descuento de UN solo producto."""
        for p in candidatos:
            for nivel in NIVELES_OFERTA:
                if nivel != estado[p.id]:
                    nuevo = {**estado, p.id: nivel}
                    if sum(1 for v in nuevo.values() if v) <= MAX_OFERTAS:
                        yield nuevo

    azar = np.random.default_rng(0)
    sin_ofertas = {p.id: 0 for p in candidatos}
    mejor, mejor_valor, pasos_totales = sin_ofertas, ganancia(sin_ofertas), 0
    for r in range(reinicios):  # varios puntos de partida para no quedarse en un cerrito pequeño
        estado = dict(sin_ofertas)
        if r:
            for i in azar.choice(len(candidatos), MAX_OFERTAS, replace=False):
                estado[candidatos[i].id] = int(azar.choice(NIVELES_OFERTA[1:]))
        valor = ganancia(estado)
        while True:
            siguiente = max(vecinos(estado), key=ganancia)
            if ganancia(siguiente) <= valor:
                break  # ningún paso sube: llegamos a la cima
            estado, valor = siguiente, ganancia(siguiente)
            pasos_totales += 1
        if valor > mejor_valor:
            mejor, mejor_valor = estado, valor

    sugeridas = [{"producto_id": p.id, "nombre": p.nombre, "descuento": mejor[p.id],
                  "unidades_sin_oferta": round(unidades[p.id, 0], 1),
                  "unidades_con_oferta": round(unidades[p.id, mejor[p.id]], 1)}
                 for p in candidatos if mejor[p.id]]
    return {"sugeridas": sugeridas, "ganancia_sin_ofertas": round(ganancia(sin_ofertas)),
            "ganancia_con_ofertas": round(mejor_valor), "pasos": pasos_totales, "reinicios": reinicios}


def resumen(db: Session) -> dict:
    productos = _productos(db)
    datos = historial(db, productos)
    tabla = caracteristicas(datos)
    modelo, ganador, resultados = entrenar(tabla)
    return {
        "modelo": {"algoritmo_elegido": ganador, "resultados": resultados, "filas": len(tabla),
                   "semanas": SEMANAS_HISTORIAL, "productos": len(productos), "historial_simulado": True},
        "reponer": que_reponer(datos, modelo, productos),
        "agregar": que_agregar(db),
        "ofertas": hill_climbing(datos, modelo, productos),
    }


if __name__ == "__main__":
    from app.database import SessionLocal

    with SessionLocal() as db:
        r = resumen(db)
    m = r["modelo"]
    print(f"Tabla de pandas: {m['filas']} filas ({m['productos']} productos, {m['semanas']} semanas de historial)")
    for algoritmo, x in m["resultados"].items():
        print(f"  {algoritmo:32} MAE validación {x['mae_validacion']} · MAE prueba {x['mae_prueba']}")
    print(f"Ganó: {m['algoritmo_elegido']}\n\nQué reponer:")
    print(pd.DataFrame(r["reponer"]).to_string(index=False))
    print("\nQué agregar al catálogo:", r["agregar"])
    o = r["ofertas"]
    print(f"\nHill Climbing: S/ {o['ganancia_sin_ofertas']} sin ofertas -> S/ {o['ganancia_con_ofertas']} "
          f"con ofertas ({o['pasos']} pasos, {o['reinicios']} puntos de partida)")
    print(pd.DataFrame(o["sugeridas"]).to_string(index=False))