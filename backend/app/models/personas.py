"""Personas: cuentas de acceso, empleados de la tienda y clientes.

Se separan en 3 tablas para no repetir datos (3FN):
- usuarios: solo lo necesario para iniciar sesión (correo, contraseña, rol).
- empleados: datos del personal (Ángel y Linda), unidos 1 a 1 con su usuario.
- clientes: datos de cada cliente. Puede tener cuenta web (usuario_id) o no
  tenerla, como quien compra en la tienda o por WhatsApp y solo deja su celular.
"""
from datetime import date, datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, String, Table, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import ModoJuego, Rol, columna_enum

# Géneros que el cliente marcó en la encuesta (muchos a muchos)
preferencia_generos = Table(
    "preferencia_generos",
    Base.metadata,
    Column("cliente_id", ForeignKey("preferencias_cliente.cliente_id", ondelete="CASCADE"), primary_key=True),
    Column("genero_id", ForeignKey("generos.id", ondelete="CASCADE"), primary_key=True),
)


class Usuario(Base):
    """Cuenta para iniciar sesión. El rol decide qué puede ver cada uno."""
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(160), unique=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    rol: Mapped[Rol] = mapped_column(columna_enum(Rol, "rol"), default=Rol.cliente, server_default="cliente", index=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())  # "Mi equipo": activar/desactivar
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    empleado: Mapped["Empleado | None"] = relationship(back_populates="usuario", uselist=False)
    cliente: Mapped["Cliente | None"] = relationship(back_populates="usuario", uselist=False)

    @property
    def nombre(self) -> str:
        persona = self.empleado or self.cliente
        return persona.nombre if persona else self.email


class Empleado(Base):
    """Personal de la tienda: el dueño y la trabajadora."""
    __tablename__ = "empleados"

    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    telefono: Mapped[str | None] = mapped_column(String(15))
    fecha_ingreso: Mapped[date | None] = mapped_column(Date)

    usuario: Mapped[Usuario] = relationship(back_populates="empleado")


class Cliente(Base):
    """Cliente de la tienda, con o sin cuenta web.

    El celular identifica al cliente que compra en tienda: si coincide con
    alguien que tiene cuenta, su compra aparece en "Mis compras".
    """
    __tablename__ = "clientes"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"), unique=True)
    nombre: Mapped[str] = mapped_column(String(120))
    telefono: Mapped[str | None] = mapped_column(String(15), unique=True)  # 9 dígitos
    correo_contacto: Mapped[str | None] = mapped_column(String(160))  # solo si NO tiene cuenta
    distrito: Mapped[str | None] = mapped_column(String(80))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    usuario: Mapped[Usuario | None] = relationship(back_populates="cliente")
    preferencias: Mapped["PreferenciaCliente | None"] = relationship(back_populates="cliente", uselist=False)


class PreferenciaCliente(Base):
    """Encuesta de gustos que el cliente llena después de registrarse."""
    __tablename__ = "preferencias_cliente"

    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id", ondelete="CASCADE"), primary_key=True)
    consola: Mapped[str | None] = mapped_column(String(10))  # PS5, PS4, PS3, PS2, PC
    modo_juego: Mapped[ModoJuego | None] = mapped_column(columna_enum(ModoJuego, "modo_juego_pref"))
    completada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    cliente: Mapped[Cliente] = relationship(back_populates="preferencias")
    generos: Mapped[list["Genero"]] = relationship(secondary=preferencia_generos)  # noqa: F821