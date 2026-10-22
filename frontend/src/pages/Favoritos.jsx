// HU-05: favoritos, avisos pendientes y notificaciones del cliente.
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'

const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE')

export default function Favoritos() {
  const sesion = leerSesion()
  const [favoritos, setFavoritos] = useState([])
  const [avisos, setAvisos] = useState([])
  const [notificaciones, setNotificaciones] = useState([])

  useEffect(() => {
    if (sesion?.usuario.rol !== 'cliente') return
    api('/mi/favoritos').then(setFavoritos)
    api('/mi/avisos').then(setAvisos)
    // Se muestran y luego se marcan como leídas (como cuando abres un chat)
    api('/mi/notificaciones').then((ns) => { setNotificaciones(ns); api('/mi/notificaciones/leidas', { metodo: 'POST' }) })
  }, [])

  if (sesion?.usuario.rol !== 'cliente') return <Navigate to="/login?volver=/favoritos" />

  const quitar = async (id) => {
    await api('/mi/favoritos/' + id, { metodo: 'DELETE' })
    setFavoritos(favoritos.filter((f) => f.id !== id))
  }

  return (
    <section className="space-y-6">
      {notificaciones.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold">Notificaciones</h2>
          <ul className="mt-2 space-y-2">
            {notificaciones.map((n) => (
              <li key={n.id} className={'rounded-lg border p-3 text-sm ' + (n.leida ? 'border-white/10' : 'border-rosa/60 bg-rosa/10')}>
                <p className="font-semibold">{n.titulo}</p>
                {n.detalle && <p className="text-white/70">{n.detalle}</p>}
                {n.destino?.startsWith('/producto/') && <Link to={n.destino} className="text-rosa">Ver producto</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold">Mis favoritos</h1>
        {favoritos.length === 0 && <p className="mt-2 text-white/60">Aún no guardas productos. Usa ♡ en la ficha de un producto.</p>}
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {favoritos.map((p) => (
            <li key={p.id} className="rounded-xl border border-white/10 bg-superficie p-4">
              <Link to={'/producto/' + p.id} className="font-semibold hover:text-rosa">{p.nombre}</Link>
              <p className="mt-1">{soles(p.precio_final)} {p.descuento && <span className="text-xs text-rosa">-{p.descuento}%</span>}</p>
              <p className="text-sm text-white/60">{p.stock > 0 ? p.stock + ' en stock' : 'Agotado'}</p>
              <button onClick={() => quitar(p.id)} className="mt-2 text-xs text-white/50 hover:text-red-300">Quitar</button>
            </li>
          ))}
        </ul>
      </div>

      {avisos.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold">Esperando que llegue</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-white/80">
            {avisos.map((a) => <li key={a.nombre}>{a.nombre}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}