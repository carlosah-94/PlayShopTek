"""HU-21: retirar Winning Eleven 10 (PS2) del catálogo.

No se borra la fila: se marca activo = false. Así sus reseñas y ventas antiguas siguen guardadas,
pero el producto ya no sale en el catálogo ni en las recomendaciones.

Revision ID: c41f0a2b9d77
Revises: b23ca434a9eb
Create Date: 2026-10-30
"""
from typing import Sequence, Union

from alembic import op

revision: str = "c41f0a2b9d77"
down_revision: Union[str, Sequence[str], None] = "b23ca434a9eb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE productos SET activo = false WHERE codigo = 'p35'")


def downgrade() -> None:
    op.execute("UPDATE productos SET activo = true WHERE codigo = 'p35'")
