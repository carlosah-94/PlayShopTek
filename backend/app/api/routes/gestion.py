"""HU-24: lo que Ángel administra desde el panel de gestión.

- Imágenes que sube (fotos de productos y banners).
- Banners del inicio (carrusel y los dos cuadros de al lado).
- Mi equipo: cuentas de las trabajadoras.
- Servicios técnicos que se ofrecen.
- Géneros de los juegos.
"""
import base64
import re
import secrets
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import solo_dueno
from app.core.security import hash_password
from app.database import get_db
from app.models import (
    Banner,
    Empleado,
    Genero,
    Imagen,
    Reparacion,
    TipoServicio,
    Usuario,
)
from app.models.catalogo import producto_generos
from app.models.enums import Rol
from app.schemas import (
    BannerEntrada,
    BannerSalida,
    CambioActivo,
    GeneroEntrada,
    GeneroSalida,
    ImagenEntrada,
    ImagenSalida,
    ServicioEntrada,
    ServicioSalida,
    TrabajadorEntrada,
    TrabajadorSalida,
)

router = APIRouter(tags=["Gestión"])
DUENO = [Depends(solo_dueno)]


# ── Imágenes ─────────────────────────────────────────────────────────────────────
TIPOS = {"image/webp", "image/jpeg", "image/png"}


@router.post("/imagenes", response_model=ImagenSalida, status_code=status.HTTP_201_CREATED, dependencies=DUENO)
def subir_imagen(datos: ImagenEntrada, db: Session = Depends(get_db)):
    """El navegador achica la foto (máximo 1200 px, formato webp) y la manda como texto base64."""
    m = re.fullmatch(r"data:(image/[a-z]+);base64,(.+)", datos.datos, re.S)
    if not m or m.group(1) not in TIPOS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "La foto debe ser JPG, PNG o WebP.")
    try:
        contenido = base64.b64decode(m.group(2), validate=True)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "No se pudo leer la foto.")
    img = Imagen(mime=m.group(1), datos=contenido)
    db.add(img)
    db.commit()
    return ImagenSalida(url=f"/api/imagenes/{img.id}")


@router.get("/imagenes/{imagen_id}")
def ver_imagen(imagen_id: int, db: Session = Depends(get_db)):
    """Pública. Una foto subida nunca cambia (si Ángel la reemplaza, es otra id), así que el navegador la guarda un año."""
    img = db.get(Imagen, imagen_id)
    if img is None:
        raise HTTPException(404, "Imagen no encontrada.")
    return Response(content=img.datos, media_type=img.mime, headers={"Cache-Control": "public, max-age=31536000, immutable"})


# ── Banners del inicio ───────────────────────────────────────────────────────────
@router.get("/banners", response_model=list[BannerSalida])
def banners_activos(db: Session = Depends(get_db)):
    """Pública: lo que muestra la página de inicio (solo los activos, en orden)."""
    return db.scalars(select(Banner).where(Banner.activo.is_(True)).order_by(Banner.orden, Banner.id)).all()


@router.get("/banners/todos", response_model=list[BannerSalida], dependencies=DUENO)
def todos_los_banners(db: Session = Depends(get_db)):
    return db.scalars(select(Banner).order_by(Banner.ubicacion, Banner.orden, Banner.id)).all()


@router.post("/banners", response_model=BannerSalida, status_code=status.HTTP_201_CREATED, dependencies=DUENO)
def agregar_banner(datos: BannerEntrada, db: Session = Depends(get_db)):
    ultimo = db.scalar(select(func.max(Banner.orden)).where(Banner.ubicacion == datos.ubicacion)) or 0
    b = Banner(**datos.model_dump(exclude={"orden"}), orden=ultimo + 1)
    db.add(b)
    db.commit()
    return b


@router.put("/banners/{banner_id}", response_model=BannerSalida, dependencies=DUENO)
def editar_banner(banner_id: int, datos: BannerEntrada, db: Session = Depends(get_db)):
    b = db.get(Banner, banner_id)
    if b is None:
        raise HTTPException(404, "Diapositiva no encontrada.")
    for campo, valor in datos.model_dump().items():
        setattr(b, campo, valor)
    db.commit()
    return b


