"""Listas cerradas de valores (estados, roles, canales...).

Se guardan como texto con una restricción CHECK (native_enum=False):
si mañana se agrega un estado nuevo, basta una migración pequeña.
"""
import enum

from sqlalchemy import Enum as SAEnum


def columna_enum(enum_cls: type[enum.Enum], nombre: str) -> SAEnum:
    return SAEnum(
        enum_cls,
        name=nombre,
        native_enum=False,
        length=30,
        values_callable=lambda e: [m.value for m in e],
        validate_strings=True,
    )


class Rol(str, enum.Enum):
    cliente = "cliente"
    dueno = "dueno"              # Ángel: acceso total
    trabajadora = "trabajadora"  # Linda: taller, stock bajo y reseñas


class GrupoCondicion(str, enum.Enum):
    """Filtro 'Por estado' del catálogo."""
    nuevo = "nuevo"
    usado = "usado"
    reacondicionado = "reacondicionado"


class ModoJuego(str, enum.Enum):
    solo = "solo"      # Un jugador
    local = "local"    # Multijugador local
    online = "online"  # En línea


class TipoMedio(str, enum.Enum):
    imagen = "imagen"
    video = "video"


class Canal(str, enum.Enum):
    web = "web"
    tienda = "tienda"
    whatsapp = "whatsapp"


class MetodoPago(str, enum.Enum):
    """Web: Yape o tarjeta. WhatsApp: Yape. En tienda: efectivo, Yape o transferencia BCP."""
    yape = "yape"
    tarjeta = "tarjeta"
    efectivo = "efectivo"
    transferencia = "transferencia"  # transferencia BCP


class EstadoVenta(str, enum.Enum):
    pagado = "pagado"
    reservado = "reservado"  # preventa
    listo_para_recoger = "listo_para_recoger"
    entregado = "entregado"
    cancelado = "cancelado"


class TipoEntrega(str, enum.Enum):
    recojo_tienda = "recojo_tienda"


class EstadoReparacion(str, enum.Enum):
    recibido = "recibido"
    diagnosticado = "diagnosticado"
    en_reparacion = "en_reparacion"
    listo_para_recoger = "listo_para_recoger"
    entregado = "entregado"


class PagoReparacion(str, enum.Enum):
    """Las reparaciones se cobran en la tienda o por WhatsApp."""
    pendiente = "pendiente"
    yape = "yape"
    efectivo = "efectivo"
    transferencia = "transferencia"  # transferencia BCP


class AutorMensaje(str, enum.Enum):
    cliente = "cliente"
    tienda = "tienda"


class OrigenInteres(str, enum.Enum):
    busqueda = "busqueda"  # buscador de la tienda
    chatbot = "chatbot"    # lo pidió en el asistente


class OrigenResena(str, enum.Enum):
    web = "web"
    tienda = "tienda"      # con código RES-xxxx
    whatsapp = "whatsapp"  # con código RES-xxxx


class TipoReclamo(str, enum.Enum):
    reclamo = "reclamo"  # disconformidad con el producto o servicio
    queja = "queja"      # malestar con la atención


class EstadoReclamo(str, enum.Enum):
    pendiente = "pendiente"
    respondido = "respondido"