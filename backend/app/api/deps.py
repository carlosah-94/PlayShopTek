"""Dependencias compartidas: usuario actual y control de permisos por rol."""
from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import leer_token
from app.database import get_db
from app.models import Usuario
from app.models.enums import Rol

bearer = HTTPBearer(auto_error=False)


def usuario_actual(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> Usuario:
    if cred is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Inicia sesión para continuar.")
    try:
        datos = leer_token(cred.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Tu sesión venció. Vuelve a iniciar sesión.")
    usuario = db.get(Usuario, int(datos["sub"]))
    if usuario is None or not usuario.activo:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Cuenta no disponible.")
    return usuario

def usuario_opcional(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> Usuario | None:
    """Para páginas públicas: si hay sesión, dice quién es; si no (o venció), devuelve None sin error."""
    if cred is None:
        return None
    try:
        return db.get(Usuario, int(leer_token(cred.credentials)["sub"]))
    except jwt.PyJWTError:
        return None

def requiere_rol(*roles: Rol) -> Callable[[Usuario], Usuario]:
    """Ej.: Depends(requiere_rol(Rol.dueno)) -> solo Ángel."""

    def verificar(usuario: Usuario = Depends(usuario_actual)) -> Usuario:
        if usuario.rol not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Tu perfil no tiene permiso para esto.")
        return usuario

    return verificar


solo_dueno = requiere_rol(Rol.dueno)
equipo_tienda = requiere_rol(Rol.dueno, Rol.trabajadora)
solo_cliente = requiere_rol(Rol.cliente)