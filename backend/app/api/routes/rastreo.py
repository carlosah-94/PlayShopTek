"""HU-07: el cliente rastrea su reparación con el código y los 4 últimos dígitos de su celular."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Cliente, Reparacion
from app.schemas import PasoHistorial, RastreoSalida

router = APIRouter(prefix="/rastreo", tags=["Rastreo"])

NO_ENCONTRADA = "No encontramos una reparación con ese código y celular. Revisa los datos o escríbenos por WhatsApp."


def normalizar(codigo: str) -> str:
    """Acepta 'r-2063', 'R2063' o solo '2063' y lo deja como 'R-2063'."""
    numero = "".join(c for c in codigo if c.isdigit())
    return f"R-{numero}"


@router.get("/{codigo}", response_model=RastreoSalida)
def rastrear(codigo: str, celular: str = Query(pattern=r"^\d{4}$", description="4 últimos dígitos del celular"),
             db: Session = Depends(get_db)):
    """Público (sin iniciar sesión). Pide los 4 últimos dígitos del celular para que nadie
    vea la reparación de otra persona solo adivinando códigos."""
    fila = db.execute(
        select(Reparacion, Cliente).join(Cliente, Cliente.id == Reparacion.cliente_id)
        .where(Reparacion.codigo == normalizar(codigo))
        .options(selectinload(Reparacion.historial), selectinload(Reparacion.tipo_servicio))
    ).first()
    # El mismo mensaje si el código no existe o si el celular no coincide: así no se revela cuál falló
    if fila is None or not (fila.Cliente.telefono or "").endswith(celular):
        raise HTTPException(404, NO_ENCONTRADA)
    r, c = fila
    return RastreoSalida(
        codigo=r.codigo, cliente=c.nombre.split(" ")[0], equipo=r.equipo, falla=r.falla,
        servicio=r.tipo_servicio.nombre if r.tipo_servicio else None, estado=r.estado, costo=r.costo,
        precio_acordado=r.precio_acordado, duracion_estimada=r.duracion_estimada, fecha_ingreso=r.fecha_ingreso,
        historial=[PasoHistorial(estado=h.estado, fecha=h.cambiado_en) for h in r.historial],
    )