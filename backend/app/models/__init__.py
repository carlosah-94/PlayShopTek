"""Importa todos los modelos para que Alembic los vea.

Cada archivo de esta carpeta es un grupo de tablas. Al importarlos aquí,
Alembic los encuentra todos de una sola vez.
"""
from app.models.catalogo import (  # noqa: F401
    Banner, Categoria, Condicion, Genero, Oferta, Producto, ProductoEtiqueta, ProductoMedio, ProductoModo,
)
from app.models.confianza import Reclamo, Resena  # noqa: F401
from app.models.ia import ChatbotMensaje  # noqa: F401
from app.models.interacciones import AvisoLlegada, Favorito, GrupoInteres, Interes, Notificacion  # noqa: F401
from app.models.personas import Cliente, Empleado, PreferenciaCliente, Usuario  # noqa: F401
from app.models.taller import (  # noqa: F401
    CategoriaFalla, Cita, CitaMensaje, Reparacion, ReparacionHistorial, TipoServicio,
)
from app.models.ventas import Venta, VentaItem  # noqa: F401


def _agregar_checks_de_listas() -> None:
    """Cada columna de lista cerrada (rol, estado, canal...) recibe un CHECK en la base,
    así PostgreSQL rechaza cualquier valor que no esté en la lista."""
    from sqlalchemy import CheckConstraint, Enum

    from app.database import Base

    for tabla in Base.metadata.tables.values():
        for col in list(tabla.columns):
            if isinstance(col.type, Enum) and not col.type.native_enum:
                valores = ", ".join(f"'{v}'" for v in col.type.enums)
                tabla.append_constraint(CheckConstraint(f"{col.name} IN ({valores})", name=f"{col.name}_valido"))


_agregar_checks_de_listas()