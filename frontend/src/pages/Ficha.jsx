// HU-02: ficha del producto con fotos, tráiler, precio, stock y reseñas.
// HU-17: reseñas verificadas: solo opina quien compró; la tienda puede responder.
// HU-25: con el diseño del prototipo: galería con flechas, cantidad, beneficios, detalles y reseñas con barras.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, leerSesion, urlImagen } from '../api.js'
import { agregarAlCarrito } from '../carrito.js'
import Icono from '../components/Iconos.jsx'
import ReservaPreventa from '../components/ReservaPreventa.jsx'
import TarjetaProducto from '../components/TarjetaProducto.jsx'

const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE')
const etiqueta = (c) => (/^PS\d$/.test(c) ? 'Juegos ' + c : c)
const iniciales = (n) => n.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()
const WHATSAPP = 'https://wa.me/51915152886?text='
const MODOS = { solo: 'Un jugador', local: 'Multijugador local', online: 'En línea' }

// "https://www.youtube.com/watch?v=ABC" -> "ABC" (el código del video)
function idDeYoutube(url) {
  const id = url && url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)
  return id ? id[1] : null
}

// TT-03: primero se muestra solo la miniatura; el reproductor de YouTube (y su cookie) carga recién al hacer clic
function Trailer({ id, nombre }) {
  const [ver, setVer] = useState(false)
  if (ver) {
    return <iframe src={'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1'} title={'Tráiler de ' + nombre}
      className="aspect-video w-full rounded-xl" allow="autoplay; encrypted-media" allowFullScreen />
  }
  return (
    <button type="button" onClick={() => setVer(true)} aria-label={'Ver tráiler de ' + nombre}
      className="relative block aspect-video w-full overflow-hidden rounded-xl">
      <img src={'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'} alt="" className="h-full w-full object-cover" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="rounded-2xl bg-red-600 px-6 py-3 text-2xl text-white">▶</span>
      </span>
    </button>
  )
}

