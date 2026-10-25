"""HU-03: el cliente paga su carrito con Yape o tarjeta y lo recoge en la tienda. HU-04: reserva de preventa.
HU-15: Linda o Ángel registran las ventas del mostrador y de WhatsApp."""
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import equipo_tienda, solo_cliente
from app.api.routes.productos import cupos_de_reserva, oferta_vigente
from app.database import get_db
from app.models import Cliente, Empleado, Producto, Usuario, Venta, VentaItem
from app.models.enums import Canal, EstadoVenta, MetodoPago
from app.schemas import (
    CompraEntrada, ItemCarrito, ReservaEntrada, VentaItemSalida, VentaSalida, VentaTiendaEntrada, VentaTiendaSalida,
)

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


def armar_lineas(db: Session, items: list[ItemCarrito]) -> tuple[list[VentaItem], Decimal]:
    """Calcula el precio de cada producto y descuenta el stock. Lo usan la web (HU-03) y la tienda (HU-15)."""
    # "FOR UPDATE" bloquea estas filas hasta terminar: si dos personas compran la última unidad
    # al mismo tiempo, la segunda espera y luego ve que ya no hay stock (no se vende dos veces).
    ids = [i.producto_id for i in items]
    productos = {p.id: p for p in db.scalars(
        select(Producto).where(Producto.id.in_(ids), Producto.activo.is_(True))
        .options(selectinload(Producto.ofertas)).with_for_update()
    )}

    lineas, total = [], Decimal(0)
    for item in items:
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
    return lineas, total


@router.post("", response_model=VentaSalida, status_code=status.HTTP_201_CREATED)
def comprar(datos: CompraEntrada, db: Session = Depends(get_db), usuario: Usuario = Depends(solo_cliente)):
    if datos.metodo_pago == "yape" and not datos.numero_operacion:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Escribe el número de operación que te mostró Yape.")
    cliente = cliente_de(usuario, db)

    lineas, total = armar_lineas(db, datos.items)

    venta = Venta(
        codigo=siguiente_codigo(db), cliente_id=cliente.id, canal=Canal.web, metodo_pago=MetodoPago(datos.metodo_pago),
        numero_operacion=datos.numero_operacion if datos.metodo_pago == "yape" else None,  # nunca datos de tarjeta
        estado=EstadoVenta.pagado, total=total, fecha=date.today(), items=lineas,
    )
    db.add(venta)
    db.commit()
    db.refresh(venta)
    return a_salida(venta)


@router.post("/reserva", response_model=VentaSalida, status_code=status.HTTP_201_CREATED)
def reservar(datos: ReservaEntrada, db: Session = Depends(get_db), usuario: Usuario = Depends(solo_cliente)):
    """HU-04: paga solo la reserva (ej. S/ 50) y el resto al recoger el día del lanzamiento."""
    if datos.metodo_pago == "yape" and not datos.numero_operacion:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Escribe el número de operación que te mostró Yape.")
    cliente = cliente_de(usuario, db)
    p = db.scalar(select(Producto).where(Producto.id == datos.producto_id, Producto.activo.is_(True)).with_for_update())
    if p is None or not p.es_preventa or not p.monto_reserva:
        raise HTTPException(404, "Ese producto no está en preventa.")
    ya_reservo = db.scalar(select(Venta.id).join(VentaItem).where(
        Venta.cliente_id == cliente.id, Venta.estado == EstadoVenta.reservado, VentaItem.producto_id == p.id))
    if ya_reservo:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya tienes una reserva de este juego.")
    if cupos_de_reserva(db, p) == 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "Se acabaron los cupos de reserva para el lanzamiento.")

    venta = Venta(
        codigo=siguiente_codigo(db), cliente_id=cliente.id, canal=Canal.web, metodo_pago=MetodoPago(datos.metodo_pago),
        numero_operacion=datos.numero_operacion if datos.metodo_pago == "yape" else None,
        estado=EstadoVenta.reservado, total=p.monto_reserva, fecha=date.today(),
        items=[VentaItem(producto_id=p.id, nombre_producto=p.nombre, precio_unitario=p.monto_reserva, cantidad=1, es_preventa=True)],
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


# ── HU-15: ventas en tienda y por WhatsApp ────────────────────────────────────────────
CLIENTE_MOSTRADOR = "Cliente de mostrador"  # para quien compra sin dar su celular


def cliente_para_venta(db: Session, nombre: str | None, telefono: str | None) -> Cliente:
    """Si da su celular, se usa (o se crea) ese cliente: así luego ve la compra en "Mis compras"."""
    if telefono:
        cliente = db.scalar(select(Cliente).where(Cliente.telefono == telefono))
        if cliente is None:
            cliente = Cliente(nombre=(nombre or "Cliente").strip(), telefono=telefono)
            db.add(cliente)
            db.flush()
        return cliente
    cliente = db.scalar(select(Cliente).where(Cliente.nombre == CLIENTE_MOSTRADOR, Cliente.telefono.is_(None)))
    if cliente is None:
        cliente = Cliente(nombre=CLIENTE_MOSTRADOR)
        db.add(cliente)
        db.flush()
    return cliente


def a_salida_tienda(v: Venta, db: Session) -> VentaTiendaSalida:
    cliente = db.get(Cliente, v.cliente_id)
    empleado = db.get(Empleado, v.registrada_por_id) if v.registrada_por_id else None
    return VentaTiendaSalida(**a_salida(v).model_dump(), canal=v.canal.value, cliente=cliente.nombre,
                             registrada_por=empleado.nombre if empleado else None)


@router.post("/tienda", response_model=VentaTiendaSalida, status_code=status.HTTP_201_CREATED)
def registrar_en_tienda(datos: VentaTiendaEntrada, db: Session = Depends(get_db), usuario: Usuario = Depends(equipo_tienda)):
    """Linda o Ángel registran una venta. Descuenta el stock igual que la web y queda en el tablero."""
    if datos.canal == "whatsapp" and datos.metodo_pago != "yape":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Por WhatsApp solo se cobra con Yape.")
    if datos.metodo_pago == "yape" and not datos.numero_operacion:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Escribe el número de operación de Yape.")
    cliente = cliente_para_venta(db, datos.cliente_nombre, datos.cliente_telefono)
    lineas, total = armar_lineas(db, datos.items)

    venta = Venta(
        codigo=siguiente_codigo(db), cliente_id=cliente.id, canal=Canal(datos.canal),
        metodo_pago=MetodoPago(datos.metodo_pago),
        numero_operacion=datos.numero_operacion if datos.metodo_pago == "yape" else None,
        # En la tienda se lo lleva en el momento; por WhatsApp pagó y pasa a recoger
        estado=EstadoVenta.entregado if datos.canal == "tienda" else EstadoVenta.pagado,
        total=total, fecha=date.today(), items=lineas, registrada_por_id=usuario.id,
    )
    db.add(venta)
    db.commit()
    db.refresh(venta)
    return a_salida_tienda(venta, db)


@router.get("/tienda", response_model=list[VentaTiendaSalida])
def ultimas_en_tienda(db: Session = Depends(get_db), usuario: Usuario = Depends(equipo_tienda)):
    """Las 15 últimas ventas del mostrador y de WhatsApp, para revisar lo registrado en el día."""
    ventas = db.scalars(select(Venta).where(Venta.canal.in_([Canal.tienda, Canal.whatsapp]))
                        .options(selectinload(Venta.items)).order_by(Venta.id.desc()).limit(15))
    return [a_salida_tienda(v, db) for v in ventas]
