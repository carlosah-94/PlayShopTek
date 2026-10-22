"""Punto de entrada de la API de Play Shop Tek.

Documentación interactiva: http://localhost:8000/docs
"""
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.routes import auth, cuenta, intereses, productos, rastreo, reparaciones, tablero, ventas
from app.config import settings
from app.database import engine

app = FastAPI(
    title="Play Shop Tek API",
    description="Venta y servicio de reparación de Play Shop Tek (Villa El Salvador).",
    version="0.1.0",
)

# Permite que el frontend (otra dirección) pueda llamar a esta API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_lista,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


@api.get("/salud", tags=["Sistema"])
def salud():
    """Comprueba que la API y la base de datos responden."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"api": "ok", "base_de_datos": "ok"}


api.include_router(auth.router)
api.include_router(productos.router)
api.include_router(reparaciones.router)
api.include_router(rastreo.router)
api.include_router(ventas.router)
api.include_router(tablero.router)
api.include_router(intereses.router)
api.include_router(cuenta.router)
app.include_router(api)
