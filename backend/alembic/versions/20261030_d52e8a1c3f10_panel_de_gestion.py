"""HU-24: panel de gestión del dueño.

- Tabla imagenes: fotos que sube Ángel (productos y banners), guardadas en la base de datos.
- resenas.destacada: reseñas que Ángel elige para el inicio.
- banners: versión para celular, ubicación (carrusel o uno de los dos cuadros) y "con texto".
- Los banners de ejemplo pasan a usar las fotos de la tienda (las mismas del inicio de la HU-22).
  Solo se cambian si la base ya tiene datos; en una base nueva los carga el seed.

Revision ID: d52e8a1c3f10
Revises: c41f0a2b9d77
Create Date: 2026-10-30
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d52e8a1c3f10"
down_revision: Union[str, Sequence[str], None] = "c41f0a2b9d77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (título, texto, destino, foto, texto alternativo, ubicación, orden)
BANNERS = [
    ("PlayStation 5 nuevas y selladas", "Con boleta y garantía. Te ayudamos a configurarla.", "Máquinas",
     "/inicio/carrusel-1.webp", "Dos consolas PlayStation 5 con sus mandos", "carrusel", 1),
    ("Visítanos en Villa El Salvador", "Av. Revolución 1420 · Lunes a sábado 12:00–20:00", "tienda",
     "/inicio/carrusel-2.webp", "Fachada de la tienda Play Shop Tek en Villa El Salvador", "carrusel", 2),
    ("Juegos para PS2, PS3, PS4 y PS5", "Nuevos, usados y packs. Pruébalos en la tienda antes de llevarlos.", "catalogo",
     "/inicio/carrusel-3.webp", "Vitrina de la tienda con juegos y una PS4 en caja", "carrusel", 3),
    ("Juegos físicos para tu colección", "Sepáralos por la web y recógelos el mismo día.", "PS5",
     "/inicio/carrusel-4.webp", "PlayStation 5 Slim con un juego en disco y un mando", "carrusel", 4),
    ("Ofertas por tiempo limitado", "Precios rebajados por pocos días", "ofertas",
     "/inicio/banner-ofertas.webp", "", "cuadro_ofertas", 1),
    ("¿Se malogró tu mando?", "Cotiza la reparación por WhatsApp", "reparaciones",
     "/inicio/banner-servicio.webp", "", "cuadro_reparaciones", 2),
]


def upgrade() -> None:
    op.create_table(
        "imagenes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("mime", sa.String(40), nullable=False),
        sa.Column("datos", sa.LargeBinary(), nullable=False),
        sa.Column("creada_en", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.add_column("resenas", sa.Column("destacada", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("banners", sa.Column("imagen_movil_url", sa.String(400), nullable=True))
    op.add_column("banners", sa.Column("ubicacion", sa.String(20), server_default="carrusel", nullable=False))
    op.add_column("banners", sa.Column("con_texto", sa.Boolean(), server_default=sa.true(), nullable=False))

    hay_datos = op.get_bind().execute(sa.text("SELECT EXISTS (SELECT 1 FROM usuarios)")).scalar()
    if hay_datos:
        op.execute("DELETE FROM banners")
        tabla = sa.table("banners", sa.column("titulo"), sa.column("subtitulo"), sa.column("destino"), sa.column("imagen_url"),
                         sa.column("texto_alternativo"), sa.column("ubicacion"), sa.column("orden"), sa.column("activo"))
        op.bulk_insert(tabla, [dict(titulo=t, subtitulo=s, destino=d, imagen_url=f, texto_alternativo=a, ubicacion=u, orden=o, activo=True)
                               for t, s, d, f, a, u, o in BANNERS])


def downgrade() -> None:
    op.drop_column("banners", "con_texto")
    op.drop_column("banners", "ubicacion")
    op.drop_column("banners", "imagen_movil_url")
    op.drop_column("resenas", "destacada")
    op.drop_table("imagenes")
