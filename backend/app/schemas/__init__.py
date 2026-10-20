"""Formatos de entrada y salida de la API (lo que viaja en JSON)."""
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import GrupoCondicion, ModoJuego, Rol


class LoginEntrada(BaseModel):
    email: EmailStr
    password: str


class RegistroEntrada(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    email: EmailStr
    telefono: str | None = Field(default=None, pattern=r"^9\d{8}$")
    password: str = Field(min_length=6)


class UsuarioSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    email: str
    rol: Rol


class TokenSalida(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioSalida
    
class ProductoSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    codigo: str
    nombre: str
    categoria: str
    plataforma: str | None
    precio: Decimal
    precio_final: Decimal
    descuento: int | None
    stock: int
    condicion: str | None
    grupo_condicion: GrupoCondicion
    generos: list[str]
    es_preventa: bool
    fecha_lanzamiento: date | None
    calificacion: Decimal | None

class ResenaSalida(BaseModel):
    nombre: str
    estrellas: int
    texto: str
    fecha: date
    respuesta: str | None


class ProductoDetalle(ProductoSalida):
    """HU-02: lo mismo del catálogo + lo que solo se ve en la ficha."""
    descripcion: str | None
    subcategoria: str | None
    incluye_caja: bool | None
    incluye_manual: bool | None
    incluye_disco: bool | None
    color: str | None
    origen: str | None
    trailer_url: str | None
    etiquetas: list[str]
    modos: list[ModoJuego]
    fotos: list[str]
    monto_reserva: Decimal | None
    total_resenas: int
    resenas: list[ResenaSalida]

class ProductoEdicion(BaseModel):
    """Solo el dueño cambia precio; el stock también lo maneja él desde Inventario."""
    precio: Decimal | None = Field(default=None, ge=0)
    stock: int | None = Field(default=None, ge=0)