"""HU-05: favoritos, "Avísame cuando llegue" y notificaciones del cliente.
HU-26: "Mi cuenta" (datos y contraseña) y "Mis reparaciones".
HU-27: encuesta de gustos (3 pasos después de crear la cuenta) y afinidad de cada producto con esos gustos."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from app.api.deps import solo_cliente
from app.api.routes.productos import _consulta_base, a_salida, calificaciones
from app.core.security import hash_password, verificar_password
from app.database import get_db
from app.ia.recomendador import Gustos, puntuar
from app.models import (
    AvisoLlegada,
    Cliente,
    Favorito,
    Genero,
    GrupoInteres,
    Notificacion,
    PreferenciaCliente,
    Producto,
    Reparacion,
    Usuario,
)
from app.schemas import (
    Afinidad,
    Encuesta,
    EncuestaSalida,
    AvisoSalida,
    CambioClave,
    MiReparacion,
    NotificacionSalida,
    PerfilCliente,
    ProductoSalida,
)

router = APIRouter(prefix="/mi", tags=["Mi cuenta"])


def mi_cliente(usuario: Usuario = Depends(solo_cliente), db: Session = Depends(get_db)) -> Cliente:
    cliente = db.scalar(select(Cliente).where(Cliente.usuario_id == usuario.id))
    if cliente is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Tu cuenta no tiene datos de cliente.")
    return cliente


def producto_o_404(db: Session, producto_id: int) -> Producto:
    p = db.get(Producto, producto_id)
    if p is None or not p.activo:
        raise HTTPException(404, "Producto no encontrado.")
    return p


# ── Favoritos ────────────────────────────────────────────────────────
@router.get("/favoritos", response_model=list[ProductoSalida])
def favoritos(cliente: Cliente = Depends(mi_cliente), db: Session = Depends(get_db)):
    ids = select(Favorito.producto_id).where(Favorito.cliente_id == cliente.id)
    notas = calificaciones(db)
    return [a_salida(p, notas) for p in db.scalars(_consulta_base().where(Producto.id.in_(ids)))]


@router.put("/favoritos/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
def guardar_favorito(producto_id: int, cliente: Cliente = Depends(mi_cliente), db: Session = Depends(get_db)):
    """PUT: si ya estaba guardado, no pasa nada (se puede llamar dos veces sin duplicar)."""
    producto_o_404(db, producto_id)
    if db.get(Favorito, (cliente.id, producto_id)) is None:
        db.add(Favorito(cliente_id=cliente.id, producto_id=producto_id))
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/favoritos/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
def quitar_favorito(producto_id: int, cliente: Cliente = Depends(mi_cliente), db: Session = Depends(get_db)):
    fav = db.get(Favorito, (cliente.id, producto_id))
    if fav:
        db.delete(fav)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Avísame cuando llegue ───────────────────────────────────────────
@router.get("/avisos", response_model=list[AvisoSalida])
def mis_avisos(cliente: Cliente = Depends(mi_cliente), db: Session = Depends(get_db)):
    """Los "Avísame" que todavía esperan (aún no llega el producto)."""
    filas = db.execute(select(AvisoLlegada, GrupoInteres).join(GrupoInteres, GrupoInteres.clave == AvisoLlegada.grupo_clave)
                       .where(AvisoLlegada.cliente_id == cliente.id, AvisoLlegada.avisado_en.is_(None))
                       .order_by(AvisoLlegada.creado_en.desc()))
    return [AvisoSalida(producto_id=g.producto_id, nombre=g.nombre, pedido_en=a.creado_en) for a, g in filas]


@router.post("/avisos/{producto_id}", status_code=status.HTTP_201_CREATED, response_model=AvisoSalida)
def pedir_aviso(producto_id: int, cliente: Cliente = Depends(mi_cliente), db: Session = Depends(get_db)):
    p = producto_o_404(db, producto_id)
    if p.stock > 0 or p.es_preventa:
        raise HTTPException(status.HTTP_409_CONFLICT, "Este producto ya está disponible.")
    # Cada producto tiene su "grupo de interés" (el mismo que usa el tablero en "Lo más buscado")
    grupo = db.scalar(select(GrupoInteres).where(GrupoInteres.producto_id == p.id))
    if grupo is None:
        grupo = GrupoInteres(clave=f"p:{p.codigo}", nombre=p.nombre, producto_id=p.id)
        db.add(grupo)
        db.flush()
    aviso = db.scalar(select(AvisoLlegada).where(AvisoLlegada.cliente_id == cliente.id, AvisoLlegada.grupo_clave == grupo.clave,
                                                 AvisoLlegada.avisado_en.is_(None)))
    if aviso is None:
        aviso = AvisoLlegada(cliente_id=cliente.id, grupo_clave=grupo.clave)
        db.add(aviso)
        db.commit()
        db.refresh(aviso)
    return AvisoSalida(producto_id=p.id, nombre=p.nombre, pedido_en=aviso.creado_en)


# ── Notificaciones ──────────────────────────────────────────────────
@router.get("/notificaciones", response_model=list[NotificacionSalida])
def notificaciones(cliente: Cliente = Depends(mi_cliente), db: Session = Depends(get_db)):
    return db.scalars(select(Notificacion).where(Notificacion.cliente_id == cliente.id)
                      .order_by(Notificacion.creada_en.desc()).limit(20)).all()


@router.post("/notificaciones/leidas", status_code=status.HTTP_204_NO_CONTENT)
def marcar_leidas(cliente: Cliente = Depends(mi_cliente), db: Session = Depends(get_db)):
    db.execute(update(Notificacion).where(Notificacion.cliente_id == cliente.id).values(leida=True))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── HU-26: Mi cuenta ────────────────────────────────────────────────
def a_perfil(cliente: Cliente) -> PerfilCliente:
    return PerfilCliente(nombre=cliente.nombre, email=cliente.usuario.email, telefono=cliente.telefono, distrito=cliente.distrito)


@router.get("/perfil", response_model=PerfilCliente)
def ver_perfil(cliente: Cliente = Depends(mi_cliente)):
    return a_perfil(cliente)


@router.put("/perfil", response_model=PerfilCliente)
def guardar_perfil(datos: PerfilCliente, cliente: Cliente = Depends(mi_cliente), db: Session = Depends(get_db)):
    """Con estos datos se preparan sus pedidos para recojo y sus reparaciones."""
    email = datos.email.lower()
    if db.scalar(select(Usuario.id).where(Usuario.email == email, Usuario.id != cliente.usuario_id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese correo ya lo usa otra cuenta.")
    if datos.telefono and db.scalar(select(Cliente.id).where(Cliente.telefono == datos.telefono, Cliente.id != cliente.id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese celular ya está registrado en otra cuenta. Escríbenos por WhatsApp.")
    cliente.nombre, cliente.telefono, cliente.distrito = datos.nombre.strip(), datos.telefono, (datos.distrito or "").strip() or None
    cliente.usuario.email = email
    db.commit()
    return a_perfil(cliente)


@router.post("/clave", status_code=status.HTTP_204_NO_CONTENT)
def cambiar_clave(datos: CambioClave, cliente: Cliente = Depends(mi_cliente), db: Session = Depends(get_db)):
    if not verificar_password(datos.actual, cliente.usuario.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La contraseña actual no es correcta.")
    cliente.usuario.password_hash = hash_password(datos.nueva)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── HU-26: Mis reparaciones ─────────────────────────────────────────
@router.get("/reparaciones", response_model=list[MiReparacion])
def mis_reparaciones(cliente: Cliente = Depends(mi_cliente), db: Session = Depends(get_db)):
    """Los equipos que dejó en el taller (los registra la tienda con su celular)."""
    filas = db.scalars(select(Reparacion).where(Reparacion.cliente_id == cliente.id)
                       .order_by(Reparacion.fecha_ingreso.desc(), Reparacion.id.desc()))
    return [MiReparacion(codigo=r.codigo, fecha=r.fecha_ingreso, equipo=r.equipo, falla=r.falla, costo=r.costo,
                         precio_acordado=r.precio_acordado, estado=r.estado) for r in filas]


# ── HU-27: encuesta de gustos ─────────────────────────────────────────────────────────
def encuesta_de(cliente: Cliente) -> EncuestaSalida:
    pref = cliente.preferencias
    if pref is None:
        return EncuestaSalida(hecha=False, perfil=None)
    gustos = Gustos.de(pref)
    return EncuestaSalida(hecha=True, generos=list(gustos.generos), modo=pref.modo_juego, consola=pref.consola,
                          perfil=None if gustos.vacios else gustos.perfil())


@router.get("/encuesta", response_model=EncuestaSalida)
def mi_encuesta(cliente: Cliente = Depends(mi_cliente)):
    """hecha=False: el cliente nunca respondió ni saltó la encuesta (se le muestra la primera vez)."""
    return encuesta_de(cliente)


@router.put("/encuesta", response_model=EncuestaSalida)
def responder_encuesta(datos: Encuesta, cliente: Cliente = Depends(mi_cliente), db: Session = Depends(get_db)):
    """Guarda (o cambia, con "Ajustar mis gustos") las respuestas. Si salta la encuesta llega todo vacío
    y igual se guarda, para no volver a preguntarle."""
    generos = list(db.scalars(select(Genero).where(Genero.id.in_(datos.generos)))) if datos.generos else []
    if len(generos) != len(set(datos.generos)):
        raise HTTPException(422, "Hay un género que no existe.")
    pref = cliente.preferencias or PreferenciaCliente(cliente=cliente)
    pref.generos, pref.modo_juego, pref.consola = generos, datos.modo, datos.consola
    pref.completada_en = func.now()
    db.add(pref)
    db.commit()
    db.refresh(cliente)
    return encuesta_de(cliente)


@router.get("/afinidad", response_model=list[Afinidad])
def mi_afinidad(cliente: Cliente = Depends(mi_cliente), db: Session = Depends(get_db)):
    """Puntos y razón de cada producto según la encuesta (para ordenar "Para ti primero" en Ofertas)."""
    gustos = Gustos.de(cliente.preferencias)
    productos = db.scalars(_consulta_base().options(selectinload(Producto.modos)))
    return [Afinidad(producto_id=p.id, puntos=n, razon=r) for p in productos for n, r in [puntuar(p, gustos)]]
