"""HU-22: datos de la página de inicio en una sola llamada: recomendados, servicios del taller y reseñas."""
from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import usuario_opcional
from app.api.routes.productos import _consulta_base, a_salida, calificaciones
from app.api.routes.resenas import COMPRADO
from app.database import get_db
from app.models import (
    Cliente,
    Producto,
    Resena,
    TipoServicio,
    Usuario,
    Venta,
    VentaItem,
)
from app.models.enums import Rol
from app.schemas import InicioSalida, ResenaInicio, ServicioInicio

router = APIRouter(prefix="/inicio", tags=["Inicio"])


def unidades_vendidas(db: Session) -> dict[int, int]:
    """Cuántas unidades se vendieron de cada producto (solo compras pagadas o entregadas)."""
    filas = db.execute(select(VentaItem.producto_id, func.sum(VentaItem.cantidad))
                       .join(Venta, Venta.id == VentaItem.venta_id)
                       .where(Venta.estado.in_(COMPRADO), VentaItem.producto_id.is_not(None))
                       .group_by(VentaItem.producto_id))
    return {pid: int(n) for pid, n in filas}


def compras_del_cliente(db: Session, usuario: Usuario | None) -> tuple[set[int], set[int]]:
    """Qué productos ya compró el cliente y de qué categorías. Sin sesión, nada."""
    if usuario is None or usuario.rol != Rol.cliente:
        return set(), set()
    cliente = db.scalar(select(Cliente).where(Cliente.usuario_id == usuario.id))
    if cliente is None:
        return set(), set()
    filas = db.execute(select(Producto.id, Producto.categoria_id)
                       .join(VentaItem, VentaItem.producto_id == Producto.id)
                       .join(Venta, Venta.id == VentaItem.venta_id)
                       .where(Venta.cliente_id == cliente.id, Venta.estado.in_(COMPRADO)))
    productos, categorias = set(), set()
    for pid, cat in filas:
        productos.add(pid)
        categorias.add(cat)
    return productos, categorias


def recomendados(db: Session, usuario: Usuario | None, cuantos: int = 4):
    """"Recomendado para ti":
    - Sin cuenta: lo más vendido de la tienda.
    - Con cuenta de cliente: primero lo más vendido de las categorías que ya compró, sin repetir lo que ya tiene.
    Solo productos que se pueden comprar hoy (con stock y que no sean preventa)."""
    vendidos = unidades_vendidas(db)
    ya_tiene, le_gusta = compras_del_cliente(db, usuario)
    candidatos = [p for p in db.scalars(_consulta_base())
                  if p.stock > 0 and not p.es_preventa and p.id not in ya_tiene]
    candidatos.sort(key=lambda p: (p.categoria_id not in le_gusta, -vendidos.get(p.id, 0), p.id))
    notas = calificaciones(db)
    return [a_salida(p, notas) for p in candidatos[:cuantos]], bool(le_gusta)


def servicios_del_taller(db: Session, cuantos: int = 4) -> list[ServicioInicio]:
    filas = db.scalars(select(TipoServicio).where(TipoServicio.activo.is_(True)).order_by(TipoServicio.id).limit(cuantos))
    return [ServicioInicio(nombre=s.nombre, tiempo=s.tiempo_estimado, icono=s.icono) for s in filas]


def resenas_destacadas(db: Session, cuantas: int = 3) -> list[ResenaInicio]:
    """Primero las que destacó Ángel; luego las de 5 estrellas más recientes. Sin repetir texto ni producto."""
    filas = db.execute(
        select(Resena, Producto.nombre, TipoServicio.nombre)
        .outerjoin(Producto, Producto.id == Resena.producto_id)
        .outerjoin(TipoServicio, TipoServicio.id == Resena.tipo_servicio_id)
        .where(or_(Resena.estrellas == 5, Resena.destacada.is_(True)))
        .order_by(Resena.destacada.desc(), Resena.fecha.desc(), Resena.id.desc())  # HU-24: primero las que destacó Ángel
        .limit(200)
    )
    elegidas, textos, temas = [], set(), set()
    for r, producto, servicio in filas:
        sobre = producto or servicio or "Servicio técnico"
        if r.texto in textos or sobre in temas:
            continue
        textos.add(r.texto)
        temas.add(sobre)
        elegidas.append(ResenaInicio(nombre=r.nombre_publico, estrellas=r.estrellas, texto=r.texto, sobre=sobre))
        if len(elegidas) == cuantas:
            break
    return elegidas


@router.get("", response_model=InicioSalida)
def inicio(db: Session = Depends(get_db), usuario: Usuario | None = Depends(usuario_opcional)):
    """Pública: cualquiera la ve. Si el cliente inició sesión, los recomendados se basan en sus compras."""
    productos, personalizado = recomendados(db, usuario)
    return InicioSalida(recomendados=productos, personalizado=personalizado,
                        servicios=servicios_del_taller(db), resenas=resenas_destacadas(db))
