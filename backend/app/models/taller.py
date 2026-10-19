"""Taller: servicios técnicos, fallas, reparaciones, historial de estados y citas."""
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, Time, func, false, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import AutorMensaje, EstadoReparacion, PagoReparacion, columna_enum


class TipoServicio(Base):
    """Servicios técnicos que ofrece la tienda (Reparación de mandos, Mantenimiento...)."""
    __tablename__ = "tipos_servicio"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80), unique=True)
    detalle: Mapped[str | None] = mapped_column(String(200))
    precio_desde: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    tiempo_estimado: Mapped[str | None] = mapped_column(String(40))  # '30 a 45 min en tienda'
    icono: Mapped[str | None] = mapped_column(String(40))
    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())


class CategoriaFalla(Base):
    """Fallas frecuentes: Drift de stick, Batería, Sobrecalentamiento... (tablero e IA)."""
    __tablename__ = "categorias_falla"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(40), unique=True)


class Reparacion(Base):
    """Equipo recibido en el taller, con su falla, diagnóstico, costo, técnico y estado."""
    __tablename__ = "reparaciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True)  # el cliente rastrea con esto
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), index=True)
    tipo_servicio_id: Mapped[int | None] = mapped_column(ForeignKey("tipos_servicio.id"), index=True)
    categoria_falla_id: Mapped[int | None] = mapped_column(ForeignKey("categorias_falla.id"), index=True)
    equipo: Mapped[str] = mapped_column(String(80))   # 'Mando DualShock 4'
    falla: Mapped[str] = mapped_column(String(200))   # lo que cuenta el cliente, con sus palabras
    diagnostico: Mapped[str | None] = mapped_column(String(200))
    costo: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, server_default="0")
    precio_acordado: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())  # nunca se cobra sin aprobación
    # Estado actual. El historial completo está en reparacion_historial (redundancia controlada para consultar rápido).
    estado: Mapped[EstadoReparacion] = mapped_column(
        columna_enum(EstadoReparacion, "estado_reparacion"), default=EstadoReparacion.recibido, server_default="recibido", index=True
    )
    pago: Mapped[PagoReparacion] = mapped_column(
        columna_enum(PagoReparacion, "pago_reparacion"), default=PagoReparacion.pendiente, server_default="pendiente"
    )
    duracion_estimada: Mapped[str | None] = mapped_column(String(30))
    tecnico_id: Mapped[int | None] = mapped_column(ForeignKey("empleados.usuario_id"))  # Ángel o Linda
    fecha_ingreso: Mapped[date] = mapped_column(Date, index=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tipo_servicio: Mapped[TipoServicio | None] = relationship()
    categoria_falla: Mapped[CategoriaFalla | None] = relationship()
    historial: Mapped[list["ReparacionHistorial"]] = relationship(
        back_populates="reparacion", cascade="all, delete-orphan", order_by="ReparacionHistorial.cambiado_en"
    )


class ReparacionHistorial(Base):
    """Cada cambio de estado: alimenta la línea de tiempo que ve el cliente."""
    __tablename__ = "reparacion_historial"

    id: Mapped[int] = mapped_column(primary_key=True)
    reparacion_id: Mapped[int] = mapped_column(ForeignKey("reparaciones.id", ondelete="CASCADE"), index=True)
    estado: Mapped[EstadoReparacion] = mapped_column(columna_enum(EstadoReparacion, "estado_reparacion_hist"))
    cambiado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    cambiado_por_id: Mapped[int | None] = mapped_column(ForeignKey("empleados.usuario_id"))
    aviso_whatsapp: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    reparacion: Mapped[Reparacion] = relationship(back_populates="historial")


class Cita(Base):
    """Cita agendada por el cliente desde la web, con su chat de diagnóstico."""
    __tablename__ = "citas"

    id: Mapped[int] = mapped_column(primary_key=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), index=True)
    tipo_servicio_id: Mapped[int | None] = mapped_column(ForeignKey("tipos_servicio.id"))
    equipo: Mapped[str] = mapped_column(String(80))
    falla: Mapped[str] = mapped_column(String(200))
    notas: Mapped[str | None] = mapped_column(Text)
    fecha: Mapped[date] = mapped_column(Date, index=True)
    hora: Mapped[time] = mapped_column(Time)
    precio: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, server_default="0")
    precio_acordado: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    reparacion_id: Mapped[int | None] = mapped_column(ForeignKey("reparaciones.id"), unique=True)  # al recibir el equipo
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    mensajes: Mapped[list["CitaMensaje"]] = relationship(
        back_populates="cita", cascade="all, delete-orphan", order_by="CitaMensaje.enviado_en"
    )


class CitaMensaje(Base):
    """Mensajes del chat de una cita entre el cliente y la tienda."""
    __tablename__ = "cita_mensajes"

    id: Mapped[int] = mapped_column(primary_key=True)
    cita_id: Mapped[int] = mapped_column(ForeignKey("citas.id", ondelete="CASCADE"), index=True)
    autor: Mapped[AutorMensaje] = mapped_column(columna_enum(AutorMensaje, "autor_mensaje"))
    texto: Mapped[str] = mapped_column(Text)
    enviado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    leido: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    cita: Mapped[Cita] = relationship(back_populates="mensajes")