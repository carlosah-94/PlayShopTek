// HU-22: página de inicio como la del prototipo: categorías, carrusel con fotos de la tienda, dos accesos
// (ofertas y servicio técnico), recomendados, ofertas con contador, servicios del taller y reseñas de clientes.
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api, leerSesion, urlImagen } from '../api.js'
import { BotonWhatsApp } from '../components/Asesores.jsx'
import Icono from '../components/Iconos.jsx'
import MenuCategoria from '../components/MenuCategoria.jsx'
import SeccionOfertas, { ordenarOfertas } from '../components/SeccionOfertas.jsx'
import TarjetaProducto from '../components/TarjetaProducto.jsx'
import { useFavoritos } from '../favoritos.js'


// Mismo orden que el prototipo; "PS2" se muestra como "Juegos PS2"
const CATEGORIAS = [
  ['PS2', 'Juegos PS2', 'disco'], ['PS3', 'Juegos PS3', 'disco'], ['PS4', 'Juegos PS4', 'disco'],
  ['PS5', 'Juegos PS5', 'disco'], ['Máquinas', 'Máquinas', 'consola'], ['Mandos', 'Mandos', 'mando'],
  ['PC y periféricos', 'PC y periféricos', 'pc'],
]

// Fotos de la tienda (frontend/public/inicio). Se muestran mientras llegan los banners que Ángel maneja en el panel (HU-24)
const DIAPOSITIVAS = [
  { foto: '/inicio/carrusel-1.webp', titulo: 'PlayStation 5 nuevas y selladas', texto: 'Con boleta y garantía. Te ayudamos a configurarla.', enlace: '/catalogo?categoria=M%C3%A1quinas', boton: 'Ver consolas', alt: 'Dos consolas PlayStation 5 con sus mandos' },
  { foto: '/inicio/carrusel-2.webp', titulo: 'Visítanos en Villa El Salvador', texto: 'Av. Revolución 1420 · Lunes a sábado 12:00–20:00', enlace: '/rastreo', boton: 'Rastrea tu reparación', alt: 'Fachada de la tienda Play Shop Tek en Villa El Salvador' },
  { foto: '/inicio/carrusel-3.webp', titulo: 'Juegos para PS2, PS3, PS4 y PS5', texto: 'Nuevos, usados y packs. Pruébalos en la tienda antes de llevarlos.', enlace: '/catalogo', boton: 'Ver catálogo', alt: 'Vitrina de la tienda con juegos y una PS4 en caja' },
  { foto: '/inicio/carrusel-4.webp', titulo: 'Juegos físicos para tu colección', texto: 'Sepáralos por la web y recógelos el mismo día.', enlace: '/catalogo?categoria=PS5', boton: 'Juegos PS5', alt: 'PlayStation 5 Slim con un juego en disco y un mando' },
]

// HU-24: a dónde lleva cada banner y qué dice su botón (Ángel lo elige en "Banners de inicio")
const CATEGORIA = ['PS5', 'PS4', 'PS3', 'PS2', 'Máquinas', 'Mandos', 'PC y periféricos']
function destino(d) {
  if (d === 'ofertas') return ['/ofertas', 'Ver ofertas']
  if (d === 'reparaciones') return ['/#servicio', 'Ver reparaciones']
  if (d === 'catalogo') return ['/catalogo', 'Ver catálogo']
  if (d === 'tienda') return ['/rastreo', 'Rastrea tu reparación']
  if (CATEGORIA.includes(d)) return ['/catalogo?categoria=' + encodeURIComponent(d), /^PS\d$/.test(d) ? 'Juegos ' + d : 'Ver ' + d.toLowerCase()]
  return [null, null]
}
const aDiapositiva = (b) => {
  const [enlace, boton] = destino(b.destino)
  return { foto: urlImagen(b.imagen_url), fotoMovil: urlImagen(b.imagen_movil_url), titulo: b.titulo, texto: b.subtitulo,
    alt: b.texto_alternativo || '', enlace, boton, conTexto: b.con_texto }
}

// Ícono de cada servicio del taller (el servidor manda el nombre del ícono del prototipo)
const ICONO_SERVICIO = { 'ph ph-game-controller': 'mando', 'ph ph-wrench': 'llave', 'ph ph-disc': 'disco', 'ph ph-plug': 'enchufe' }

