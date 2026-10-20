"""HU-06: registrar en el sistema el equipo que llega al taller (en vez de anotarlo en WhatsApp)."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import equipo_tienda
from app.database import get_db
from app.models import CategoriaFalla, Cliente, Empleado, Reparacion, ReparacionHistorial, TipoServicio, Usuario
from app.models.enums import EstadoReparacion
from app.schemas import Opcion, OpcionesTaller, ReparacionEntrada, ReparacionSalida

router = APIRouter(prefix="/reparaciones", tags=["Taller"], dependencies=[Depends(equipo_tienda)])


def a_salida(r: Reparacion, cliente: Cliente, tecnicos: dict[int, str]) -> ReparacionSalida:
    return ReparacionSalida(
        id=r.id, codigo=r.codigo, cliente=cliente.nombre, telefono=cliente.telefono, equipo=r.equipo, falla=r.falla,
        servicio=r.tipo_servicio.nombre if r.tipo_servicio else None, diagnostico=r.diagnostico, costo=r.costo,
        precio_acordado=r.precio_acordado, estado=r.estado, tecnico=tecnicos.get(r.tecnico_id), fecha_ingreso=r.fecha_ingreso,
    )


def nombres_tecnicos(db: Session) -> dict[int, str]:
    return {e.usuario_id: e.nombre.split(" ")[0] for e in db.scalars(select(Empleado))}


def siguiente_codigo(db: Session) -> str:
    """R-2062 -> R-2063. El cliente usará este código para rastrear su equipo (HU-07)."""
    codigos = db.scalars(select(Reparacion.codigo).where(Reparacion.codigo.like("R-%")))
    ultimo = max((int(c[2:]) for c in codigos if c[2:].isdigit()), default=2000)
    return f"R-{max(ultimo, 2000) + 1}"


@router.get("/opciones", response_model=OpcionesTaller)
def opciones(db: Session = Depends(get_db)):
    """Listas para los desplegables del formulario."""
    servicios = db.scalars(select(TipoServicio).where(TipoServicio.activo.is_(True)).order_by(TipoServicio.nombre))
    fallas = db.scalars(select(CategoriaFalla).order_by(CategoriaFalla.nombre))
    return OpcionesTaller(servicios=[Opcion(id=s.id, nombre=s.nombre, precio_desde=s.precio_desde) for s in servicios],
                          fallas=[Opcion(id=f.id, nombre=f.nombre) for f in fallas])


@router.get("", response_model=list[ReparacionSalida])
def en_taller(db: Session = Depends(get_db)):
    """Equipos que siguen en el taller (todavía no entregados), del más reciente al más antiguo."""
    filas = db.execute(
        select(Reparacion, Cliente).join(Cliente, Cliente.id == Reparacion.cliente_id)
        .where(Reparacion.estado != EstadoReparacion.entregado)
        .options(selectinload(Reparacion.tipo_servicio))
        .order_by(Reparacion.fecha_ingreso.desc(), Reparacion.id.desc())
    )
    tecnicos = nombres_tecnicos(db)
    return [a_salida(r, c, tecnicos) for r, c in filas]


@router.post("", response_model=ReparacionSalida, status_code=status.HTTP_201_CREATED)
def registrar(datos: ReparacionEntrada, db: Session = Depends(get_db), usuario: Usuario = Depends(equipo_tienda)):
    """Registra el equipo recibido. Si el celular ya existe, se usa ese cliente; si no, se crea."""
    if datos.tipo_servicio_id and db.get(TipoServicio, datos.tipo_servicio_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Ese servicio no existe.")
    if datos.categoria_falla_id and db.get(CategoriaFalla, datos.categoria_falla_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Esa categoría de falla no existe.")

    cliente = db.scalar(select(Cliente).where(Cliente.telefono == datos.cliente_telefono))
    if cliente is None:
        cliente = Cliente(nombre=datos.cliente_nombre.strip(), telefono=datos.cliente_telefono)
        db.add(cliente)
        db.flush()

    rep = Reparacion(
        codigo=siguiente_codigo(db), cliente_id=cliente.id, tipo_servicio_id=datos.tipo_servicio_id,
        categoria_falla_id=datos.categoria_falla_id, equipo=datos.equipo.strip(), falla=datos.falla.strip(),
        diagnostico=datos.diagnostico or None, costo=datos.costo, precio_acordado=datos.precio_acordado,
        duracion_estimada=datos.duracion_estimada or None, tecnico_id=usuario.id, fecha_ingreso=date.today(),
        estado=EstadoReparacion.recibido,
        historial=[ReparacionHistorial(estado=EstadoReparacion.recibido, cambiado_por_id=usuario.id)],
    )
    db.add(rep)
    db.commit()
    db.refresh(rep)
    return a_salida(rep, cliente, nombres_tecnicos(db))