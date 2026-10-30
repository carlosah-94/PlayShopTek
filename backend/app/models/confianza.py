"""Reseñas (web y con código) y Libro de Reclamaciones."""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Numeric, SmallInteger, String, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import EstadoReclamo, OrigenResena, TipoReclamo, columna_enum


class Resena(Base):
    """Reseña de un producto o de un servicio técnico.

    Para no repetir datos (3FN):
    - Quién la escribió se sabe por la compra (venta_id) o la reparación (reparacion_id).
    - Si viene de una reparación, el servicio se saca de la reparación; tipo_servicio_id
      solo se usa cuando no hay reparación enlazada (reseñas importadas del prototipo).
    - Es "verificada" cuando tiene venta_id o reparacion_id.
    """
    __tablename__ = "resenas"
    __table_args__ = (
        CheckConstraint("estrellas BETWEEN 1 AND 5", name="estrellas_rango"),
        # O es de un producto, o es de un servicio; nunca las dos cosas
        CheckConstraint(
            "(producto_id IS NOT NULL) <> (reparacion_id IS NOT NULL OR tipo_servicio_id IS NOT NULL)",
            name="producto_o_servicio",
        ),
        CheckConstraint("NOT (reparacion_id IS NOT NULL AND tipo_servicio_id IS NOT NULL)", name="servicio_sin_repetir"),
        CheckConstraint("venta_id IS NULL OR producto_id IS NOT NULL", name="venta_solo_con_producto"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    producto_id: Mapped[int | None] = mapped_column(ForeignKey("productos.id", ondelete="CASCADE"), index=True)
    venta_id: Mapped[int | None] = mapped_column(ForeignKey("ventas.id"))
    reparacion_id: Mapped[int | None] = mapped_column(ForeignKey("reparaciones.id"), unique=True)
    tipo_servicio_id: Mapped[int | None] = mapped_column(ForeignKey("tipos_servicio.id"), index=True)
    nombre_publico: Mapped[str] = mapped_column(String(60))  # el nombre que el cliente quiere mostrar
    estrellas: Mapped[int] = mapped_column(SmallInteger)
    texto: Mapped[str] = mapped_column(Text)
    origen: Mapped[OrigenResena] = mapped_column(columna_enum(OrigenResena, "origen_resena"), default=OrigenResena.web, server_default="web")
    fecha: Mapped[date] = mapped_column(Date)
    # Respuesta de la tienda (la trabajadora puede responder)
    respuesta: Mapped[str | None] = mapped_column(Text)
    respondida_por_id: Mapped[int | None] = mapped_column(ForeignKey("empleados.usuario_id"))
    respondida_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    destacada: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())  # HU-24: sale en el inicio


class Reclamo(Base):
    """Libro de Reclamaciones virtual (Ley N.º 29571). Plazo de respuesta: 15 días hábiles.

    Los datos del reclamante se guardan TAL COMO los declaró en la hoja: es un
    registro legal y no debe cambiar si luego el cliente edita su perfil.
    """
    __tablename__ = "reclamos"
    __table_args__ = (CheckConstraint("monto_reclamado IS NULL OR monto_reclamado >= 0", name="monto_positivo"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True)  # 'LR-2026-0001' (distinto de los códigos de reparación)
    tipo: Mapped[TipoReclamo] = mapped_column(columna_enum(TipoReclamo, "tipo_reclamo"), default=TipoReclamo.reclamo, server_default="reclamo")
    cliente_id: Mapped[int | None] = mapped_column(ForeignKey("clientes.id"))  # si es un cliente conocido
    nombre: Mapped[str] = mapped_column(String(120))
    correo: Mapped[str] = mapped_column(String(160))
    telefono: Mapped[str | None] = mapped_column(String(15))
    documento: Mapped[str | None] = mapped_column(String(15))   # DNI/CE: lo pide el formato oficial
    domicilio: Mapped[str | None] = mapped_column(String(200))
    bien_contratado: Mapped[str | None] = mapped_column(String(160))  # producto o servicio
    monto_reclamado: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    detalle: Mapped[str] = mapped_column(Text)
    pedido_cliente: Mapped[str | None] = mapped_column(Text)
    venta_id: Mapped[int | None] = mapped_column(ForeignKey("ventas.id"))
    reparacion_id: Mapped[int | None] = mapped_column(ForeignKey("reparaciones.id"))
    estado: Mapped[EstadoReclamo] = mapped_column(
        columna_enum(EstadoReclamo, "estado_reclamo"), default=EstadoReclamo.pendiente, server_default="pendiente", index=True
    )
    fecha: Mapped[date] = mapped_column(Date)
    fecha_limite: Mapped[date | None] = mapped_column(Date)
    respuesta: Mapped[str | None] = mapped_column(Text)
    respondido_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())