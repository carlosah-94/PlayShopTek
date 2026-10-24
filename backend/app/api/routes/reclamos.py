"""HU-18: Libro de Reclamaciones virtual, como exige la Ley N.º 29571 (Código de Protección al Consumidor)."""
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import equipo_tienda, solo_dueno, usuario_opcional
from app.database import get_db
from app.models import Cliente, Reclamo, Usuario
from app.models.enums import EstadoReclamo, TipoReclamo
from app.schemas import ReclamoEntrada, ReclamoSalida, RespuestaReclamo

router = APIRouter(prefix="/reclamos", tags=["Libro de Reclamaciones"])

DIAS_PARA_RESPONDER = 15  # días hábiles que da la ley para responder


def sumar_dias_habiles(desde: date, dias: int) -> date:
    """Cuenta solo de lunes a viernes: 15 días hábiles son unas 3 semanas."""
    fecha = desde
    while dias > 0:
        fecha += timedelta(days=1)
        if fecha.weekday() < 5:  # 0 = lunes ... 4 = viernes
            dias -= 1
    return fecha


def siguiente_codigo(db: Session, hoy: date) -> str:
    """LR-2026-0001, LR-2026-0002... (LR = Libro de Reclamaciones; distinto del R- de reparaciones)."""
    prefijo = f"LR-{hoy.year}-"
    codigos = db.scalars(select(Reclamo.codigo).where(Reclamo.codigo.like(prefijo + "%")))
    ultimo = max((int(c[len(prefijo):]) for c in codigos), default=0)
    return f"{prefijo}{ultimo + 1:04d}"


@router.post("", response_model=ReclamoSalida, status_code=status.HTTP_201_CREATED)
def registrar(datos: ReclamoEntrada, db: Session = Depends(get_db), usuario: Usuario | None = Depends(usuario_opcional)):
    """Público: cualquiera puede dejar su reclamo, tenga o no cuenta. Recibe un código para hacer seguimiento."""
    hoy = date.today()
    cliente = db.scalar(select(Cliente).where(Cliente.usuario_id == usuario.id)) if usuario else None
    reclamo = Reclamo(
        **datos.model_dump(exclude={"tipo"}), tipo=TipoReclamo(datos.tipo), codigo=siguiente_codigo(db, hoy),
        cliente_id=cliente.id if cliente else None, fecha=hoy, fecha_limite=sumar_dias_habiles(hoy, DIAS_PARA_RESPONDER),
    )
    db.add(reclamo)
    db.commit()
    return reclamo


@router.get("", response_model=list[ReclamoSalida], dependencies=[Depends(equipo_tienda)])
def listar(db: Session = Depends(get_db)):
    """Dueño y trabajadora: primero los pendientes, del plazo más cercano al más lejano."""
    return db.scalars(select(Reclamo).order_by(Reclamo.estado != EstadoReclamo.pendiente, Reclamo.fecha_limite, Reclamo.id))


@router.patch("/{reclamo_id}/respuesta", response_model=ReclamoSalida, dependencies=[Depends(solo_dueno)])
def responder(reclamo_id: int, datos: RespuestaReclamo, db: Session = Depends(get_db)):
    """Solo Ángel responde: es el responsable legal del negocio."""
    reclamo = db.get(Reclamo, reclamo_id)
    if reclamo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reclamo no encontrado.")
    reclamo.respuesta = datos.respuesta
    reclamo.estado = EstadoReclamo.respondido
    reclamo.respondido_en = datetime.now(UTC)
    db.commit()
    return reclamo