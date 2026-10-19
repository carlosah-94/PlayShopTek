"""Registro del asistente (chatbot). Sirve para entrenar y medir el modelo de clasificación."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, func, false
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ChatbotMensaje(Base):
    """Cada mensaje del cliente al asistente, con la intención que detectó el modelo.

    Nunca se guardan datos de pago aquí.
    """
    __tablename__ = "chatbot_mensajes"

    id: Mapped[int] = mapped_column(primary_key=True)
    sesion: Mapped[str] = mapped_column(String(40), index=True)
    cliente_id: Mapped[int | None] = mapped_column(ForeignKey("clientes.id", ondelete="SET NULL"))
    texto: Mapped[str] = mapped_column(Text)
    intencion: Mapped[str | None] = mapped_column(String(40), index=True)  # 'ver_producto', 'agregar_carrito'...
    confianza: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))       # 0.000 a 1.000
    derivado_whatsapp: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())  # si no estaba seguro
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())