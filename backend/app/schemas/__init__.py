"""Formatos de entrada y salida de la API (lo que viaja en JSON)."""
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import Rol


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