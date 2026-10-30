// HU-02: ficha del producto con fotos, tráiler, precio, stock y reseñas.
// HU-17: reseñas verificadas: solo opina quien compró; la tienda puede responder.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, leerSesion, urlImagen } from '../api.js'
import { agregarAlCarrito } from '../carrito.js'
import ReservaPreventa from '../components/ReservaPreventa.jsx'
import TarjetaProducto from '../components/TarjetaProducto.jsx'

const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE')
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
  const esCliente = leerSesion()?.usuario.rol === 'cliente'
  const esEquipo = ['dueno', 'trabajadora'].includes(leerSesion()?.usuario.rol)

  const cargar = () => api('/productos/' + id).then(setP).catch((e) => setError(e.message))
  useEffect(() => { cargar(); setFotoActual(0) }, [id])
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
      cargar()
    } catch (err) {
      setErrorResena(err.message)
    }
  }
  const responder = async (resenaId) => {
    await api('/resenas/' + resenaId + '/respuesta', { metodo: 'PATCH', cuerpo: { respuesta: respuestas[resenaId] } })
    setRespuestas({ ...respuestas, [resenaId]: '' })
    cargar()
  }

  if (error) return <p className="rounded-lg bg-red-500/15 p-3 text-sm text-error">{error}</p>
  if (!p) return <p className="text-tinta/60">Cargando...</p>

  const video = idDeYoutube(p.trailer_url)
  const incluye = [p.incluye_caja && 'Caja', p.incluye_manual && 'Manual', p.incluye_disco && 'Disco'].filter(Boolean)
  const disponibilidad = p.es_preventa ? 'Preventa' : p.stock > 0 ? p.stock + ' en stock' : 'Agotado'

  return (
    <article className="space-y-6">
      <Link to="/" className="text-sm text-tinta/60 hover:text-rosa">← Volver al catálogo</Link>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          {/* HU-21: galería: la foto grande y, debajo, las miniaturas para cambiarla */}
          {p.fotos.length
            ? <img src={urlImagen(p.fotos[fotoActual])} alt={p.nombre} width="600" height="600" className="aspect-square w-full rounded-xl bg-superficie object-contain" />
            : <div className="grid aspect-[4/3] place-items-center rounded-xl bg-superficie text-tinta/60">Foto pendiente</div>}
          {p.fotos.length > 1 && (
            <div className="flex gap-2">
              {p.fotos.map((f, i) => (
                <button key={f} type="button" onClick={() => setFotoActual(i)} aria-label={'Ver foto ' + (i + 1)}
                  className={'h-16 w-16 overflow-hidden rounded-lg border-2 ' + (i === fotoActual ? 'border-rosa' : 'border-transparent')}>
                  <img src={urlImagen(f)} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {video && <Trailer key={video} id={video} nombre={p.nombre} />}
        </div>

        <div className="space-y-4">
          <p className="text-xs uppercase tracking-wide text-tinta/60">{p.categoria} · {p.condicion}</p>
          <h1 className="text-2xl font-bold">{p.nombre}</h1>
          {p.calificacion && <p className="text-sm">★ {p.calificacion} · {p.total_resenas} reseñas</p>}

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{soles(p.precio_final)}</span>
            {p.descuento && <span className="text-tinta/60 line-through">{soles(p.precio)}</span>}
            {p.descuento && <span className="rounded bg-rosa px-1.5 text-sm font-semibold text-white">-{p.descuento}%</span>}
          </div>
          <p className={p.stock === 0 && !p.es_preventa ? 'text-error' : 'text-tinta/70'}>{disponibilidad}</p>
          {p.es_preventa && p.monto_reserva && <ReservaPreventa p={p} />}
          {!p.es_preventa && p.stock > 0 && (
            <div className="flex items-center gap-3">
              <button onClick={() => { agregarAlCarrito(p); setAgregado(true) }}
                className="rounded-lg bg-rosa px-5 py-2 font-semibold text-white">Agregar al carrito</button>
              {agregado && <Link to="/carrito" className="text-sm text-rosa">✓ Agregado · ver carrito</Link>}
            </div>
          )}

          {/* HU-05: favoritos y "Avísame cuando llegue" (solo con cuenta de cliente) */}
          {esCliente ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <button onClick={alternarFavorito} className="rounded-lg border border-tinta/20 px-4 py-2">
                {esFavorito ? '♥ En tus favoritos' : '♡ Guardar en favoritos'}
              </button>
              {p.stock === 0 && !p.es_preventa && !aviso && (
                <button onClick={pedirAviso} className="rounded-lg border border-rosa px-4 py-2 text-rosa">Avísame cuando llegue</button>
              )}
              {aviso && <span className="text-ok">{aviso}</span>}
            </div>
          ) : (
            <p className="text-sm text-tinta/60">
              <Link to={'/login?volver=/producto/' + id} className="text-rosa underline">Inicia sesión</Link> para guardar favoritos
              {p.stock === 0 && !p.es_preventa ? ' o pedir que te avisemos cuando llegue' : ''}.
            </p>
          )}

          {p.descripcion && <p className="text-tinta/80">{p.descripcion}</p>}

          <dl className="grid grid-cols-2 gap-2 text-sm">
            {incluye.length > 0 && <><dt className="text-tinta/60">Incluye</dt><dd>{incluye.join(', ')}</dd></>}
            {p.modos.length > 0 && <><dt className="text-tinta/60">Modos</dt><dd>{p.modos.map((m) => MODOS[m]).join(', ')}</dd></>}
            {p.color && <><dt className="text-tinta/60">Color</dt><dd>{p.color}</dd></>}
            {p.origen && <><dt className="text-tinta/60">Origen</dt><dd>{p.origen}</dd></>}
          </dl>
          <p className="text-sm text-tinta/60">Recojo en tienda: Av. Revolución 1420, Villa El Salvador.</p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Reseñas</h2>

        {/* HU-17: formulario solo para quien compró este producto */}
        {esCliente && puedo?.puede && (
          <form onSubmit={opinar} className="mt-3 space-y-2 rounded-xl border border-rosa/40 bg-superficie p-4 text-sm">
            <p className="font-semibold">Compraste este producto: cuéntanos qué te pareció</p>
            <div className="flex gap-2">
              <select value={nueva.estrellas} onChange={(e) => setNueva({ ...nueva, estrellas: e.target.value })}
                className="rounded-lg border border-tinta/15 bg-fondo px-2 py-2">
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
              </select>
              <input placeholder="Tu opinión (mínimo 10 letras)" value={nueva.texto} minLength={10} required
                onChange={(e) => setNueva({ ...nueva, texto: e.target.value })}
                className="flex-1 rounded-lg border border-tinta/15 bg-fondo px-3 py-2" />
              <button className="rounded-lg bg-rosa px-4 py-2 font-semibold text-white">Publicar</button>
            </div>
            {errorResena && <p className="text-error">{errorResena}</p>}
          </form>
        )}
        {esCliente && puedo?.motivo === 'ya_opinaste' && <p className="mt-2 text-sm text-ok">✓ Ya dejaste tu reseña. ¡Gracias!</p>}
        {esCliente && puedo?.motivo === 'no_compraste' && (
          <p className="mt-2 text-sm text-tinta/60">Solo pueden opinar quienes compraron este producto (en la web o en la tienda con su celular).</p>
        )}

        <ul className="mt-2 grid gap-3 sm:grid-cols-2">
          {p.resenas.map((r, i) => (
            <li key={r.id ?? i} className="rounded-xl border border-tinta/10 bg-superficie p-4 text-sm">
              <p className="font-semibold">
                {r.nombre} <span className="text-rosa">{'★'.repeat(r.estrellas)}</span>
                {r.verificada && <span className="ml-2 rounded bg-green-500/15 px-1.5 text-xs font-normal text-ok">✓ Compra verificada</span>}
              </p>
              <p className="mt-1 text-tinta/80">{r.texto}</p>
              {r.respuesta && <p className="mt-2 border-l-2 border-morado pl-2 text-tinta/60">Tienda: {r.respuesta}</p>}
              {/* La tienda responde las reseñas que aún no tienen respuesta */}
              {esEquipo && !r.respuesta && r.id && (
                <div className="mt-2 flex gap-2">
                  <input placeholder="Responder como tienda" value={respuestas[r.id] || ''}
                    onChange={(e) => setRespuestas({ ...respuestas, [r.id]: e.target.value })}
                    className="flex-1 rounded-lg border border-tinta/15 bg-fondo px-2 py-1" />
                  <button onClick={() => responder(r.id)} disabled={(respuestas[r.id] || '').length < 5}
                    className="rounded-lg border border-rosa px-3 py-1 text-rosa disabled:opacity-40">Responder</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {parecidos.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">También te puede gustar</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {parecidos.map((x) => <li key={x.id}><TarjetaProducto p={x} /></li>)}
          </ul>
        </section>
      )}
    </article>
  )
}