"""HU-17: reseñas verificadas. Solo opina quien compró el producto, y la tienda puede responder."""
from datetime import UTC, date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import equipo_tienda, solo_cliente, solo_dueno
from app.api.routes.ventas import cliente_de
from app.database import get_db
from app.models import Producto, Resena, TipoServicio, Usuario, Venta, VentaItem
from app.models.enums import EstadoVenta, OrigenResena
from app.schemas import (
    CambioActivo,
    PuedoOpinar,
    ResenaEntrada,
    ResenaEquipo,
    ResenaSalida,
    RespuestaResena,
)

router = APIRouter(tags=["Reseñas"])

# Cuenta como "compró" si pagó o ya recogió (una reserva o una venta cancelada no cuentan)
COMPRADO = (EstadoVenta.pagado, EstadoVenta.listo_para_recoger, EstadoVenta.entregado)


def compra_del_cliente(db: Session, cliente_id: int, producto_id: int) -> Venta | None:
    """La compra más reciente de ese producto. Incluye lo que compró en tienda con su celular (HU-15)."""
    return db.scalar(select(Venta).join(VentaItem).where(
        Venta.cliente_id == cliente_id, VentaItem.producto_id == producto_id, VentaItem.es_preventa.is_(False),
        Venta.estado.in_(COMPRADO)).order_by(Venta.fecha.desc(), Venta.id.desc()).limit(1))


def ya_opino(db: Session, cliente_id: int, producto_id: int) -> bool:
    return db.scalar(select(Resena.id).join(Venta, Venta.id == Resena.venta_id).where(
        Venta.cliente_id == cliente_id, Resena.producto_id == producto_id).limit(1)) is not None


def a_salida(r: Resena) -> ResenaSalida:
    return ResenaSalida(id=r.id, nombre=r.nombre_publico, estrellas=r.estrellas, texto=r.texto, fecha=r.fecha,
                        respuesta=r.respuesta, verificada=r.venta_id is not None)


@router.get("/productos/{producto_id}/puedo-opinar", response_model=PuedoOpinar)
def puedo_opinar(producto_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(solo_cliente)):
    """La ficha pregunta esto para saber si muestra el formulario de reseña."""
    cliente = cliente_de(usuario, db)
    if ya_opino(db, cliente.id, producto_id):
        return PuedoOpinar(puede=False, motivo="ya_opinaste")
    if compra_del_cliente(db, cliente.id, producto_id) is None:
        return PuedoOpinar(puede=False, motivo="no_compraste")
    return PuedoOpinar(puede=True)


@router.post("/productos/{producto_id}/resenas", response_model=ResenaSalida, status_code=status.HTTP_201_CREATED)
def opinar(producto_id: int, datos: ResenaEntrada, db: Session = Depends(get_db), usuario: Usuario = Depends(solo_cliente)):
    if db.get(Producto, producto_id) is None:
        raise HTTPException(404, "Producto no encontrado.")
    cliente = cliente_de(usuario, db)
    if ya_opino(db, cliente.id, producto_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya dejaste tu reseña de este producto.")
    venta = compra_del_cliente(db, cliente.id, producto_id)
    if venta is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo puedes opinar de productos que compraste.")
    r = Resena(producto_id=producto_id, venta_id=venta.id, estrellas=datos.estrellas, texto=datos.texto.strip(),
               nombre_publico=(datos.nombre_publico or cliente.nombre.split()[0]).strip(),
               origen=OrigenResena(venta.canal.value), fecha=date.today())
    db.add(r)
    db.commit()
    db.refresh(r)
    return a_salida(r)


@router.get("/resenas", response_model=list[ResenaEquipo])
def todas_las_resenas(tipo: Literal["producto", "servicio"] = "producto", db: Session = Depends(get_db),
                      usuario: Usuario = Depends(equipo_tienda)):
    """HU-24: sección "Reseñas" del panel (pestañas Productos y Servicio de reparación).
    Las 120 más recientes de ese tipo, con el producto o servicio del que hablan."""
    de_producto = Resena.producto_id.is_not(None)
    filas = db.execute(
        select(Resena, Producto.nombre, TipoServicio.nombre)
        .outerjoin(Producto, Producto.id == Resena.producto_id)
        .outerjoin(TipoServicio, TipoServicio.id == Resena.tipo_servicio_id)
        .where(de_producto if tipo == "producto" else ~de_producto)
        .order_by(Resena.fecha.desc(), Resena.id.desc()).limit(120))
    return [ResenaEquipo(**a_salida(r).model_dump(), sobre=producto or servicio or "Servicio técnico",
                         es_producto=r.producto_id is not None, destacada=r.destacada, origen=r.origen.value)
            for r, producto, servicio in filas]


@router.patch("/resenas/{resena_id}/destacada", response_model=ResenaSalida, dependencies=[Depends(solo_dueno)])
def destacar(resena_id: int, datos: CambioActivo, db: Session = Depends(get_db)):
    """HU-24: Ángel elige qué reseñas salen en "Lo que dicen los clientes" del inicio."""
    r = db.get(Resena, resena_id)
    if r is None:
        raise HTTPException(404, "Reseña no encontrada.")
    r.destacada = datos.activo
    db.commit()
    return a_salida(r)


@router.patch("/resenas/{resena_id}/respuesta", response_model=ResenaSalida)
def responder(resena_id: int, datos: RespuestaResena, db: Session = Depends(get_db), usuario: Usuario = Depends(equipo_tienda)):
    """Ángel o Linda responden la reseña; la respuesta se ve debajo, en la ficha."""
    r = db.get(Resena, resena_id)
    if r is None:
        raise HTTPException(404, "Reseña no encontrada.")
    r.respuesta, r.respondida_por_id, r.respondida_en = datos.respuesta.strip(), usuario.id, datetime.now(UTC)
    db.commit()
    return a_salida(r)
