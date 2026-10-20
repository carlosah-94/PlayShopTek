"""HU-01 (catálogo con filtros) y HU-12 (inventario del dueño)."""
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import equipo_tienda, solo_dueno
from app.database import get_db
from app.models import Categoria, Condicion, Genero, Producto, Resena
from app.models.enums import GrupoCondicion
from app.schemas import ProductoEdicion, ProductoSalida

router = APIRouter(prefix="/productos", tags=["Catálogo"])


def oferta_vigente(p: Producto, hoy: date | None = None):
    hoy = hoy or date.today()
    for o in p.ofertas:
        if o.fecha_inicio <= hoy < o.fecha_inicio + timedelta(days=o.dias):
            return o
    return None


def calificaciones(db: Session) -> dict[int, Decimal]:
    """Promedio de estrellas por producto, calculado de sus reseñas (no se guarda aparte)."""
    filas = db.execute(select(Resena.producto_id, func.avg(Resena.estrellas))
                       .where(Resena.producto_id.is_not(None)).group_by(Resena.producto_id))
    return {pid: Decimal(prom).quantize(Decimal("0.1"), ROUND_HALF_UP) for pid, prom in filas}


def a_salida(p: Producto, notas: dict[int, Decimal]) -> ProductoSalida:
    o = oferta_vigente(p)
    final = p.precio if o is None else (p.precio * (100 - o.porcentaje) / 100).quantize(Decimal("1"), ROUND_HALF_UP)
    return ProductoSalida(
        id=p.id, codigo=p.codigo, nombre=p.nombre, categoria=p.categoria.nombre, plataforma=p.plataforma,
        precio=p.precio, precio_final=final, descuento=o.porcentaje if o else None, stock=p.stock,
        condicion=p.condicion.nombre, grupo_condicion=p.condicion.grupo, generos=[g.id for g in p.generos],
        es_preventa=p.es_preventa, fecha_lanzamiento=p.fecha_lanzamiento, calificacion=notas.get(p.id),
    )


def _consulta_base():
    return (
        select(Producto)
        .where(Producto.activo.is_(True))
        .options(selectinload(Producto.categoria), selectinload(Producto.condicion),
                 selectinload(Producto.generos), selectinload(Producto.ofertas))
        .order_by(Producto.id)
    )


@router.get("", response_model=list[ProductoSalida])
def listar(
    db: Session = Depends(get_db),
    categoria: str | None = Query(None, description="PS5, Mandos, Máquinas..."),
    genero: str | None = Query(None, description="accion, deportes, terror..."),
    estado: GrupoCondicion | None = Query(None, description="nuevo, usado, reacondicionado"),
    q: str | None = Query(None, description="texto a buscar"),
):
    """Catálogo público. Cualquiera lo puede ver, sin iniciar sesión."""
    consulta = _consulta_base()
    if categoria:
        consulta = consulta.join(Producto.categoria).where(Categoria.nombre == categoria)
    if genero:
        consulta = consulta.where(Producto.generos.any(Genero.id == genero))
    if estado:
        consulta = consulta.join(Producto.condicion).where(Condicion.grupo == estado)
    if q:
        patron = f"%{q.strip()}%"
        consulta = consulta.where(or_(Producto.nombre.ilike(patron), Producto.descripcion.ilike(patron)))
    notas = calificaciones(db)
    return [a_salida(p, notas) for p in db.scalars(consulta)]


@router.get("/stock-bajo", response_model=list[ProductoSalida], dependencies=[Depends(equipo_tienda)])
def stock_bajo(db: Session = Depends(get_db)):
    """Dueño y trabajadora: productos que hay que reponer (no incluye preventas)."""
    consulta = _consulta_base().where(Producto.es_preventa.is_(False), Producto.stock <= Producto.umbral_stock_bajo)
    notas = calificaciones(db)
    return [a_salida(p, notas) for p in db.scalars(consulta)]


@router.get("/{producto_id}", response_model=ProductoSalida)
def detalle(producto_id: int, db: Session = Depends(get_db)):
    p = db.scalar(_consulta_base().where(Producto.id == producto_id))
    if p is None:
        raise HTTPException(404, "Producto no encontrado.")
    return a_salida(p, calificaciones(db))


@router.patch("/{producto_id}", response_model=ProductoSalida, dependencies=[Depends(solo_dueno)])
def editar(producto_id: int, cambios: ProductoEdicion, db: Session = Depends(get_db)):
    """Solo Ángel: la trabajadora no cambia precios."""
    p = db.scalar(_consulta_base().where(Producto.id == producto_id))
    if p is None:
        raise HTTPException(404, "Producto no encontrado.")
    for campo, valor in cambios.model_dump(exclude_none=True).items():
        setattr(p, campo, valor)
    db.commit()
    return a_salida(p, calificaciones(db))