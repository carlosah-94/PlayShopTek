"""Formatos de entrada y salida de la API (lo que viaja en JSON)."""
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import EstadoReparacion, EstadoVenta, GrupoCondicion, MetodoPago, ModoJuego, PagoReparacion, Rol


class LoginEntrada(BaseModel):
    email: EmailStr
    password: str


class RegistroEntrada(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    email: EmailStr
    telefono: str | None = Field(default=None, pattern=r"^9\d{8}$")
    password: str = Field(min_length=6)


class UsuarioSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    email: str
    rol: Rol


class TokenSalida(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioSalida


class ProductoSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    codigo: str
    nombre: str
    categoria: str
    plataforma: str | None
    precio: Decimal
    precio_final: Decimal
    descuento: int | None
    stock: int
    condicion: str | None
    grupo_condicion: GrupoCondicion
    generos: list[str]
    es_preventa: bool
    fecha_lanzamiento: date | None
    calificacion: Decimal | None
    trailer_url: str | None
    foto: str | None = None  # HU-21: foto principal para la tarjeta del catálogo
    oferta_termina: datetime | None = None  # HU-23: cuándo termina la oferta (para el contador)
    # HU-25: para los filtros del catálogo y la línea "Nuevo, sellado · caja, disco" de la tarjeta
    subcategoria: str | None = None
    origen: str | None = None
    incluye: str | None = None


class ResenaSalida(BaseModel):
    id: int | None = None
    nombre: str
    estrellas: int
    texto: str
    fecha: date
    respuesta: str | None
    verificada: bool = False  # HU-17: la escribió alguien que compró el producto


class ServicioInicio(BaseModel):
    """HU-22: un servicio del taller con su tiempo, para la página de inicio."""
    nombre: str
    tiempo: str | None
    icono: str | None


class ResenaInicio(BaseModel):
    """HU-22: reseña destacada de la página de inicio, con el producto o servicio del que habla."""
    nombre: str
    estrellas: int
    texto: str
    sobre: str


class InicioSalida(BaseModel):
    recomendados: list[ProductoSalida]
    personalizado: bool  # True si los recomendados se basan en las compras del cliente
    servicios: list[ServicioInicio]
    resenas: list[ResenaInicio]


class ResenaEquipo(ResenaSalida):
    """HU-24: reseña vista desde el panel, con el producto o servicio del que habla."""
    sobre: str
    es_producto: bool
    destacada: bool = False
    origen: str = "web"  # web, tienda o whatsapp


class ResenaEntrada(BaseModel):
    """HU-17: lo que manda el cliente para opinar de un producto que compró."""
    estrellas: int = Field(ge=1, le=5)
    texto: str = Field(min_length=10, max_length=600)
    nombre_publico: str | None = Field(default=None, max_length=60)  # si no lo pone, se usa su nombre de pila


class RespuestaResena(BaseModel):
    respuesta: str = Field(min_length=5, max_length=600)


class PuedoOpinar(BaseModel):
    puede: bool
    motivo: Literal["no_compraste", "ya_opinaste"] | None = None


class ProductoDetalle(ProductoSalida):
    """HU-02: lo mismo del catálogo + lo que solo se ve en la ficha."""
    descripcion: str | None
    incluye_caja: bool | None
    incluye_manual: bool | None
    incluye_disco: bool | None
    color: str | None
    etiquetas: list[str]
    modos: list[ModoJuego]
    fotos: list[str]
    monto_reserva: Decimal | None
    cupos_reserva: int | None  # HU-04: cuántas reservas quedan antes del lanzamiento
    total_resenas: int
    estrellas: list[int] = []  # HU-25: cuántas reseñas de 5, 4, 3, 2 y 1 estrellas (para las barras)
    resenas: list[ResenaSalida]


class ProductoEdicion(BaseModel):
    """Solo el dueño cambia precio; el stock también lo maneja él desde Inventario."""
    precio: Decimal | None = Field(default=None, ge=0)
    stock: int | None = Field(default=None, ge=0)
    trailer_url: str | None = Field(default=None, max_length=300)


class Opcion(BaseModel):
    id: int
    nombre: str
    precio_desde: Decimal | None = None


class OpcionesTaller(BaseModel):
    servicios: list[Opcion]
    fallas: list[Opcion]


class ReparacionEntrada(BaseModel):
    """HU-06: lo que la trabajadora llena al recibir un equipo en el mostrador."""
    cliente_nombre: str = Field(min_length=2, max_length=120)
    cliente_telefono: str = Field(pattern=r"^9\d{8}$")
    equipo: str = Field(min_length=2, max_length=80)
    falla: str = Field(min_length=3, max_length=200)
    tipo_servicio_id: int | None = None
    categoria_falla_id: int | None = None
    diagnostico: str | None = Field(default=None, max_length=200)
    costo: Decimal = Field(default=Decimal(0), ge=0)
    precio_acordado: bool = False
    duracion_estimada: str | None = Field(default=None, max_length=30)


class ReparacionSalida(BaseModel):
    id: int
    codigo: str
    cliente: str
    telefono: str | None
    equipo: str
    falla: str
    servicio: str | None
    diagnostico: str | None
    costo: Decimal
    precio_acordado: bool
    estado: EstadoReparacion
    pago: PagoReparacion
    tecnico: str | None
    fecha_ingreso: date


class PasoHistorial(BaseModel):
    estado: EstadoReparacion
    fecha: datetime


class RastreoSalida(BaseModel):
    """HU-07: lo que el cliente ve de su reparación (sin datos personales de más)."""
    codigo: str
    cliente: str  # solo el primer nombre
    equipo: str
    falla: str
    servicio: str | None
    estado: EstadoReparacion
    costo: Decimal
    precio_acordado: bool
    duracion_estimada: str | None
    fecha_ingreso: date
    historial: list[PasoHistorial]


class CambioEstado(BaseModel):
    """HU-08: avanzar la reparación al siguiente paso."""
    estado: EstadoReparacion
    precio_acordado: bool | None = None  # se marca cuando el cliente acepta el precio
    pago: PagoReparacion | None = None   # obligatorio al entregar


class ItemCarrito(BaseModel):
    producto_id: int
    cantidad: int = Field(ge=1, le=5)  # máximo 5 unidades por producto en una compra web


class CompraEntrada(BaseModel):
    """HU-03: el carrito que manda el cliente. Los precios NO vienen del navegador: los calcula el servidor."""
    items: list[ItemCarrito] = Field(min_length=1)
    metodo_pago: Literal["yape", "tarjeta"]  # en la web solo Yape o tarjeta (regla del dueño)
    numero_operacion: str | None = Field(default=None, pattern=r"^\d{6,12}$")  # el número que muestra Yape al pagar


class VentaItemSalida(BaseModel):
    nombre: str
    cantidad: int
    precio_unitario: Decimal


class VentaSalida(BaseModel):
    codigo: str
    fecha: date
    estado: EstadoVenta
    metodo_pago: MetodoPago
    total: Decimal
    items: list[VentaItemSalida]


class VentaTiendaEntrada(BaseModel):
    """HU-15: venta que registra Linda o Ángel en el mostrador o por WhatsApp."""
    canal: Literal["tienda", "whatsapp"]
    metodo_pago: Literal["efectivo", "yape", "transferencia"]  # por WhatsApp solo Yape (se revisa en la ruta)
    items: list[ItemCarrito] = Field(min_length=1)
    cliente_nombre: str | None = Field(default=None, max_length=120)
    cliente_telefono: str | None = Field(default=None, pattern=r"^9\d{8}$")  # opcional: el cliente puede no darlo
    numero_operacion: str | None = Field(default=None, pattern=r"^\d{6,12}$")


class CambioEstadoVenta(BaseModel):
    """HU-24: Linda o Ángel avanzan un pedido (pagado -> listo para recoger -> entregado)."""
    estado: EstadoVenta


class VentaTiendaSalida(VentaSalida):
    canal: str
    cliente: str
    registrada_por: str | None


class Cifra(BaseModel):
    """Un dato con nombre para las listas del tablero (ej. 'Yape': 52)."""
    nombre: str
    valor: Decimal


class Semana(BaseModel):
    semana: date  # lunes de esa semana
    ventas: Decimal
    reparaciones: int


class Buscado(BaseModel):
    nombre: str
    busquedas: int
    avisos: int  # clientes que pidieron "Avísame cuando llegue"
    hay_en_tienda: bool


class TableroSalida(BaseModel):
    """HU-13: los indicadores del negocio que ve Ángel."""
    desde: date
    hasta: date
    ventas_total: Decimal
    ventas_cantidad: int
    ticket_promedio: Decimal
    ventas_por_canal: list[Cifra]
    ventas_por_metodo: list[Cifra]
    mas_vendidos: list[Cifra]
    reparaciones_en_taller: int
    reparaciones_por_semana: Decimal
    fallas_frecuentes: list[Cifra]
    calificacion: Decimal | None
    stock_bajo: int
    mas_buscados: list[Buscado]
    sin_resultado: list[Cifra]  # HU-11: lo que buscaron y no encontraron
    semanas: list[Semana]


class InteresEntrada(BaseModel):
    """HU-11: lo que el cliente buscó y no encontró."""
    texto: str = Field(min_length=2, max_length=80)


class InteresSalida(BaseModel):
    registrado: bool


class NotificacionSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    titulo: str
    detalle: str | None
    destino: str | None
    leida: bool
    creada_en: datetime


class AvisoSalida(BaseModel):
    producto_id: int | None
    nombre: str
    pedido_en: datetime


class ReservaEntrada(BaseModel):
    """HU-04: reservar un juego en preventa pagando solo la reserva (S/ 50)."""
    producto_id: int
    metodo_pago: Literal["yape", "tarjeta"]
    numero_operacion: str | None = Field(default=None, pattern=r"^\d{6,12}$")


class AsistenteEntrada(BaseModel):
    """HU-09: lo que el cliente le escribe al asistente."""
    mensaje: str = Field(min_length=1, max_length=300)
    sesion: str = Field(min_length=8, max_length=40)  # id al azar del navegador para agrupar la conversación
    ultimo_producto_id: int | None = None  # HU-10: el último producto que mostró el chat ("agrégalo")


class AccionAsistente(BaseModel):
    tipo: Literal["ir", "whatsapp", "agregar"]  # ir a una página, abrir WhatsApp o agregar al carrito (HU-10)
    etiqueta: str
    destino: str
    producto_id: int | None = None


class AsistenteSalida(BaseModel):
    intencion: str
    confianza: float
    respuesta: str
    productos: list[ProductoSalida] = []
    acciones: list[AccionAsistente] = []

class ReclamoEntrada(BaseModel):
    """HU-18: hoja del Libro de Reclamaciones (Ley N.º 29571). La llena el cliente desde la web."""
    tipo: Literal["reclamo", "queja"]  # reclamo = el producto o servicio; queja = la atención
    nombre: str = Field(min_length=3, max_length=120)
    correo: EmailStr
    telefono: str | None = Field(default=None, pattern=r"^9\d{8}$")
    documento: str | None = Field(default=None, pattern=r"^\d{8,12}$")  # DNI o carné de extranjería
    domicilio: str | None = Field(default=None, max_length=200)
    bien_contratado: str | None = Field(default=None, max_length=160)  # producto o servicio
    monto_reclamado: Decimal | None = Field(default=None, ge=0)
    detalle: str = Field(min_length=10, max_length=2000)
    pedido_cliente: str | None = Field(default=None, max_length=1000)


class ReclamoSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    codigo: str
    tipo: str
    nombre: str
    correo: str
    telefono: str | None
    bien_contratado: str | None
    monto_reclamado: Decimal | None
    detalle: str
    pedido_cliente: str | None
    estado: str
    fecha: date
    fecha_limite: date | None
    respuesta: str | None


class RespuestaReclamo(BaseModel):
    respuesta: str = Field(min_length=10, max_length=2000)

# ── HU-24: panel de gestión del dueño ───────────────────────────────────────────────
class ImagenEntrada(BaseModel):
    """Foto que sube Ángel, ya achicada en el navegador: 'data:image/webp;base64,...' (máximo ~1.5 MB)."""
    datos: str = Field(max_length=2_000_000)


class ImagenSalida(BaseModel):
    url: str  # /api/imagenes/15


class BannerEntrada(BaseModel):
    titulo: str = Field(min_length=2, max_length=120)
    subtitulo: str | None = Field(default=None, max_length=200)
    destino: str | None = Field(default=None, max_length=60)
    imagen_url: str | None = Field(default=None, max_length=400)
    imagen_movil_url: str | None = Field(default=None, max_length=400)
    texto_alternativo: str | None = Field(default=None, max_length=160)
    ubicacion: Literal["carrusel", "cuadro_ofertas", "cuadro_reparaciones"] = "carrusel"
    con_texto: bool = True
    activo: bool = True
    orden: int = 0


class BannerSalida(BannerEntrada):
    model_config = ConfigDict(from_attributes=True)
    id: int


class TrabajadorEntrada(BaseModel):
    nombre: str = Field(min_length=3, max_length=120)
    email: EmailStr
    telefono: str | None = Field(default=None, pattern=r"^9\d{8}$")


class TrabajadorSalida(BaseModel):
    usuario_id: int
    nombre: str
    email: str
    telefono: str | None
    rol: Rol
    activo: bool
    fecha_ingreso: date | None
    reparaciones_atendidas: int
    clave_temporal: str | None = None  # solo al crear la cuenta o restablecer la contraseña


class CambioActivo(BaseModel):
    activo: bool


class ServicioEntrada(BaseModel):
    nombre: str = Field(min_length=3, max_length=80)
    detalle: str | None = Field(default=None, max_length=200)
    tiempo: str | None = Field(default=None, max_length=40)


class ServicioSalida(ServicioEntrada):
    id: int
    activo: bool
    icono: str | None


class GeneroEntrada(BaseModel):
    nombre: str = Field(min_length=3, max_length=40)


class GeneroSalida(BaseModel):
    id: str
    nombre: str
    juegos: int


class ProductoAlta(BaseModel):
    """HU-24: "Dar de alta un producto" (y editarlo). Según la categoría se llenan unos campos u otros."""
    nombre: str = Field(min_length=3, max_length=160)
    categoria: str
    precio: Decimal = Field(gt=0)
    stock: int = Field(ge=0)
    condicion: str
    plataforma: str | None = Field(default=None, max_length=10)
    subcategoria: str | None = Field(default=None, max_length=40)
    color: str | None = Field(default=None, max_length=30)
    origen: str | None = Field(default=None, max_length=20)
    generos: list[str] = []
    modos: list[ModoJuego] = []
    etiquetas: list[str] = Field(default=[], max_length=12)
    incluye_caja: bool | None = None
    incluye_manual: bool | None = None
    incluye_disco: bool | None = None
    descripcion: str | None = Field(default=None, max_length=2000)
    es_preventa: bool = False
    monto_reserva: Decimal | None = Field(default=None, ge=0)
    fecha_lanzamiento: date | None = None
    descuento: int | None = Field(default=None, ge=1, le=90)
    descuento_dias: int | None = Field(default=None, ge=1, le=60)
    fotos: list[str] = Field(default=[], max_length=4)
    trailer_url: str | None = Field(default=None, max_length=300)