export default function Ficha() {
  const { id } = useParams()
  const [p, setP] = useState(null)
  const [error, setError] = useState('')
  const [agregado, setAgregado] = useState(false)
  const [esFavorito, setEsFavorito] = useState(false)
  const [aviso, setAviso] = useState('')
  const [parecidos, setParecidos] = useState([])
  const [puedo, setPuedo] = useState(null) // HU-17: ¿este cliente puede opinar?
  const [nueva, setNueva] = useState({ estrellas: 5, texto: '' })
  const [respuestas, setRespuestas] = useState({}) // lo que escribe la tienda en cada reseña: { id: 'texto' }
  const [errorResena, setErrorResena] = useState('')
  const [fotoActual, setFotoActual] = useState(0) // HU-21: qué foto de la galería se ve en grande
  const [cantidad, setCantidad] = useState(1)
  const [escribir, setEscribir] = useState(false) // HU-25: formulario de reseña abierto
  const [todas, setTodas] = useState(null) // HU-25: "Ver todas las reseñas"
  const esCliente = leerSesion()?.usuario.rol === 'cliente'
  const esEquipo = ['dueno', 'trabajadora'].includes(leerSesion()?.usuario.rol)

  const cargar = () => api('/productos/' + id).then(setP).catch((e) => setError(e.message))
  useEffect(() => { cargar(); setFotoActual(0); setCantidad(1); setTodas(null) }, [id])
  // HU-17: el servidor dice si compró este producto y si ya opinó
  useEffect(() => { if (esCliente) api('/productos/' + id + '/puedo-opinar').then(setPuedo).catch(() => setPuedo(null)) }, [id])
  // IA · KNN: los 4 productos más parecidos a este
  useEffect(() => { api('/productos/' + id + '/parecidos').then(setParecidos).catch(() => setParecidos([])) }, [id])
  // HU-05: ¿ya lo tengo en favoritos?
  useEffect(() => {
    if (esCliente) api('/mi/favoritos').then((fs) => setEsFavorito(fs.some((f) => f.id === Number(id)))).catch(() => {})
  }, [id])

  const alternarFavorito = async () => {
    await api('/mi/favoritos/' + id, { metodo: esFavorito ? 'DELETE' : 'PUT' })
    setEsFavorito(!esFavorito)
  }
  const pedirAviso = async () => {
    try {
      await api('/mi/avisos/' + id, { metodo: 'POST' })
      setAviso('Listo: te avisaremos apenas llegue.')
    } catch (err) {
      setAviso(err.message)
    }
  }

  const opinar = async (e) => {
    e.preventDefault()
    setErrorResena('')
    try {
      await api('/productos/' + id + '/resenas', { metodo: 'POST', cuerpo: { ...nueva, estrellas: Number(nueva.estrellas) } })
      setPuedo({ puede: false, motivo: 'ya_opinaste' })
      setNueva({ estrellas: 5, texto: '' })
      setEscribir(false)
      setTodas(null)
      cargar()
    } catch (err) {
      setErrorResena(err.message)
    }
  }
  const responder = async (resenaId) => {
    await api('/resenas/' + resenaId + '/respuesta', { metodo: 'PATCH', cuerpo: { respuesta: respuestas[resenaId] } })
    setRespuestas({ ...respuestas, [resenaId]: '' })
    setTodas(null)
    cargar()
  }

  if (error) return <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>
  if (!p) return <p className="text-tinta/60">Cargando...</p>

  const video = idDeYoutube(p.trailer_url)
  const incluye = [p.incluye_caja && 'Caja', p.incluye_manual && 'Manual', p.incluye_disco && 'Disco'].filter(Boolean)
  const sePuedeComprar = !p.es_preventa && p.stock > 0
  const maximo = Math.min(p.stock, 5)
  const dias = p.oferta_termina ? Math.ceil((new Date(p.oferta_termina) - Date.now()) / 86400000) : null
  const anadir = () => {
    for (let n = 0; n < cantidad; n++) agregarAlCarrito(p) // carrito.js suma de a uno (máximo 5 y el stock)
    setAgregado(true)
  }
  const resenas = todas || p.resenas
  const verTodas = () => api('/productos/' + id + '/resenas').then(setTodas).catch(() => {})
  const detalles = [
    [p.categoria === 'Máquinas' || p.categoria === 'Mandos' || /^PS\d$/.test(p.categoria) ? 'Generación' : 'Tipo', p.plataforma && p.plataforma !== 'PC' ? p.plataforma : p.subcategoria],
    ['Estado', p.condicion], ['Incluye', incluye.join(' · ')], ['Modo de juego', p.modos.map((m) => MODOS[m]).join(' · ')],
    ['Tipo', p.origen && (p.origen === 'Original' ? 'Original (Sony)' : 'Genérico')], ['Color', p.color],
    ['Stock en tienda', p.es_preventa ? 'Preventa' : String(p.stock)], ['Entrega', 'Solo recojo en tienda'], ['Código', 'PST-' + p.codigo.toUpperCase()],
  ].filter(([, v]) => v)
  const boton = 'inline-flex items-center justify-center gap-2 rounded-lg border border-tinta/15 px-4 py-2.5 text-sm font-semibold hover:bg-tinta/5'

  return (
    <article className="space-y-8">
      <nav aria-label="Ruta" className="flex flex-wrap items-center gap-2 text-sm">
        <Link to="/catalogo" className="text-rosa hover:underline">Catálogo</Link>
        <Icono nombre="flechaDer" tam={12} />
        <Link to={'/catalogo?categoria=' + encodeURIComponent(p.categoria)} className="text-rosa hover:underline">{etiqueta(p.categoria)}</Link>
        <Icono nombre="flechaDer" tam={12} />
        <span className="text-tinta/70">{p.nombre}</span>
      </nav>

      <div className="grid gap-8 rounded-3xl border border-tinta/10 bg-superficie p-5 shadow-sm sm:p-8 md:grid-cols-2">
        <div className="min-w-0 space-y-3">
          {/* HU-21: galería: la foto grande con flechas y, debajo, las miniaturas */}
          <div className="relative overflow-hidden rounded-2xl border border-tinta/10 bg-white">
            {p.fotos.length
              ? <img src={urlImagen(p.fotos[fotoActual])} alt={p.nombre} width="600" height="600" className="aspect-square w-full object-contain p-4" />
              : <div className="grid aspect-square place-items-center text-tinta/60">Foto pendiente</div>}
            {p.fotos.length > 1 && (
              <>
                <span className="absolute left-3 top-3 rounded-full border border-tinta/15 bg-white/90 px-2.5 py-0.5 text-xs text-[#1a1040]">{fotoActual + 1} / {p.fotos.length}</span>
                <button type="button" onClick={() => setFotoActual((fotoActual - 1 + p.fotos.length) % p.fotos.length)} aria-label="Foto anterior"
                  className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-tinta/15 bg-white/90 text-[#1a1040] shadow"><Icono nombre="flechaIzq" /></button>
                <button type="button" onClick={() => setFotoActual((fotoActual + 1) % p.fotos.length)} aria-label="Foto siguiente"
                  className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-tinta/15 bg-white/90 text-[#1a1040] shadow"><Icono nombre="flechaDer" /></button>
              </>
            )}
          </div>
          {p.fotos.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {p.fotos.map((f, i) => (
                <button key={f} type="button" onClick={() => setFotoActual(i)} aria-label={'Ver foto ' + (i + 1)} aria-current={i === fotoActual}
                  className={'h-20 w-20 overflow-hidden rounded-xl border-2 bg-white ' + (i === fotoActual ? 'border-rosa' : 'border-tinta/10')}>
                  <img src={urlImagen(f)} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
          {video && <Trailer key={video} id={video} nombre={p.nombre} />}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-md border border-morado/30 bg-morado/10 px-2 py-0.5 text-xs text-morado">{p.categoria}</span>
            {p.calificacion && <span><span className="text-[#b07800]">★</span> {p.calificacion} · {p.total_resenas} reseñas</span>}
          </div>
          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl">{p.nombre}</h1>
            <p className="mt-1 text-sm text-tinta/70">{[p.condicion, incluye.length && incluye.join(', ').toLowerCase()].filter(Boolean).join(' · ')}</p>
          </div>

          <div>
            {p.descuento && (
              <p className="flex items-center gap-2"><span className="text-tinta/60 line-through">{soles(p.precio)}</span>
                <span className="rounded-full bg-rosa px-2 py-0.5 text-sm font-semibold text-white">-{p.descuento}%</span></p>
            )}
            <p className="flex flex-wrap items-baseline gap-3">
              <span className="font-titulo text-4xl font-semibold">{soles(p.precio_final)}</span>
              <span className={'flex items-center gap-1.5 text-sm ' + (sePuedeComprar ? 'text-ok' : p.es_preventa ? 'text-aviso' : 'text-error')}>
                <Icono nombre={sePuedeComprar ? 'check' : 'historial'} tam={15} />
                {p.es_preventa ? 'Preventa' : p.stock > 0 ? p.stock + (p.stock === 1 ? ' unidad en tienda' : ' unidades en tienda') : 'Agotado'}
              </span>
            </p>
          </div>
          {p.descuento && dias !== null && (
            <p className="inline-flex items-center gap-2 rounded-lg border border-aviso/40 px-3 py-1.5 text-sm text-aviso">
              ⏱ Oferta por tiempo limitado · {dias <= 1 ? 'último día' : 'quedan ' + dias + ' días'}
            </p>
          )}
          {p.descripcion && <p className="text-tinta/80">{p.descripcion}</p>}

          {p.es_preventa && p.monto_reserva && <ReservaPreventa p={p} />}
          {sePuedeComprar && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-lg border border-tinta/15" role="group" aria-label="Cantidad">
                <button type="button" onClick={() => setCantidad(Math.max(1, cantidad - 1))} aria-label="Una menos" className="h-11 w-10 text-lg">−</button>
                <span className="w-8 text-center tabular-nums" aria-live="polite">{cantidad}</span>
                <button type="button" onClick={() => setCantidad(Math.min(maximo, cantidad + 1))} aria-label="Una más" className="h-11 w-10 text-lg">+</button>
              </div>
              <button type="button" onClick={anadir} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rosa to-[#8b2fd9] px-5 py-2.5 font-semibold text-white shadow-md">
                <Icono nombre="carrito" tam={18} /> Añadir al carrito
              </button>
              {agregado && <Link to="/carrito" className="text-sm font-semibold text-rosa hover:underline">✓ Agregado · ver carrito</Link>}
            </div>
          )}

          {/* HU-05: favoritos y "Avísame cuando llegue" (solo con cuenta de cliente) */}
          <div className="flex flex-wrap items-center gap-2">
            {esCliente && (
              <button type="button" onClick={alternarFavorito} aria-pressed={esFavorito} className={boton + (esFavorito ? ' text-rosa' : '')}>
                <Icono nombre="corazon" tam={16} /> {esFavorito ? 'En tus favoritos' : 'Guardar en favoritos'}
              </button>
            )}
            {esCliente && p.stock === 0 && !p.es_preventa && !aviso && (
              <button type="button" onClick={pedirAviso} className={boton + ' border-rosa/50 text-rosa'}>Avísame cuando llegue</button>
            )}
            <a href={WHATSAPP + encodeURIComponent('Hola Play Shop Tek, tengo una consulta sobre ' + p.nombre + ' (PST-' + p.codigo.toUpperCase() + ').')}
              target="_blank" rel="noreferrer" className={boton + ' border-ok/40 text-ok'}>
              <Icono nombre="whatsapp" tam={16} /> Hablar con un asesor
            </a>
          </div>
          {aviso && <p className="text-sm text-ok">{aviso}</p>}
          {!esCliente && (
            <p className="text-sm text-tinta/60">
              <Link to={'/login?volver=/producto/' + id} className="text-rosa underline">Inicia sesión</Link> para guardar favoritos
              {p.stock === 0 && !p.es_preventa ? ' o pedir que te avisemos cuando llegue' : ''}.
            </p>
          )}

          <ul className="grid gap-3 border-y border-tinta/10 py-4 text-sm sm:grid-cols-3">
            {[['paquete', 'Recojo gratis', 'Av. Revolución 1420, VES'], ['historial', 'Separado 48 horas', 'Paga en la web y recoge'],
              ['escudo', '3 meses de garantía', 'Respaldado por la tienda']].map(([ic, t, d]) => (
              <li key={t} className="flex gap-2"><span className="text-morado"><Icono nombre={ic} tam={18} /></span>
                <span><span className="block font-medium">{t}</span><span className="text-xs text-tinta/60">{d}</span></span></li>
            ))}
          </ul>

          <div>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-morado">Detalles</h2>
            <dl className="divide-y divide-tinta/10 text-sm">
              {detalles.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-tinta/70">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Reseñas de clientes</h2>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="h-fit space-y-4 rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-sm">
            <p className="flex items-baseline gap-2"><span className="font-titulo text-5xl">{p.calificacion ?? '—'}</span>
              <span className="text-sm text-tinta/60">de 5 · {p.total_resenas} reseñas</span></p>
            {/* HU-25: barras: cuántas reseñas hay de cada número de estrellas */}
            <ul className="space-y-1.5 text-sm">
              {(p.estrellas || []).map((n, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="w-6 tabular-nums">{5 - i}★</span>
                  <span className="h-2 flex-1 rounded-full bg-tinta/10">
                    <span className="block h-2 rounded-full bg-gradient-to-r from-morado to-rosa" style={{ width: (p.total_resenas ? (n / p.total_resenas) * 100 : 0) + '%' }} />
                  </span>
                  <span className="w-6 text-right tabular-nums text-tinta/60">{n}</span>
                </li>
              ))}
            </ul>
            {/* HU-17: solo opina quien compró este producto */}
            {esCliente && puedo?.puede && !escribir && (
              <button type="button" onClick={() => setEscribir(true)} className={boton + ' w-full'}><Icono nombre="lapiz" tam={15} /> Escribir una reseña</button>
            )}
            {esCliente && puedo?.puede && escribir && (
              <form onSubmit={opinar} className="space-y-2 rounded-xl border border-rosa/40 p-3 text-sm">
                <p className="font-semibold">Compraste este producto: cuéntanos qué te pareció</p>
                <select value={nueva.estrellas} onChange={(e) => setNueva({ ...nueva, estrellas: e.target.value })} aria-label="Estrellas"
                  className="w-full rounded-lg border border-tinta/15 bg-fondo px-2 py-2">
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}
                </select>
                <textarea placeholder="Tu opinión (mínimo 10 letras)" value={nueva.texto} minLength={10} required rows={3} aria-label="Tu opinión"
                  onChange={(e) => setNueva({ ...nueva, texto: e.target.value })} className="w-full rounded-lg border border-tinta/15 bg-fondo px-3 py-2" />
                <button className="w-full rounded-lg bg-rosa px-4 py-2 font-semibold text-white">Publicar reseña</button>
                {errorResena && <p className="text-error">{errorResena}</p>}
              </form>
            )}
            {esCliente && puedo?.motivo === 'ya_opinaste' && <p className="text-sm text-ok">✓ Ya dejaste tu reseña. ¡Gracias!</p>}
            {esCliente && puedo?.motivo === 'no_compraste' && (
              <p className="text-sm text-tinta/60">Solo pueden opinar quienes compraron este producto (en la web o en la tienda con su celular).</p>
            )}
          </div>

          <div className="space-y-3">
            <ul className="space-y-3">
              {resenas.map((r, i) => (
                <li key={r.id ?? i} className="rounded-2xl border border-tinta/10 bg-superficie p-4 text-sm shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rosa to-morado text-xs font-semibold text-white">{iniciales(r.nombre)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{r.nombre}</p>
                      <p className="text-xs text-tinta/60">{r.fecha}{r.verificada ? ' · compra verificada' : ''}</p>
                    </div>
                    <span className="text-xs text-[#b07800]"><span aria-hidden="true">{'★'.repeat(r.estrellas)}{'☆'.repeat(5 - r.estrellas)}</span><span className="sr-only">{r.estrellas} de 5 estrellas</span></span>
                  </div>
                  <p className="mt-2 text-tinta/90">{r.texto}</p>
                  {r.respuesta && <p className="mt-2 rounded-lg bg-morado/10 p-2 text-xs"><b>Respuesta de la tienda:</b> {r.respuesta}</p>}
                  {/* La tienda responde las reseñas que aún no tienen respuesta */}
                  {esEquipo && !r.respuesta && r.id && (
                    <div className="mt-2 flex gap-2">
                      <input placeholder="Responder como tienda" value={respuestas[r.id] || ''} aria-label={'Respuesta a ' + r.nombre}
                        onChange={(e) => setRespuestas({ ...respuestas, [r.id]: e.target.value })}
                        className="flex-1 rounded-lg border border-tinta/15 bg-fondo px-2 py-1" />
                      <button type="button" onClick={() => responder(r.id)} disabled={(respuestas[r.id] || '').length < 5}
                        className="rounded-lg border border-rosa px-3 py-1 text-rosa disabled:opacity-40">Responder</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {!todas && p.total_resenas > p.resenas.length && (
              <button type="button" onClick={verTodas} className={boton}><Icono nombre="lista" tam={15} /> Ver todas las reseñas ({p.total_resenas})</button>
            )}
          </div>
        </div>
      </section>

      {parecidos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">También te puede gustar</h2>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {parecidos.map((x) => <li key={x.id}><TarjetaProducto p={x} /></li>)}
          </ul>
        </section>
      )}
    </article>
  )
}
