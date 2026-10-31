// HU-05: favoritos y avisos pendientes del cliente.
// HU-26: "Lista de deseados" con las mismas tarjetas del catálogo (como el prototipo). Las notificaciones pasaron a la campanita.
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'
import Icono from '../components/Iconos.jsx'
import { botonRosa } from '../components/PiezasPanel.jsx'
import TarjetaProducto from '../components/TarjetaProducto.jsx'

export default function Favoritos() {
  const sesion = leerSesion()
  const [favoritos, setFavoritos] = useState(null)
  const [avisos, setAvisos] = useState([])

  useEffect(() => {
    if (sesion?.usuario.rol !== 'cliente') return
    api('/mi/favoritos').then(setFavoritos).catch(() => setFavoritos([]))
    api('/mi/avisos').then(setAvisos).catch(() => {})
  }, [])
  if (sesion?.usuario.rol !== 'cliente') return <Navigate to="/login?volver=/favoritos" />

  // El corazón de la tarjeta quita el producto de la lista
  const quitar = async (p) => {
    await api('/mi/favoritos/' + p.id, { metodo: 'DELETE' })
    setFavoritos(favoritos.filter((f) => f.id !== p.id))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Lista de deseados</h1>
          <p className="mt-1 text-sm text-tinta/70">{favoritos ? `${favoritos.length} guardados · te avisamos si bajan de precio` : 'Cargando…'}</p>
        </div>
        <Link to="/catalogo" className="inline-flex items-center gap-2 rounded-lg border border-tinta/15 px-3 py-2 text-sm font-semibold hover:bg-tinta/5">
          <Icono nombre="mas" tam={15} /> Agregar más
        </Link>
      </div>

      {favoritos?.length === 0 && (
        <div className="grid place-items-center gap-3 rounded-2xl border border-tinta/10 bg-superficie p-10 text-center shadow-sm">
          <span className="text-rosa"><Icono nombre="corazon" tam={36} /></span>
          <p className="text-tinta/70">Aún no guardas productos. Toca el corazón de cualquier producto para verlo aquí.</p>
          <Link to="/catalogo" className={botonRosa}>Ir al catálogo</Link>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {favoritos?.map((p) => <li key={p.id}><TarjetaProducto p={p} favorito onFavorito={quitar} /></li>)}
      </ul>

      {avisos.length > 0 && (
        <section className="rounded-2xl border border-tinta/10 bg-superficie p-5 shadow-sm">
          <h2 className="text-lg font-medium">Esperando que llegue</h2>
          <p className="text-sm text-tinta/70">Te avisamos en la campanita apenas vuelva a haber stock.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {avisos.map((a) => <li key={a.producto_id}><Link to={'/producto/' + a.producto_id} className="inline-block rounded-full border border-morado/30 px-3 py-1 text-sm hover:bg-morado/10">{a.nombre}</Link></li>)}
          </ul>
        </section>
      )}
    </div>
  )
}
