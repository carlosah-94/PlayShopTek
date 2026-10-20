// Panel del equipo: cada perfil ve solo lo suyo.
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, leerSesion } from '../api.js'

export default function Panel() {
  const sesion = leerSesion()
  const [stockBajo, setStockBajo] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (sesion && sesion.usuario.rol !== 'cliente') api('/productos/stock-bajo').then(setStockBajo).catch((e) => setError(e.message))
  }, [])

  if (!sesion || sesion.usuario.rol === 'cliente') return <Navigate to="/login" />
  const esDueno = sesion.usuario.rol === 'dueno'

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Hola, {sesion.usuario.nombre.split(' ')[0]}</h1>
        <p className="text-sm text-white/60">{esDueno ? 'Dueño · acceso total' : 'Trabajadora · taller, stock bajo y reseñas'}</p>
      </div>

      {esDueno
        ? <p className="rounded-lg border border-morado/50 bg-morado/10 p-3 text-sm">Aquí irán el tablero de ventas, el resumen inteligente, el inventario con precios y Mi equipo.</p>
        : <p className="rounded-lg border border-white/15 p-3 text-sm text-white/70">Tu perfil no ve las ventas totales ni puede cambiar precios.</p>}

      <div className="rounded-xl border border-white/10 bg-superficie p-4">
        <h2 className="font-semibold">Stock bajo</h2>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <ul className="mt-2 divide-y divide-white/10 text-sm">
          {stockBajo.map((p) => (
            <li key={p.id} className="flex justify-between py-2">
              <span>{p.nombre}</span>
              <span className={p.stock === 0 ? 'text-red-300' : 'text-white/70'}>{p.stock === 0 ? 'Agotado' : 'Quedan ' + p.stock}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}