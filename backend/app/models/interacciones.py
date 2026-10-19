"""Lo que hace el cliente fuera de comprar: favoritos, avisos, búsquedas y notificaciones."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, func, false
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import OrigenInteres, columna_enum


class Favorito(Base):
    """Lista de deseados del cliente (un producto por fila)."""
    __tablename__ = "favoritos"

    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id", ondelete="CASCADE"), primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id", ondelete="CASCADE"), primary_key=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GrupoInteres(Base):
    """Agrupa búsquedas parecidas: 'gta 6', 'gta vi' y 'grand theft auto 6' = GTA VI.

    Si lo buscado existe en el catálogo (aunque esté agotado), se enlaza al producto.
    Hoy los grupos se arman con reglas; más adelante los propondrá el modelo
    de agrupamiento (K-Means / DBSCAN).
    """
    __tablename__ = "grupos_interes"

    clave: Mapped[str] = mapped_column(String(60), primary_key=True)  # 'gta6'
    nombre: Mapped[str] = mapped_column(String(120))                   # 'GTA VI'
    producto_id: Mapped[int | None] = mapped_column(ForeignKey("productos.id", ondelete="SET NULL"))


class Interes(Base):
    """Cada búsqueda o pedido al asistente. Alimenta 'lo más buscado que no tenemos'."""
    __tablename__ = "intereses"

    id: Mapped[int] = mapped_column(primary_key=True)
    texto: Mapped[str] = mapped_column(String(160))  # lo que escribió: 'gta vi'
    origen: Mapped[OrigenInteres] = mapped_column(columna_enum(OrigenInteres, "origen_interes"), index=True)
    grupo_clave: Mapped[str | None] = mapped_column(ForeignKey("grupos_interes.clave"), index=True)
    cliente_id: Mapped[int | None] = mapped_column(ForeignKey("clientes.id", ondelete="SET NULL"))  # nulo = visitante
    tuvo_resultados: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())  # lo que vio ESE día
    fecha: Mapped[date] = mapped_column(Date, index=True)


class AvisoLlegada(Base):
    """Botón 'Avísame cuando llegue': de un producto agotado o de algo que no vendemos."""
    __tablename__ = "avisos_llegada"

    id: Mapped[int] = mapped_column(primary_key=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id", ondelete="CASCADE"), index=True)
    grupo_clave: Mapped[str] = mapped_column(ForeignKey("grupos_interes.clave"), index=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    avisado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # cuando llegó y se notificó


class Notificacion(Base):
    """Campanita del cliente: 'Tu PC está lista', 'Bajó de precio...'."""
    __tablename__ = "notificaciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id", ondelete="CASCADE"), index=True)
    titulo: Mapped[str] = mapped_column(String(160))
    detalle: Mapped[str | None] = mapped_column(String(200))
    destino: Mapped[str | None] = mapped_column(String(60))  # pantalla que abre al tocarla
    leida: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    creada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())