function Carrusel({ diapositivas }) {
  const [actual, setActual] = useState(0)
  const [pausado, setPausado] = useState(false)
  const total = diapositivas.length
  const ir = (n) => setActual((n + total) % total)

  // Cambia sola cada 5 segundos, menos cuando el mouse o el teclado está encima (para poder leer)
  useEffect(() => {
    if (pausado) return
    const reloj = setInterval(() => setActual((n) => (n + 1) % total), 5000)
    return () => clearInterval(reloj)
  }, [pausado, total])

  const d = diapositivas[Math.min(actual, total - 1)] || {}
  return (
    <section aria-roledescription="carrusel" aria-label="Novedades de la tienda"
      onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)} onBlur={() => setPausado(false)}
      className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-noche shadow-lg lg:aspect-auto lg:h-full lg:min-h-[420px]">
      {diapositivas.map((x, i) => (
        // HU-24: si Ángel subió una foto cuadrada para celular, se usa en pantallas chicas
        <picture key={x.foto + i}>
          {x.fotoMovil && <source media="(max-width: 640px)" srcSet={x.fotoMovil} />}
          <img src={x.foto} alt={i === actual ? x.alt : ''} aria-hidden={i !== actual}
            width="1200" height="680" fetchPriority={i === 0 ? 'high' : 'low'} loading={i === 0 ? 'eager' : 'lazy'}
            className={'absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ' + (i === actual ? 'opacity-100' : 'opacity-0')} />
        </picture>
      ))}
      {d.conTexto !== false && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-4 pb-10 text-white sm:p-6 sm:pb-12" aria-live="polite">
          <h2 className="text-xl font-semibold sm:text-3xl">{d.titulo}</h2>
          {d.texto && <p className="mt-1 hidden text-sm text-white/90 sm:block">{d.texto}</p>}
          {d.enlace && (
            <Link to={d.enlace} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-rosa px-3 py-1.5 text-sm font-semibold">
              {d.boton} <Icono nombre="flechaDer" tam={14} />
            </Link>
          )}
        </div>
      )}
      {/* "Solo imagen": toda la foto es el enlace */}
      {d.conTexto === false && d.enlace && <Link to={d.enlace} aria-label={d.titulo} className="absolute inset-0" />}
      {/* Flechas solo en pantallas medianas o más; en celular se usan los puntos (las flechas tapaban el título) */}
      <button type="button" onClick={() => ir(actual - 1)} aria-label="Foto anterior"
        className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-noche/80 text-white hover:bg-noche sm:grid">
        <Icono nombre="flechaIzq" />
      </button>
      <button type="button" onClick={() => ir(actual + 1)} aria-label="Foto siguiente"
        className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-noche/80 text-white hover:bg-noche sm:grid">
        <Icono nombre="flechaDer" />
      </button>
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
        {diapositivas.map((x, i) => (
          // Cada punto mide 24 px de alto para que sea fácil de tocar en el celular
          <button key={x.foto + i} type="button" onClick={() => ir(i)} aria-label={'Ver foto ' + (i + 1)} aria-current={i === actual}
            className="grid h-6 w-6 place-items-center">
            <span className={'block h-2 rounded-full transition-all ' + (i === actual ? 'w-5 bg-[#ff8fe4]' : 'w-2 bg-white/70')} />
          </button>
        ))}
      </div>
    </section>
  )
}

