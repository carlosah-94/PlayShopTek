"""Formatos de entrada y salida de la API (lo que viaja en JSON)."""
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import GrupoCondicion, Rol


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


class ProductoEdicion(BaseModel):
    """Solo el dueño cambia precio; el stock también lo maneja él desde Inventario."""
    precio: Decimal | None = Field(default=None, ge=0)
    stock: int | None = Field(default=None, ge=0)