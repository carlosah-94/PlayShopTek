"""HU-11: guardar lo que los clientes buscan y no encuentran, para que Ángel sepa qué traer."""
import re
from datetime import date

from fastapi import APIRouter, Depends, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import usuario_opcional
from app.database import get_db
from app.models import Cliente, Interes, Producto, Usuario
from app.models.enums import OrigenInteres
from app.schemas import InteresEntrada, InteresSalida

router = APIRouter(prefix="/intereses", tags=["Búsquedas"])


def normalizar(texto: str) -> str:
    """'  GTA   VI ' -> 'gta vi' (así se cuentan juntas las búsquedas iguales)."""
    return re.sub(r"\s+", " ", texto).strip().lower()


@router.post("", response_model=InteresSalida, status_code=status.HTTP_201_CREATED)
def registrar(datos: InteresEntrada, db: Session = Depends(get_db), usuario: Usuario | None = Depends(usuario_opcional)):
    """Público: lo llama el catálogo cuando una búsqueda no trae resultados."""
    texto = normalizar(datos.texto)
    if len(texto) < 3:
        return InteresSalida(registrado=False)

    # El servidor comprueba por su cuenta si de verdad no hay productos (no le cree al navegador)
    patron = f"%{texto}%"
    hay = db.scalar(select(Producto.id).where(Producto.activo.is_(True),
                                              or_(Producto.nombre.ilike(patron), Producto.descripcion.ilike(patron))).limit(1))
    cliente = db.scalar(select(Cliente).where(Cliente.usuario_id == usuario.id)) if usuario else None
    cliente_id = cliente.id if cliente else None

    # La misma persona buscando lo mismo el mismo día cuenta una sola vez
    repetida = db.scalar(select(Interes.id).where(
        Interes.texto == texto, Interes.fecha == date.today(),
        Interes.cliente_id == cliente_id if cliente_id else Interes.cliente_id.is_(None)))
    if repetida:
        return InteresSalida(registrado=False)

    # Si ese mismo texto ya pertenece a un grupo (ej. 'gta vi' -> GTA VI), se suma a ese grupo.
    # Las búsquedas nuevas quedan sin grupo: en el Sprint 3 la IA (K-Means) las agrupará.
    grupo = db.scalar(select(Interes.grupo_clave).where(Interes.texto == texto, Interes.grupo_clave.is_not(None)).limit(1))
    db.add(Interes(texto=texto, origen=OrigenInteres.busqueda, cliente_id=cliente_id, tuvo_resultados=hay is not None,
                   grupo_clave=grupo, fecha=date.today()))
    db.commit()
    return InteresSalida(registrado=True)