"""Contraseñas (bcrypt) y tokens de sesión (JWT)."""
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verificar_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def crear_token(usuario_id: int, rol: str) -> str:
    ahora = datetime.now(UTC)
    datos = {"sub": str(usuario_id), "rol": rol, "iat": ahora, "exp": ahora + timedelta(minutes=settings.jwt_minutos)}
    return jwt.encode(datos, settings.jwt_secret, algorithm=settings.jwt_algoritmo)


def leer_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algoritmo])