function Acceso({ a, externo, foto, alt, titulo, texto, enlace, icono }) {
  const contenido = (
    <>
      <img src={foto} alt={alt} loading="lazy" width="480" height="480" className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-noche via-noche/70 to-noche/10" />
      <div className="relative mt-auto p-4 text-white">
        <p className="flex items-center gap-2 font-titulo text-lg font-semibold leading-tight">{icono} {titulo}</p>
        <p className="mt-1 text-sm text-white/85">{texto}</p>
        <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-[#ff8fe4]">{enlace} <Icono nombre="flechaDer" tam={14} /></p>
      </div>
    </>
  )
  const clase = 'group relative flex min-h-48 flex-1 flex-col overflow-hidden rounded-2xl bg-noche shadow-lg'
  return externo
    ? <a href={a} className={clase}>{contenido}</a>
    : <Link to={a} className={clase}>{contenido}</Link>
}

export default function Inicio() {
  const sesion = leerSesion()
  const aviso = useLocation().state?.aviso // HU-27: "Listo, tu vitrina está personalizada." al terminar la encuesta
  const [productos, setProductos] = useState(null) // null = todavía cargando
  const [inicio, setInicio] = useState(null)
  const [banners, setBanners] = useState(null) // HU-24: los maneja Ángel desde el panel
  const [generos, setGeneros] = useState({})
  const [abierta, setAbierta] = useState(null) // HU-25: categoría cuyo panel está abierto (solo en computadora)
  const [error, setError] = useState('')
  const [favoritos, alternarFavorito] = useFavoritos()
  // Al volver de la encuesta, baja directo a "Recomendado para ti"
  useEffect(() => {
    if (aviso && inicio) document.getElementById('recomendados')?.scrollIntoView({ block: 'start' })
  }, [aviso, inicio])

  // Dos pedidos al mismo tiempo: el catálogo (para contar categorías y ofertas) y los datos de inicio
  useEffect(() => {
    api('/productos').then(setProductos).catch((e) => setError(e.message))
    api('/inicio').then(setInicio).catch(() => {})
    api('/banners').then(setBanners).catch(() => {})
    api('/generos').then((gs) => setGeneros(Object.fromEntries(gs.map((g) => [g.id, g.nombre])))).catch(() => {})
  }, [])

  const cuenta = (cat) => productos?.filter((p) => p.categoria === cat).length ?? '…'
  const enOferta = productos ? ordenarOfertas(productos).length : null
  const diapositivas = (banners || []).filter((b) => b.ubicacion === 'carrusel' && b.imagen_url).map(aDiapositiva)
  const fotoCuadro = (u, porDefecto) => urlImagen((banners || []).find((b) => b.ubicacion === u)?.imagen_url) || porDefecto

  return (
    <div className="space-y-12">
      <h1 className="sr-only">Play Shop Tek: videojuegos, consolas y servicio técnico en Villa El Salvador</h1>
      {error && <p className="rounded-lg bg-red-500/15 p-3 text-sm text-error">{error}</p>}

      {/* Parte de arriba: categorías · carrusel · dos accesos. En celular, una sola columna */}
      <div className="relative grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)_230px]" onMouseLeave={() => setAbierta(null)}>
        {/* HU-25: panel de la categoría, encima del carrusel (solo en computadora y cuando ya cargaron los productos) */}
        {abierta && productos && (
          <div className="absolute inset-y-0 left-[246px] z-30 hidden w-[min(680px,calc(100%-262px))] lg:block">
            <MenuCategoria cat={abierta} icono={CATEGORIAS.find((c) => c[0] === abierta)[2]} productos={productos} generos={generos} />
          </div>
        )}
        <nav aria-label="Categorías" className="order-3 rounded-2xl border border-tinta/10 bg-superficie p-2 shadow-sm lg:order-none">
          <p className="mb-1 flex items-center gap-2 rounded-xl bg-gradient-to-r from-rosa to-morado px-4 py-2.5 font-semibold text-white">
            <Icono nombre="lista" tam={18} /> Categorías
          </p>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-1">
            {CATEGORIAS.map(([cat, nombre, icono]) => (
              <li key={cat} onMouseEnter={() => setAbierta(cat)}>
                <Link to={'/catalogo?categoria=' + encodeURIComponent(cat)}
                  className={'flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-rosa/10 ' + (abierta === cat ? 'lg:bg-rosa/10' : '')}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rosa/10 text-rosa"><Icono nombre={icono} tam={18} /></span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{nombre}</span>
                    <span className="block text-xs text-tinta/75">{cuenta(cat)} productos</span>
                  </span>
                  <span className="text-tinta/60"><Icono nombre="flechaDer" tam={14} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="order-1 lg:order-none" onMouseEnter={() => setAbierta(null)}><Carrusel diapositivas={diapositivas.length ? diapositivas : DIAPOSITIVAS} /></div>

        <div className="order-2 grid gap-4 sm:grid-cols-2 lg:order-none lg:flex lg:flex-col" onMouseEnter={() => setAbierta(null)}>
          <Acceso a="/ofertas" foto={fotoCuadro('cuadro_ofertas', '/inicio/banner-ofertas.webp')} alt="" icono="⚡"
            titulo="Ofertas por tiempo limitado"
            texto={enOferta === null ? 'Precios rebajados por pocos días' : enOferta + ' productos con descuento'}
            enlace="Ver ofertas" />
          <Acceso a="#servicio" externo foto={fotoCuadro('cuadro_reparaciones', '/inicio/banner-servicio.webp')} alt="" icono={<Icono nombre="llave" tam={18} />}
            titulo="¿Se malogró tu mando?" texto="Cotiza la reparación por WhatsApp" enlace="Ver reparaciones" />
        </div>
      </div>

      {/* Recomendados: lo más vendido o, si el cliente inició sesión, según su encuesta de gustos y sus compras (HU-27, lo decide el servidor) */}
      <section id="recomendados" className="scroll-mt-24 space-y-3">
        {aviso && <p role="status" className="flex items-center gap-2 rounded-xl border border-ok/40 bg-ok/10 px-4 py-2.5 text-sm text-ok"><Icono nombre="check" tam={16} /> {aviso}</p>}
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-semibold">Recomendado para ti</h2>
            <p className="text-sm text-tinta/70">
              {inicio?.perfil ? inicio.perfil + '. Estos productos calzan con eso y hay stock hoy.'
                : inicio?.personalizado ? 'Según lo que ya compraste en la tienda' : 'Lo más pedido en la tienda'}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold text-rosa">
            {sesion?.usuario.rol === 'cliente' && <Link to="/encuesta" className="flex items-center gap-1 hover:underline"><Icono nombre="ajustes" tam={16} /> Ajustar mis gustos</Link>}
            {!sesion && <Link to="/login?crear=1" className="flex items-center gap-1 hover:underline"><Icono nombre="usuarioMas" tam={16} /> Crea tu cuenta y te recomendamos mejor</Link>}
            <Link to="/catalogo" className="flex items-center gap-1 hover:underline">Ver todo <Icono nombre="flechaDer" tam={14} /></Link>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {inicio
            ? inicio.recomendados.map((p) => (
              <li key={p.id}><TarjetaProducto p={p} razon={inicio.razones?.[p.id]} favorito={favoritos.has(p.id)} onFavorito={alternarFavorito} /></li>
            ))
            // Mientras carga se reserva el espacio, así la página no "salta" (TT-03)
            : [1, 2, 3, 4].map((n) => <li key={n} className="h-96 animate-pulse rounded-2xl bg-tinta/5" />)}
        </ul>
      </section>

      <SeccionOfertas productos={productos} />

      {/* Servicio técnico */}
      <section id="servicio" className="grid scroll-mt-24 gap-6 rounded-3xl border border-morado/20 bg-gradient-to-br from-morado/10 via-morado/5 to-rosa/10 p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
        <div className="space-y-3">
          <p className="inline-block rounded-md border border-morado/30 bg-morado/10 px-2 py-0.5 text-xs font-semibold text-morado">Servicio técnico</p>
          <h2 className="text-2xl font-semibold">Tu consola o mando, reparado con garantía</h2>
          <p className="text-sm text-tinta/70">
            Cotiza por WhatsApp con un asesor: ahí acuerdan el diagnóstico y el precio. Luego sigues el estado de tu equipo con tu código de reparación.
          </p>
          <div className="flex flex-wrap gap-2">
            <BotonWhatsApp mensaje="Hola Play Shop Tek, quiero cotizar una reparación." conCerrar className="flex items-center gap-2 rounded-lg bg-rosa px-3 py-2 text-sm font-semibold text-white">
              <Icono nombre="whatsapp" tam={18} /> Cotizar por WhatsApp
            </BotonWhatsApp>
            <Link to="/rastreo" className="flex items-center gap-2 rounded-lg border border-tinta/20 bg-superficie px-3 py-2 text-sm font-semibold hover:bg-tinta/5">
              <Icono nombre="buscar" tam={16} /> Rastrea tu reparación
            </Link>
          </div>
        </div>
        <ul className="space-y-2">
          {(inicio?.servicios ?? []).map((s) => (
            <li key={s.nombre} className="flex items-center gap-3 rounded-xl border border-morado/15 bg-superficie/70 px-4 py-3">
              <span className="text-morado"><Icono nombre={ICONO_SERVICIO[s.icono] || 'llave'} /></span>
              <span className="flex-1 text-sm font-medium">{s.nombre}</span>
              <span className="text-xs text-tinta/70">{s.tiempo}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Reseñas reales de la base de datos (las de 5 estrellas más recientes) */}
      {inicio?.resenas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Lo que dicen los clientes</h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {inicio.resenas.map((r) => (
              <li key={r.nombre + r.sobre} className="flex flex-col gap-3 rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-sm">
                <p className="text-[#b07800]"><span aria-hidden="true">{'★'.repeat(r.estrellas)}</span><span className="sr-only">{r.estrellas} de 5 estrellas</span></p>
                <p className="flex-1 text-sm">{r.texto}</p>
                <p className="text-xs text-tinta/60">{r.nombre} · {r.sobre}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
