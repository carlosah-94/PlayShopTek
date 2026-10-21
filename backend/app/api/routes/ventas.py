"""HU-03: el cliente paga su carrito con Yape o tarjeta y lo recoge en la tienda."""
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import solo_cliente
from app.api.routes.productos import oferta_vigente
from app.database import get_db
from app.models import Cliente, Producto, Usuario, Venta, VentaItem
from app.models.enums import Canal, EstadoVenta, MetodoPago
from app.schemas import CompraEntrada, VentaItemSalida, VentaSalida

router = APIRouter(prefix="/ventas", tags=["Compras"])


def precio_final(p: Producto) -> Decimal:
    """El mismo cálculo del catálogo: precio con la oferta vigente, redondeado a soles enteros."""
    o = oferta_vigente(p)
    return p.precio if o is None else (p.precio * (100 - o.porcentaje) / 100).quantize(Decimal("1"), ROUND_HALF_UP)


def siguiente_codigo(db: Session) -> str:
    codigos = db.scalars(select(Venta.codigo).where(Venta.codigo.like("V-%")))
    return f"V-{max((int(c[2:]) for c in codigos if c[2:].isdigit()), default=1000) + 1}"


def a_salida(v: Venta) -> VentaSalida:
    return VentaSalida(codigo=v.codigo, fecha=v.fecha, estado=v.estado, metodo_pago=v.metodo_pago, total=v.total,
                       items=[VentaItemSalida(nombre=i.nombre_producto, cantidad=i.cantidad, precio_unitario=i.precio_unitario)
                              for i in v.items])


def cliente_de(usuario: Usuario, db: Session) -> Cliente:
    cliente = db.scalar(select(Cliente).where(Cliente.usuario_id == usuario.id))
    if cliente is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Tu cuenta no tiene datos de cliente.")
    return cliente


@router.post("", response_model=VentaSalida, status_code=status.HTTP_201_CREATED)
def comprar(datos: CompraEntrada, db: Session = Depends(get_db), usuario: Usuario = Depends(solo_cliente)):
    if datos.metodo_pago == "yape" and not datos.numero_operacion:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Escribe el número de operación que te mostró Yape.")
    cliente = cliente_de(usuario, db)

    # "FOR UPDATE" bloquea estas filas hasta terminar: si dos personas compran la última unidad
    # al mismo tiempo, la segunda espera y luego ve que ya no hay stock (no se vende dos veces).
    ids = [i.producto_id for i in datos.items]
    productos = {p.id: p for p in db.scalars(
        select(Producto).where(Producto.id.in_(ids), Producto.activo.is_(True))
        .options(selectinload(Producto.ofertas)).with_for_update()
    )}

    lineas, total = [], Decimal(0)
    for item in datos.items:
        p = productos.get(item.producto_id)
        if p is None:
            raise HTTPException(404, "Uno de los productos ya no está disponible.")
        if p.es_preventa:
            raise HTTPException(status.HTTP_409_CONFLICT, f"{p.nombre} es preventa: resérvalo desde su ficha.")
        if p.stock < item.cantidad:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Solo quedan {p.stock} de {p.nombre}.")
        precio = precio_final(p)
        p.stock -= item.cantidad
        lineas.append(VentaItem(producto_id=p.id, nombre_producto=p.nombre, precio_unitario=precio, cantidad=item.cantidad))
        total += precio * item.cantidad

    venta = Venta(
        codigo=siguiente_codigo(db), cliente_id=cliente.id, canal=Canal.web, metodo_pago=MetodoPago(datos.metodo_pago),
        numero_operacion=datos.numero_operacion if datos.metodo_pago == "yape" else None,  # nunca datos de tarjeta
        estado=EstadoVenta.pagado, total=total, fecha=date.today(), items=lineas,
    )
    db.add(venta)
    db.commit()
    db.refresh(venta)
    return a_salida(venta)


@router.get("/mias", response_model=list[VentaSalida])
def mis_compras(db: Session = Depends(get_db), usuario: Usuario = Depends(solo_cliente)):
    """'Mis compras': incluye lo que compró en la tienda con su mismo celular."""
    cliente = cliente_de(usuario, db)
    ventas = db.scalars(select(Venta).where(Venta.cliente_id == cliente.id)
                        .options(selectinload(Venta.items)).order_by(Venta.fecha.desc(), Venta.id.desc()))
    return [a_salida(v) for v in ventas]