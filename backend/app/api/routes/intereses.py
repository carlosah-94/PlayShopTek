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


CODIGO_REPARACION = re.compile(r"\br ?-? ?\d{3,5}\b")  # "R-2061": es rastreo, no un producto que falte


def anotar(db: Session, texto: str, origen: OrigenInteres, cliente_id: int | None, tuvo_resultados: bool) -> bool:
    """Guarda una búsqueda para el tablero de Ángel. La usan el catálogo y el chat, con las mismas reglas:
    - textos muy cortos o códigos de reparación no cuentan;
    - la misma persona buscando lo mismo el mismo día cuenta una sola vez;
    - si ese texto ya tiene grupo (ej. 'gta vi' -> GTA VI), se suma a ese grupo; si no, lo agrupará K-Means."""
    texto = normalizar(texto)
    if len(texto) < 3 or CODIGO_REPARACION.search(texto):
        return False
    repetida = db.scalar(select(Interes.id).where(
        Interes.texto == texto, Interes.fecha == date.today(),
        Interes.cliente_id == cliente_id if cliente_id else Interes.cliente_id.is_(None)))
    if repetida:
        return False
    grupo = db.scalar(select(Interes.grupo_clave).where(Interes.texto == texto, Interes.grupo_clave.is_not(None)).limit(1))
    db.add(Interes(texto=texto, origen=origen, cliente_id=cliente_id, tuvo_resultados=tuvo_resultados,
                   grupo_clave=grupo, fecha=date.today()))
    return True


@router.post("", response_model=InteresSalida, status_code=status.HTTP_201_CREATED)
def registrar(datos: InteresEntrada, db: Session = Depends(get_db), usuario: Usuario | None = Depends(usuario_opcional)):
    """Público: lo llama el catálogo cuando una búsqueda no trae resultados."""
    texto = normalizar(datos.texto)
    # El servidor comprueba por su cuenta si de verdad no hay productos (no le cree al navegador)
    patron = f"%{texto}%"
    hay = db.scalar(select(Producto.id).where(Producto.activo.is_(True),
                                              or_(Producto.nombre.ilike(patron), Producto.descripcion.ilike(patron))).limit(1))
    cliente = db.scalar(select(Cliente).where(Cliente.usuario_id == usuario.id)) if usuario else None
    registrado = anotar(db, texto, OrigenInteres.busqueda, cliente.id if cliente else None, hay is not None)
    db.commit()
    return InteresSalida(registrado=registrado)
