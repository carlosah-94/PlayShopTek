"""Ventas web, en tienda y por WhatsApp (mismo registro, distinto canal)."""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, String, func, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import Canal, EstadoVenta, MetodoPago, TipoEntrega, columna_enum


class Venta(Base):
    """Compra de un cliente: web, en tienda o por WhatsApp, con su método de pago y estado."""
    __tablename__ = "ventas"
    __table_args__ = (
        CheckConstraint("total >= 0", name="total_positivo"),
        # Web: Yape o tarjeta. WhatsApp: Yape. En tienda: efectivo, Yape o transferencia BCP.
        CheckConstraint(
            "(canal = 'web' AND metodo_pago IN ('yape','tarjeta')) OR "
            "(canal = 'whatsapp' AND metodo_pago = 'yape') OR "
            "(canal = 'tienda' AND metodo_pago IN ('efectivo','yape','transferencia'))",
            name="metodo_segun_canal",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True)  # 'V-1088'
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), index=True)
    canal: Mapped[Canal] = mapped_column(columna_enum(Canal, "canal"), default=Canal.web, server_default="web", index=True)
    metodo_pago: Mapped[MetodoPago] = mapped_column(columna_enum(MetodoPago, "metodo_pago"))
    numero_operacion: Mapped[str | None] = mapped_column(String(20))  # operación de Yape. NUNCA datos de tarjeta.
    entrega: Mapped[TipoEntrega] = mapped_column(
        columna_enum(TipoEntrega, "tipo_entrega"), default=TipoEntrega.recojo_tienda, server_default="recojo_tienda"
    )
    estado: Mapped[EstadoVenta] = mapped_column(columna_enum(EstadoVenta, "estado_venta"), index=True)
    # Total cobrado. Es la suma de sus líneas: se guarda como registro de lo pagado (redundancia controlada).
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    fecha: Mapped[date] = mapped_column(Date, index=True)
    estado_cambiado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    registrada_por_id: Mapped[int | None] = mapped_column(ForeignKey("empleados.usuario_id"))  # venta manual

    # Reseña con código para quien compró en tienda / WhatsApp sin cuenta
    codigo_resena: Mapped[str | None] = mapped_column(String(12), unique=True)  # 'RES-4821'
    enlace_resena_enviado: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["VentaItem"]] = relationship(back_populates="venta", cascade="all, delete-orphan")


class VentaItem(Base):
    """Cada producto de la venta.

    Guarda nombre, precio y si era preventa TAL COMO ERAN ese día: si mañana cambia
    el precio, la boleta antigua no cambia. Es una copia histórica a propósito.
    """
    __tablename__ = "venta_items"
    __table_args__ = (CheckConstraint("cantidad > 0", name="cantidad_positiva"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    venta_id: Mapped[int] = mapped_column(ForeignKey("ventas.id", ondelete="CASCADE"), index=True)
    producto_id: Mapped[int | None] = mapped_column(ForeignKey("productos.id", ondelete="SET NULL"), index=True)
    nombre_producto: Mapped[str] = mapped_column(String(160))
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    cantidad: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    es_preventa: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    venta: Mapped[Venta] = relationship(back_populates="items")