@router.delete("/banners/{banner_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=DUENO)
def quitar_banner(banner_id: int, db: Session = Depends(get_db)):
    b = db.get(Banner, banner_id)
    if b is None:
        raise HTTPException(404, "Diapositiva no encontrada.")
    if b.ubicacion != "carrusel":
        raise HTTPException(status.HTTP_409_CONFLICT, "Los dos cuadros junto al carrusel no se borran: solo se cambia su foto.")
    db.delete(b)
    db.commit()


# ── Mi equipo ────────────────────────────────────────────────────────────────────
def clave_temporal() -> str:
    """8 caracteres fáciles de dictar (sin 0/O ni 1/l para no confundirse)."""
    return "".join(secrets.choice("abcdefghjkmnpqrstuvwxyz23456789") for _ in range(8))


def a_trabajador(e: Empleado, atendidas: dict[int, int], clave: str | None = None) -> TrabajadorSalida:
    return TrabajadorSalida(usuario_id=e.usuario_id, nombre=e.nombre, email=e.usuario.email, telefono=e.telefono,
                            rol=e.usuario.rol, activo=e.usuario.activo, fecha_ingreso=e.fecha_ingreso,
                            reparaciones_atendidas=atendidas.get(e.usuario_id, 0), clave_temporal=clave)


def reparaciones_por_tecnico(db: Session) -> dict[int, int]:
    return dict(db.execute(select(Reparacion.tecnico_id, func.count()).group_by(Reparacion.tecnico_id)).all())


@router.get("/equipo", response_model=list[TrabajadorSalida], dependencies=DUENO)
def mi_equipo(db: Session = Depends(get_db)):
    """Las trabajadoras (Ángel no aparece: es el dueño)."""
    empleados = db.scalars(select(Empleado).join(Usuario).where(Usuario.rol == Rol.trabajadora).order_by(Empleado.nombre))
    atendidas = reparaciones_por_tecnico(db)
    return [a_trabajador(e, atendidas) for e in empleados]


@router.post("/equipo", response_model=TrabajadorSalida, status_code=status.HTTP_201_CREATED, dependencies=DUENO)
def agregar_trabajador(datos: TrabajadorEntrada, db: Session = Depends(get_db)):
    """Crea la cuenta con una contraseña temporal que Ángel le entrega a la trabajadora (se muestra una sola vez)."""
    email = datos.email.lower()
    if db.scalar(select(Usuario.id).where(Usuario.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese correo.")
    clave = clave_temporal()
    u = Usuario(email=email, password_hash=hash_password(clave), rol=Rol.trabajadora)
    u.empleado = Empleado(nombre=datos.nombre.strip(), telefono=datos.telefono, fecha_ingreso=date.today())
    db.add(u)
    db.commit()
    return a_trabajador(u.empleado, {}, clave)


@router.patch("/equipo/{usuario_id}", response_model=TrabajadorSalida, dependencies=DUENO)
def activar_o_desactivar(usuario_id: int, datos: CambioActivo, db: Session = Depends(get_db)):
    """Desactivar no borra nada: se conserva el historial de reparaciones y ventas que atendió."""
    e = db.get(Empleado, usuario_id)
    if e is None or e.usuario.rol != Rol.trabajadora:
        raise HTTPException(404, "Trabajador no encontrado.")
    e.usuario.activo = datos.activo
    db.commit()
    return a_trabajador(e, reparaciones_por_tecnico(db))


@router.post("/equipo/{usuario_id}/clave", response_model=TrabajadorSalida, dependencies=DUENO)
def restablecer_clave(usuario_id: int, db: Session = Depends(get_db)):
    e = db.get(Empleado, usuario_id)
    if e is None or e.usuario.rol != Rol.trabajadora:
        raise HTTPException(404, "Trabajador no encontrado.")
    clave = clave_temporal()
    e.usuario.password_hash = hash_password(clave)
    db.commit()
    return a_trabajador(e, reparaciones_por_tecnico(db), clave)


# ── Servicios técnicos ───────────────────────────────────────────────────────────
def a_servicio(t: TipoServicio) -> ServicioSalida:
    return ServicioSalida(id=t.id, nombre=t.nombre, detalle=t.detalle, tiempo=t.tiempo_estimado, activo=t.activo, icono=t.icono)


@router.get("/servicios", response_model=list[ServicioSalida])
def servicios(todos: bool = False, db: Session = Depends(get_db)):
    """Pública: los servicios encendidos (página Reparaciones). Con ?todos=true salen también los apagados."""
    consulta = select(TipoServicio).order_by(TipoServicio.id)
    if not todos:
        consulta = consulta.where(TipoServicio.activo.is_(True))
    return [a_servicio(t) for t in db.scalars(consulta)]


@router.post("/servicios", response_model=ServicioSalida, status_code=status.HTTP_201_CREATED, dependencies=DUENO)
def agregar_servicio(datos: ServicioEntrada, db: Session = Depends(get_db)):
    if db.scalar(select(TipoServicio.id).where(func.lower(TipoServicio.nombre) == datos.nombre.strip().lower())):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese servicio ya existe.")
    t = TipoServicio(nombre=datos.nombre.strip(), detalle=datos.detalle, tiempo_estimado=datos.tiempo, icono="ph ph-wrench")
    db.add(t)
    db.commit()
    return a_servicio(t)


@router.patch("/servicios/{servicio_id}", response_model=ServicioSalida, dependencies=DUENO)
def prender_o_apagar(servicio_id: int, datos: CambioActivo, db: Session = Depends(get_db)):
    t = db.get(TipoServicio, servicio_id)
    if t is None:
        raise HTTPException(404, "Servicio no encontrado.")
    t.activo = datos.activo
    db.commit()
    return a_servicio(t)


# ── Géneros ──────────────────────────────────────────────────────────────────────
def clave_de(nombre: str) -> str:
    """'Simulación' -> 'simulacion' (sin tildes ni espacios), para usarlo como id."""
    sin_tildes = nombre.lower().translate(str.maketrans("áéíóúñü", "aeiounu"))
    return re.sub(r"[^a-z0-9]+", "-", sin_tildes).strip("-")[:30]


@router.get("/generos", response_model=list[GeneroSalida])
def generos(db: Session = Depends(get_db)):
    """Pública. Con cuántos juegos tiene cada género (el menú del inicio solo muestra los que tienen)."""
    cuenta = dict(db.execute(select(producto_generos.c.genero_id, func.count()).group_by(producto_generos.c.genero_id)).all())
    return [GeneroSalida(id=g.id, nombre=g.nombre, juegos=cuenta.get(g.id, 0)) for g in db.scalars(select(Genero).order_by(Genero.nombre))]


@router.post("/generos", response_model=GeneroSalida, status_code=status.HTTP_201_CREATED, dependencies=DUENO)
def agregar_genero(datos: GeneroEntrada, db: Session = Depends(get_db)):
    clave = clave_de(datos.nombre)
    if not clave or db.get(Genero, clave):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese género ya existe.")
    g = Genero(id=clave, nombre=datos.nombre.strip().capitalize())
    db.add(g)
    db.commit()
    return GeneroSalida(id=g.id, nombre=g.nombre, juegos=0)
