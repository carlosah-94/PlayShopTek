"""Catálogo: categorías, géneros, productos, ofertas, preventas y banners."""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    false, true, Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, LargeBinary, Numeric,
    SmallInteger, String, Table, Text, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import GrupoCondicion, ModoJuego, TipoMedio, columna_enum

producto_generos = Table(
    "producto_generos",
    Base.metadata,
    Column("producto_id", ForeignKey("productos.id", ondelete="CASCADE"), primary_key=True),
    Column("genero_id", ForeignKey("generos.id", ondelete="CASCADE"), primary_key=True),
)


class Categoria(Base):
    """PS2, PS3, PS4, PS5 (juegos), Máquinas, Mandos, PC y periféricos."""
    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(40), unique=True)
    es_juego: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    orden: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")


class Genero(Base):
    """Acción, Deportes, Terror... El dueño puede agregar nuevos."""
    __tablename__ = "generos"

    id: Mapped[str] = mapped_column(String(30), primary_key=True)  # 'accion'
    nombre: Mapped[str] = mapped_column(String(40))                # 'Acción'


class Condicion(Base):
    """Estado del producto que ve el cliente ('Usado, buen estado') y su grupo para el filtro.

    Va en tabla propia porque el grupo depende del texto, no del producto (3FN):
    'Usado, buen estado' siempre es 'usado'.
    """
    __tablename__ = "condiciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(60), unique=True)
    grupo: Mapped[GrupoCondicion] = mapped_column(columna_enum(GrupoCondicion, "grupo_condicion"), index=True)


class Producto(Base):
    """Productos de la tienda: juegos, consolas, mandos y periféricos de PC, con precio, stock y preventa."""
    __tablename__ = "productos"
    __table_args__ = (
        CheckConstraint("precio >= 0", name="precio_positivo"),
        CheckConstraint("stock >= 0", name="stock_positivo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True)  # 'p1' en el prototipo
    nombre: Mapped[str] = mapped_column(String(160), index=True)
    categoria_id: Mapped[int] = mapped_column(ForeignKey("categorias.id"), index=True)
    subcategoria: Mapped[str | None] = mapped_column(String(40))  # PC: Teclados, Mouse, Monitores...
    plataforma: Mapped[str | None] = mapped_column(String(10))    # PS5, PS4, PS3, PS2, PC
    descripcion: Mapped[str | None] = mapped_column(Text)
    precio: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    stock: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    umbral_stock_bajo: Mapped[int] = mapped_column(SmallInteger, default=2, server_default="2")

    condicion_id: Mapped[int] = mapped_column(ForeignKey("condiciones.id"), index=True)
    # Juegos: qué incluye
    incluye_caja: Mapped[bool | None] = mapped_column(Boolean)
    incluye_manual: Mapped[bool | None] = mapped_column(Boolean)
    incluye_disco: Mapped[bool | None] = mapped_column(Boolean)
    # Mandos
    color: Mapped[str | None] = mapped_column(String(30))
    origen: Mapped[str | None] = mapped_column(String(20))  # Original / Genérico

    trailer_url: Mapped[str | None] = mapped_column(String(300))
    # La calificación NO se guarda: se calcula con el promedio de sus reseñas.

    # Preventa: sin fecha = "por confirmar"
    es_preventa: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    fecha_lanzamiento: Mapped[date | None] = mapped_column(Date)
    monto_reserva: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    stock_lanzamiento: Mapped[int | None] = mapped_column(Integer)

    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())  # "quitar del catálogo" sin borrar historial
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    categoria: Mapped[Categoria] = relationship()
    condicion: Mapped[Condicion] = relationship()
    generos: Mapped[list[Genero]] = relationship(secondary=producto_generos)
    etiquetas: Mapped[list["ProductoEtiqueta"]] = relationship(cascade="all, delete-orphan")
    modos: Mapped[list["ProductoModo"]] = relationship(cascade="all, delete-orphan")
    medios: Mapped[list["ProductoMedio"]] = relationship(
        cascade="all, delete-orphan", order_by="ProductoMedio.orden"
    )
    ofertas: Mapped[list["Oferta"]] = relationship(back_populates="producto", cascade="all, delete-orphan")


class ProductoEtiqueta(Base):
    """Etiquetas libres para 'juegos parecidos' (souls, mundo abierto, fútbol...)."""
    __tablename__ = "producto_etiquetas"

    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id", ondelete="CASCADE"), primary_key=True)
    etiqueta: Mapped[str] = mapped_column(String(40), primary_key=True)


class ProductoModo(Base):
    """Modo de juego: un jugador, multijugador local, en línea."""
    __tablename__ = "producto_modos"

    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id", ondelete="CASCADE"), primary_key=True)
    modo: Mapped[ModoJuego] = mapped_column(columna_enum(ModoJuego, "modo_juego"), primary_key=True)


class ProductoMedio(Base):
    """Galería de la ficha: hasta 4 fotos o videos."""
    __tablename__ = "producto_medios"
    __table_args__ = (UniqueConstraint("producto_id", "orden"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[TipoMedio] = mapped_column(columna_enum(TipoMedio, "tipo_medio"), default=TipoMedio.imagen, server_default="imagen")
    url: Mapped[str] = mapped_column(String(400))
    orden: Mapped[int] = mapped_column(SmallInteger, default=1, server_default="1")


class Oferta(Base):
    """Descuento por días. Se guarda el historial para medir qué ofertas venden más."""
    __tablename__ = "ofertas"
    __table_args__ = (
        CheckConstraint("porcentaje > 0 AND porcentaje < 100", name="porcentaje_rango"),
        CheckConstraint("dias > 0", name="dias_positivos"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id", ondelete="CASCADE"), index=True)
    porcentaje: Mapped[int] = mapped_column(SmallInteger)
    fecha_inicio: Mapped[date] = mapped_column(Date)
    dias: Mapped[int] = mapped_column(SmallInteger)

    producto: Mapped[Producto] = relationship(back_populates="ofertas")


class Banner(Base):
    """Carrusel de la página de inicio, administrable por el dueño."""
    __tablename__ = "banners"

    id: Mapped[int] = mapped_column(primary_key=True)
    titulo: Mapped[str] = mapped_column(String(120))
    subtitulo: Mapped[str | None] = mapped_column(String(200))
    destino: Mapped[str | None] = mapped_column(String(60))  # 'ofertas', 'reparaciones', 'Máquinas'
    imagen_url: Mapped[str | None] = mapped_column(String(400))
    imagen_movil_url: Mapped[str | None] = mapped_column(String(400))  # HU-24: versión cuadrada para celular (opcional)
    texto_alternativo: Mapped[str | None] = mapped_column(String(160))
    # HU-24: 'carrusel' (diapositiva) o 'cuadro_ofertas' / 'cuadro_reparaciones' (los dos cuadros junto al carrusel)
    ubicacion: Mapped[str] = mapped_column(String(20), default="carrusel", server_default="carrusel")
    con_texto: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())  # "Imagen con texto" o "Solo imagen"
    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    orden: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")

class Imagen(Base):
    """HU-24: foto que sube Ángel (producto o banner). Se guarda en la base de datos porque el servidor
    gratuito de Render borra los archivos en cada despliegue. El navegador la pide en /api/imagenes/{id}."""
    __tablename__ = "imagenes"

    id: Mapped[int] = mapped_column(primary_key=True)
    mime: Mapped[str] = mapped_column(String(40))  # 'image/webp'
    datos: Mapped[bytes] = mapped_column(LargeBinary)
    creada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
