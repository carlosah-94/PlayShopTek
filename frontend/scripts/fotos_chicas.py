# Mejora 3: crea una copia "chica" de cada foto para los celulares.
# En el celular una tarjeta del catálogo mide ~170 px de ancho, pero se bajaba la foto de 600 px.
# Uso (desde la carpeta frontend):  python scripts/fotos_chicas.py
# Crea  public/productos/p1-1-chica.webp  (300 px)  y  public/inicio/carrusel-1-chica.webp  (800 px).
from pathlib import Path
from PIL import Image

ANCHOS = {"productos": 300, "inicio": 800}

for carpeta, ancho in ANCHOS.items():
    for foto in sorted(Path("public", carpeta).glob("*.webp")):
        if foto.stem.endswith("-chica"):
            continue
        img = Image.open(foto)
        if img.width > ancho:
            img = img.resize((ancho, round(img.height * ancho / img.width)), Image.LANCZOS)
        destino = foto.with_name(foto.stem + "-chica.webp")
        img.save(destino, "WEBP", quality=72, method=6)
        print(f"{foto.name}: {foto.stat().st_size // 1024} KB -> {destino.stat().st_size // 1024} KB")
