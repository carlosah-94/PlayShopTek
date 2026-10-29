"""Funciones de inteligencia artificial que usa el dueño desde su panel."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import solo_dueno
from app.database import get_db
from app.ia import busquedas, demanda

router = APIRouter(prefix="/ia", tags=["Inteligencia artificial"], dependencies=[Depends(solo_dueno)])


@router.post("/agrupar-busquedas")
def agrupar_busquedas(db: Session = Depends(get_db)):
    """K-Means vs DBSCAN: agrupa las búsquedas parecidas y devuelve las métricas para comparar."""
    return busquedas.ejecutar(db, guardar=True)


@router.get("/resumen")
def resumen_inteligente(db: Session = Depends(get_db)):
    """HU-14: qué reponer (Árbol de decisión vs Regresión lineal), qué agregar y qué ofertas poner (Hill Climbing)."""
    return demanda.resumen(db)
