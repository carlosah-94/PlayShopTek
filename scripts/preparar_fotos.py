"""HU-21: prepara las fotos de los productos para la tienda.

Toma la carpeta de fotos de la tienda (una carpeta por producto, ej. "JUEGOS PS5/FIFA 26")
y para cada producto:
  1. Pone primero la foto llamada "1" (1.jpg, 1.webp...): es la principal, la de la tarjeta del catálogo.
     Después van las demás, hasta 4 en total.
  2. Las achica a 600 px como máximo y las guarda en formato webp (pesa poco y se ve bien)
     en frontend/public/productos/p7-1.webp, p7-2.webp...
  3. Escribe backend/app/seed_data/fotos.json: cuántas fotos tiene cada producto.

Uso (desde la carpeta del proyecto):  python scripts/preparar_fotos.py ../imagenes
Necesita Pillow:  pip install pillow
"""
import json
import sys
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "frontend" / "public" / "productos"
LISTA = RAIZ / "backend" / "app" / "seed_data" / "fotos.json"
MAXIMO = 600  # px del lado más largo
POR_PRODUCTO = 4  # la ficha muestra hasta 4 fotos
EXTENSIONES = {".jpg", ".jpeg", ".png", ".webp", ".avif"}

# Carpeta de fotos -> código del producto en la base de datos
CARPETAS = {
    "MAQUINAS/PlayStation 5 slim digital": "p1", "MAQUINAS/PlayStation 5 Pro": "p2",
    "MAQUINAS/PlayStation 4 Pro 1TB": "p25", "MAQUINAS/PlayStation 4 Slim 1TB": "p3",
    "MAQUINAS/PlayStation 3 Super Slim 500GB": "p19", "MAQUINAS/PlayStation 3 Slim 320GB": "p20",
    "MAQUINAS/PlayStation 2 Slim + 2 mandos": "p24",
    "Mandos/Mando DualSense Blanco": "p4", "Mandos/Mando DualSense Midnight Black": "p26",
    "Mandos/Mando DualSense Cosmic Red": "p28", "Mandos/Mando DualSense Edge": "p5",
    "Mandos/Mando DualShock 4 V2 Negro": "p6", "Mandos/Mando inalámbrico PS4 Rojo (genérico)": "p14",
    "Mandos/Mando inalámbrico PS4 Azul (genérico)": "p15", "Mandos/Mando DualShock 3 Inalámbrico": "p21",
    "Mandos/Mando inalámbrico PS3 Negro (genérico)": "p16", "Mandos/Mando PS2 con cable (genérico)": "p27",
    "JUEGOS PS5/FIFA 26": "p7", "JUEGOS PS5/God of war_ragnarok": "p8", "JUEGOS PS5/Gran turismo 7": "p9",
    "JUEGOS PS5/Mortal kombat 1": "p10", "JUEGOS PS5/Spiderman 2": "p11", "JUEGOS PS5/COD black ops 7": "p12",
    "JUEGOS PS5/onimusha": "p50", "JUEGOS PS5/RE 4": "p17",
    "JUEGOS PS4/EA Sports FC 25": "p13", "JUEGOS PS4/The Last of Us Parte II": "p29", "JUEGOS PS4/GTA V": "p30",
    "JUEGOS PS4/Marvel’s Spider-Man": "p31", "JUEGOS PS4/Minecraft": "p18",
    "JUEGOS PS3/Pro Evolution Soccer 2019 (PS3)": "p22", "JUEGOS PS3/GTA V (PS3)": "p23",
    "JUEGOS PS3/God of War III (PS3)": "p32", "JUEGOS PS3/Uncharted 2 (PS3)": "p33",
    "JUEGOS PS2/GTA san andreas": "p34", "JUEGOS PS2/God of War II (PS2)": "p36",
    "JUEGOS PS2/Shadow of the Colossus (PS2)": "p37",
    "PC Y perifericos/Teclado mecánico Redragon Kumara K552 RGB": "p40",
    "PC Y perifericos/Teclado mecánico Logitech G413 SE": "p41",
    "PC Y perifericos/Mouse gamer Logitech G203 Lightsync": "p42",
    "PC Y perifericos/Mouse gamer Razer DeathAdder Essential": "p43",
    "PC Y perifericos/Monitor LG UltraGear 24 144 Hz IPS": "p44",
    "PC Y perifericos/Monitor Samsung Odyssey G3 27 165 Hz": "p45",
    "PC Y perifericos/Audífonos gamer HyperX Cloud Stinger 2": "p46",
    "PC Y perifericos/Audífonos gamer Redragon Zeus X RGB": "p47",
    "PC Y perifericos/Memoria RAM Kingston Fury Beast 16 GB DDR4 3200": "p48",
    "PC Y perifericos/SSD Kingston NV2 1 TB NVMe M.2": "p49",
}


def blanco_de_fondo(foto: Image.Image) -> Image.Image:
    """Las fotos con fondo transparente (png) quedarían con fondo negro: se les pone fondo blanco."""
    foto = foto.convert("RGBA")
    fondo = Image.new("RGB", foto.size, "white")
    fondo.paste(foto, mask=foto.getchannel("A"))
    return fondo


def main(origen: Path) -> None:
    for viejo in DESTINO.glob("*.webp"):  # empieza de cero para no dejar fotos de antes
        viejo.unlink()
    DESTINO.mkdir(parents=True, exist_ok=True)
    cuantas: dict[str, int] = {}
    for carpeta, codigo in CARPETAS.items():
        fotos = [f for f in (origen / carpeta).iterdir() if f.suffix.lower() in EXTENSIONES]
        # La "1" primero. Si hay dos "1" (ej. 1.jpg y 1.webp), va primero la vertical: suele ser la portada
        fotos.sort(key=lambda f: (f.stem != "1", Image.open(f).width > Image.open(f).height, f.name.lower()))
        for n, archivo in enumerate(fotos[:POR_PRODUCTO], start=1):
            foto = blanco_de_fondo(Image.open(archivo))
            foto.thumbnail((MAXIMO, MAXIMO))
            foto.save(DESTINO / f"{codigo}-{n}.webp", "WEBP", quality=80)
        cuantas[codigo] = min(len(fotos), POR_PRODUCTO)
    LISTA.write_text(json.dumps(dict(sorted(cuantas.items(), key=lambda x: int(x[0][1:]))), indent=1) + "\n", encoding="utf-8")
    print(f"{len(cuantas)} productos, {sum(cuantas.values())} fotos en {DESTINO}")


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ.parent / "imagenes")
