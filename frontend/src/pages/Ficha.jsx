// HU-02: ficha del producto con fotos, tráiler, precio, stock y reseñas.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import { agregarAlCarrito } from '../carrito.js'
import ReservaPreventa from '../components/ReservaPreventa.jsx'

const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE')
const MODOS = { solo: 'Un jugador', local: 'Multijugador local', online: 'En línea' }

// "https://www.youtube.com/watch?v=ABC" -> "https://www.youtube.com/embed/ABC"
function videoIncrustado(url) {
  const id = url && url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)
  return id ? 'https://www.youtube.com/embed/' + id[1] : null
}

export default function Ficha() {
  const { id } = useParams()
  const [p, setP] = useState(null)
  const [error, setError] = useState('')
  const [agregado, setAgregado] = useState(false)
  const [esFavorito, setEsFavorito] = useState(false)
  const [aviso, setAviso] = useState('')
  const [parecidos, setParecidos] = useState([])
  const esCliente = leerSesion()?.usuario.rol === 'cliente'

  useEffect(() => { api('/productos/' + id).then(setP).catch((e) => setError(e.message)) }, [id])
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

  if (error) return <p className="rounded-lg bg-red-500/15 p-3 text-sm text-red-300">{error}</p>
  if (!p) return <p className="text-white/60">Cargando...</p>

  const video = videoIncrustado(p.trailer_url)
  const incluye = [p.incluye_caja && 'Caja', p.incluye_manual && 'Manual', p.incluye_disco && 'Disco'].filter(Boolean)
  const disponibilidad = p.es_preventa ? 'Preventa' : p.stock > 0 ? p.stock + ' en stock' : 'Agotado'

  return (
    <article className="space-y-6">
      <Link to="/" className="text-sm text-white/60 hover:text-rosa">← Volver al catálogo</Link>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          {p.fotos.length
            ? <img src={p.fotos[0]} alt={p.nombre} className="aspect-[4/3] w-full rounded-xl object-cover" />
            : <div className="grid aspect-[4/3] place-items-center rounded-xl bg-superficie text-white/40">Foto pendiente</div>}
          {video && <iframe src={video} title={'Tráiler de ' + p.nombre} className="aspect-video w-full rounded-xl" allowFullScreen />}
        </div>

        <div className="space-y-4">
          <p className="text-xs uppercase tracking-wide text-white/50">{p.categoria} · {p.condicion}</p>
          <h1 className="text-2xl font-bold">{p.nombre}</h1>
          {p.calificacion && <p className="text-sm">★ {p.calificacion} · {p.total_resenas} reseñas</p>}

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{soles(p.precio_final)}</span>
            {p.descuento && <span className="text-white/50 line-through">{soles(p.precio)}</span>}
            {p.descuento && <span className="rounded bg-rosa px-1.5 text-sm font-semibold text-white">-{p.descuento}%</span>}
          </div>
          <p className={p.stock === 0 && !p.es_preventa ? 'text-red-300' : 'text-white/70'}>{disponibilidad}</p>
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
              <button onClick={alternarFavorito} className="rounded-lg border border-white/20 px-4 py-2">
                {esFavorito ? '♥ En tus favoritos' : '♡ Guardar en favoritos'}
              </button>
              {p.stock === 0 && !p.es_preventa && !aviso && (
                <button onClick={pedirAviso} className="rounded-lg border border-rosa px-4 py-2 text-rosa">Avísame cuando llegue</button>
              )}
              {aviso && <span className="text-green-300">{aviso}</span>}
            </div>
          ) : (
            <p className="text-sm text-white/50">
              <Link to={'/login?volver=/producto/' + id} className="text-rosa">Inicia sesión</Link> para guardar favoritos
              {p.stock === 0 && !p.es_preventa ? ' o pedir que te avisemos cuando llegue' : ''}.
            </p>
          )}

          {p.descripcion && <p className="text-white/80">{p.descripcion}</p>}

          <dl className="grid grid-cols-2 gap-2 text-sm">
            {incluye.length > 0 && <><dt className="text-white/50">Incluye</dt><dd>{incluye.join(', ')}</dd></>}
            {p.modos.length > 0 && <><dt className="text-white/50">Modos</dt><dd>{p.modos.map((m) => MODOS[m]).join(', ')}</dd></>}
            {p.color && <><dt className="text-white/50">Color</dt><dd>{p.color}</dd></>}
            {p.origen && <><dt className="text-white/50">Origen</dt><dd>{p.origen}</dd></>}
          </dl>
          <p className="text-sm text-white/50">Recojo en tienda: Av. Revolución 1420, Villa El Salvador.</p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Reseñas</h2>
        <ul className="mt-2 grid gap-3 sm:grid-cols-2">
          {p.resenas.map((r, i) => (
            <li key={i} className="rounded-xl border border-white/10 bg-superficie p-4 text-sm">
              <p className="font-semibold">{r.nombre} <span className="text-rosa">{'★'.repeat(r.estrellas)}</span></p>
              <p className="mt-1 text-white/80">{r.texto}</p>
              {r.respuesta && <p className="mt-2 border-l-2 border-morado pl-2 text-white/60">Tienda: {r.respuesta}</p>}
            </li>
          ))}
        </ul>
      </section>
      {parecidos.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">También te puede gustar</h2>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {parecidos.map((x) => (
              <li key={x.id}>
                <Link to={'/producto/' + x.id} className="block rounded-xl border border-white/10 bg-superficie p-4 text-sm hover:border-rosa">
                  <p className="text-xs text-white/50">{x.categoria}</p>
                  <p className="font-semibold">{x.nombre}</p>
                  <p className="mt-1">
                    {soles(x.precio_final)}
                    {x.descuento && <span className="ml-2 rounded bg-rosa px-1.5 text-xs text-white">-{x.descuento}%</span>}
                  </p>
                  <p className={x.stock > 0 ? 'text-xs text-white/60' : 'text-xs text-red-300'}>{x.stock > 0 ? x.stock + ' en stock' : 'Agotado'}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}