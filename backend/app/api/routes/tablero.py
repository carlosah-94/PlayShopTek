"""HU-13: tablero del negocio. Solo Ángel: la trabajadora no ve las ventas totales."""
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import solo_dueno
from app.database import get_db
from app.models import (
    AvisoLlegada, CategoriaFalla, GrupoInteres, Interes, Producto, Reparacion, Resena, Venta, VentaItem,
)
from app.models.enums import EstadoReparacion, EstadoVenta
from app.schemas import Buscado, Cifra, Semana, TableroSalida

router = APIRouter(prefix="/tablero", tags=["Tablero"], dependencies=[Depends(solo_dueno)])

CANALES = {"web": "Página web", "tienda": "En tienda", "whatsapp": "WhatsApp"}
METODOS = {"yape": "Yape", "tarjeta": "Tarjeta", "efectivo": "Efectivo", "transferencia": "Transferencia BCP"}


def redondear(x, decimales="0.1") -> Decimal:
    return Decimal(x or 0).quantize(Decimal(decimales), ROUND_HALF_UP)


@router.get("", response_model=TableroSalida)
def tablero(dias: int = Query(30, ge=7, le=365, description="Período: últimos N días"), db: Session = Depends(get_db)):
    hoy = date.today()
    desde = hoy - timedelta(days=dias - 1)
    # Ventas válidas del período (las canceladas no cuentan)
    validas = (Venta.fecha >= desde, Venta.estado != EstadoVenta.cancelado)

    total, cantidad = db.execute(select(func.coalesce(func.sum(Venta.total), 0), func.count()).where(*validas)).one()
    por_canal = db.execute(select(Venta.canal, func.sum(Venta.total)).where(*validas).group_by(Venta.canal)).all()
    por_metodo = db.execute(select(Venta.metodo_pago, func.count()).where(*validas).group_by(Venta.metodo_pago)).all()
    mas_vendidos = db.execute(
        select(VentaItem.nombre_producto, func.sum(VentaItem.cantidad).label("unidades"))
        .join(Venta, Venta.id == VentaItem.venta_id).where(*validas)
        .group_by(VentaItem.nombre_producto).order_by(func.sum(VentaItem.cantidad).desc()).limit(5)
    ).all()

    en_taller = db.scalar(select(func.count()).select_from(Reparacion).where(Reparacion.estado != EstadoReparacion.entregado))
    ultimas_4_semanas = db.scalar(select(func.count()).select_from(Reparacion)
                                  .where(Reparacion.fecha_ingreso >= hoy - timedelta(days=27)))
    fallas = db.execute(
        select(CategoriaFalla.nombre, func.count()).join(Reparacion, Reparacion.categoria_falla_id == CategoriaFalla.id)
        .where(Reparacion.fecha_ingreso >= desde).group_by(CategoriaFalla.nombre).order_by(func.count().desc()).limit(5)
    ).all()

    calificacion = db.scalar(select(func.avg(Resena.estrellas)))
    stock_bajo = db.scalar(select(func.count()).select_from(Producto).where(
        Producto.activo.is_(True), Producto.es_preventa.is_(False), Producto.stock <= Producto.umbral_stock_bajo))

    # Lo más buscado: búsquedas agrupadas (gta 6 = gta vi = grand theft auto 6) y pedidos de "Avísame"
    busquedas = db.execute(
        select(GrupoInteres, func.count(Interes.id)).join(Interes, Interes.grupo_clave == GrupoInteres.clave)
        .where(Interes.fecha >= desde).group_by(GrupoInteres.clave).order_by(func.count(Interes.id).desc()).limit(5)
    ).all()
    avisos = dict(db.execute(select(AvisoLlegada.grupo_clave, func.count()).group_by(AvisoLlegada.grupo_clave)).all())
    buscados = []
    for g, n in busquedas:
        p = db.get(Producto, g.producto_id) if g.producto_id else None
        buscados.append(Buscado(nombre=g.nombre, busquedas=n, avisos=avisos.get(g.clave, 0),
                                hay_en_tienda=bool(p and (p.stock > 0 or p.es_preventa))))

    # HU-11: lo que buscaron y no encontraron (texto tal cual, agrupado por igualdad)
    sin_resultado = db.execute(
        select(Interes.texto, func.count()).where(Interes.fecha >= desde, Interes.tuvo_resultados.is_(False))
        .group_by(Interes.texto).order_by(func.count().desc()).limit(5)
    ).all()
    
    # Últimas 8 semanas, de lunes a domingo, para el gráfico
    lunes = hoy - timedelta(days=hoy.weekday())
    semanas = []
    for k in range(7, -1, -1):
        ini, fin = lunes - timedelta(weeks=k), lunes - timedelta(weeks=k) + timedelta(days=6)
        v = db.scalar(select(func.coalesce(func.sum(Venta.total), 0))
                      .where(Venta.fecha.between(ini, fin), Venta.estado != EstadoVenta.cancelado))
        r = db.scalar(select(func.count()).select_from(Reparacion).where(Reparacion.fecha_ingreso.between(ini, fin)))
        semanas.append(Semana(semana=ini, ventas=v, reparaciones=r))

    return TableroSalida(
        desde=desde, hasta=hoy, ventas_total=total, ventas_cantidad=cantidad,
        ticket_promedio=redondear(total / cantidad if cantidad else 0, "1"),
        ventas_por_canal=[Cifra(nombre=CANALES[c.value], valor=s) for c, s in por_canal],
        ventas_por_metodo=[Cifra(nombre=METODOS[m.value], valor=n) for m, n in por_metodo],
        mas_vendidos=[Cifra(nombre=n, valor=u) for n, u in mas_vendidos],
        reparaciones_en_taller=en_taller, reparaciones_por_semana=redondear(ultimas_4_semanas / 4),
        fallas_frecuentes=[Cifra(nombre=n, valor=c) for n, c in fallas],
        calificacion=redondear(calificacion) if calificacion else None, stock_bajo=stock_bajo,
        mas_buscados=buscados, sin_resultado=[Cifra(nombre=t, valor=n) for t, n in sin_resultado], semanas=semanas,
    )