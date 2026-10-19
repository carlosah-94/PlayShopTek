"""HU-16: iniciar sesión y ver solo lo que el perfil permite."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import usuario_actual
from app.core.security import crear_token, hash_password, verificar_password
from app.database import get_db
from app.models import Cliente, Usuario
from app.models.enums import Rol
from app.schemas import LoginEntrada, RegistroEntrada, TokenSalida, UsuarioSalida

router = APIRouter(prefix="/auth", tags=["Cuenta"])


def salida(usuario: Usuario) -> TokenSalida:
    return TokenSalida(access_token=crear_token(usuario.id, usuario.rol.value),
                       usuario=UsuarioSalida(id=usuario.id, nombre=usuario.nombre, email=usuario.email, rol=usuario.rol))


@router.post("/login", response_model=TokenSalida)
def login(datos: LoginEntrada, db: Session = Depends(get_db)):
    usuario = db.scalar(select(Usuario).where(Usuario.email == datos.email.lower()))
    if usuario is None or not verificar_password(datos.password, usuario.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Correo o contraseña incorrectos.")
    if not usuario.activo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Esa cuenta está desactivada. Pídele a Ángel que la reactive.")
    return salida(usuario)


@router.post("/registro", response_model=TokenSalida, status_code=status.HTTP_201_CREATED)
def registro(datos: RegistroEntrada, db: Session = Depends(get_db)):
    """Solo crea clientes. Las cuentas del equipo las crea el dueño en 'Mi equipo'.

    Si el celular ya está registrado (compró antes en tienda sin cuenta), se le une
    la cuenta nueva: así sus compras anteriores aparecen en "Mis compras".
    """
    email = datos.email.lower()
    if db.scalar(select(Usuario.id).where(Usuario.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese correo.")
    usuario = Usuario(email=email, password_hash=hash_password(datos.password), rol=Rol.cliente)
    cliente = db.scalar(select(Cliente).where(Cliente.telefono == datos.telefono)) if datos.telefono else None
    if cliente is not None and cliente.usuario_id is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese celular ya tiene una cuenta.")
    if cliente is None:
        cliente = Cliente(telefono=datos.telefono)
        db.add(cliente)
    cliente.nombre = datos.nombre.strip()
    cliente.correo_contacto = None  # con cuenta, el correo es el de la cuenta
    cliente.usuario = usuario
    db.commit()
    return salida(usuario)


@router.get("/yo", response_model=UsuarioSalida)
def yo(usuario: Usuario = Depends(usuario_actual)):
    return UsuarioSalida(id=usuario.id, nombre=usuario.nombre, email=usuario.email, rol=usuario.rol)