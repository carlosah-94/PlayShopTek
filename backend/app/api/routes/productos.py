"""HU-01 (catálogo con filtros), HU-02 (ficha), HU-12 (inventario del dueño) y HU-05 (aviso de llegada)."""
import json
from datetime import UTC, date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import equipo_tienda, solo_dueno
from app.database import get_db
from app.ia.parecidos import parecidos
from app.models import (
    AvisoLlegada, Categoria, Condicion, Genero, GrupoInteres, Notificacion, Producto, Resena, Venta, VentaItem,
)
from app.models.enums import EstadoVenta, GrupoCondicion
from app.schemas import ProductoDetalle, ProductoEdicion, ProductoSalida, ResenaSalida

router = APIRouter(prefix="/productos", tags=["Catálogo"])

# HU-21: cuántas fotos tiene cada producto (las sacó scripts/extraer_fotos.py del prototipo).
# Las fotos viven en el frontend (Vercel): /productos/p36-1.webp, /productos/p36-2.webp...
FOTOS = json.loads((Path(__file__).resolve().parents[2] / "seed_data" / "fotos.json").read_text(encoding="utf-8"))


def fotos_de(p: Producto) -> list[str]:
    """Fotos del producto: primero las subidas por la tienda (si hay), si no, las del prototipo."""
    subidas = [m.url for m in p.medios if m.tipo.value == "imagen"] if "medios" in p.__dict__ else []
    return subidas or [f"/productos/{p.codigo}-{n}.webp" for n in range(1, FOTOS.get(p.codigo, 0) + 1)]


def oferta_vigente(p: Producto, hoy: date | None = None):
    hoy = hoy or date.today()
    for o in p.ofertas:
        if o.fecha_inicio <= hoy < o.fecha_inicio + timedelta(days=o.dias):
            return o
    return None


def fin_de_oferta(o) -> datetime:
    """HU-23: momento exacto en que termina la oferta (inicio + días, a la medianoche del servidor).
    Es el mismo corte que usa oferta_vigente, así el contador y el precio cambian a la vez."""
    return datetime.combine(o.fecha_inicio + timedelta(days=o.dias), time(), tzinfo=UTC)


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
        trailer_url=p.trailer_url, foto=next(iter(fotos_de(p)), None),
        oferta_termina=fin_de_oferta(o) if o else None,
    )

def cupos_de_reserva(db: Session, p: Producto) -> int | None:
    """HU-04: cupos de preventa = unidades que llegarán el día del lanzamiento - reservas ya hechas."""
    if not p.es_preventa or p.stock_lanzamiento is None:
        return None
    reservadas = db.scalar(
        select(func.coalesce(func.sum(VentaItem.cantidad), 0)).join(Venta, Venta.id == VentaItem.venta_id)
        .where(VentaItem.producto_id == p.id, VentaItem.es_preventa.is_(True), Venta.estado == EstadoVenta.reservado))
    return max(p.stock_lanzamiento - reservadas, 0)

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


@router.get("/{producto_id}", response_model=ProductoDetalle)
def detalle(producto_id: int, db: Session = Depends(get_db)):
    """HU-02: ficha completa con fotos, tráiler, stock y las últimas reseñas."""
    p = db.scalar(_consulta_base().where(Producto.id == producto_id)
                  .options(selectinload(Producto.etiquetas), selectinload(Producto.modos), selectinload(Producto.medios)))
    if p is None:
        raise HTTPException(404, "Producto no encontrado.")
    ultimas = db.scalars(select(Resena).where(Resena.producto_id == p.id).order_by(Resena.fecha.desc(), Resena.id.desc()).limit(6))
    total = db.scalar(select(func.count()).select_from(Resena).where(Resena.producto_id == p.id))
    return ProductoDetalle(
        **a_salida(p, calificaciones(db)).model_dump(),
        descripcion=p.descripcion, subcategoria=p.subcategoria, incluye_caja=p.incluye_caja,
        incluye_manual=p.incluye_manual, incluye_disco=p.incluye_disco, color=p.color, origen=p.origen,
        etiquetas=[e.etiqueta for e in p.etiquetas], modos=[m.modo for m in p.modos],
        fotos=fotos_de(p), monto_reserva=p.monto_reserva,
        cupos_reserva=cupos_de_reserva(db, p), total_resenas=total,
        resenas=[ResenaSalida(id=r.id, nombre=r.nombre_publico, estrellas=r.estrellas, texto=r.texto, fecha=r.fecha,
                              respuesta=r.respuesta, verificada=r.venta_id is not None) for r in ultimas],
    )


@router.get("/{producto_id}/parecidos", response_model=list[ProductoSalida])
def productos_parecidos(producto_id: int, db: Session = Depends(get_db)):
    """KNN: los 4 productos más parecidos, para la sección "También te puede gustar" de la ficha."""
    ids = parecidos(db, producto_id)
    por_id = {p.id: p for p in db.scalars(_consulta_base().where(Producto.id.in_(ids)))}
    notas = calificaciones(db)
    return [a_salida(por_id[i], notas) for i in ids if i in por_id]


@router.patch("/{producto_id}", response_model=ProductoSalida, dependencies=[Depends(solo_dueno)])
def editar(producto_id: int, cambios: ProductoEdicion, db: Session = Depends(get_db)):
    """Solo Ángel: la trabajadora no cambia precios."""
    p = db.scalar(_consulta_base().where(Producto.id == producto_id))
    if p is None:
        raise HTTPException(404, "Producto no encontrado.")
    estaba_agotado = p.stock == 0
    for campo, valor in cambios.model_dump(exclude_none=True).items():
        setattr(p, campo, valor)
    if estaba_agotado and p.stock > 0:
        avisar_llegada(db, p)
    db.commit()
    return a_salida(p, calificaciones(db))


def avisar_llegada(db: Session, p: Producto) -> None:
    """HU-05: cuando un producto agotado vuelve a tener stock, avisa a quienes pidieron "Avísame"."""
    grupos = select(GrupoInteres.clave).where(GrupoInteres.producto_id == p.id)
    pendientes = db.scalars(select(AvisoLlegada).where(AvisoLlegada.grupo_clave.in_(grupos), AvisoLlegada.avisado_en.is_(None)))
    for aviso in pendientes:
        db.add(Notificacion(cliente_id=aviso.cliente_id, titulo=f"¡Llegó {p.nombre}!",
                            detalle="Ya está disponible en la tienda. Quedan pocas unidades.", destino=f"/producto/{p.id}"))
        aviso.avisado_en = datetime.now(UTC)