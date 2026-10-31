// HU-23: página "Ofertas" con todas las ofertas vigentes y su contador.
// HU-25: como el prototipo: filtros a la izquierda y las ofertas en grilla, con "Ordenar por".
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import FiltrosCatalogo, { pasa } from '../components/FiltrosCatalogo.jsx'
import { ordenarOfertas } from '../components/SeccionOfertas.jsx'
import TarjetaOferta from '../components/TarjetaOferta.jsx'

const CLAVES = ['categoria', 'disp', 'genero', 'estado', 'plataforma', 'sub', 'origen']
const ORDENES = [['termina', 'Las que terminan antes'], ['descuento', 'Mayor descuento'], ['precio', 'Precio: menor a mayor']]

export default function Ofertas() {
  const [parametros, setParametros] = useSearchParams()
  const v = Object.fromEntries(CLAVES.map((k) => [k, parametros.get(k) || '']))
  const orden = parametros.get('orden') || 'termina'
  const [ofertas, setOfertas] = useState(null) // null = todavía cargando
  const [generos, setGeneros] = useState({})
  const [error, setError] = useState('')
  useEffect(() => {
    api('/productos').then((ps) => setOfertas(ordenarOfertas(ps))).catch((e) => setError(e.message))
    api('/generos').then((gs) => setGeneros(Object.fromEntries(gs.map((g) => [g.id, g.nombre])))).catch(() => {})
  }, [])
  const quitar = (p) => setOfertas((os) => os.filter((o) => o.id !== p.id)) // cuando su contador llega a cero

  const poner = (cambios) => {
    const nuevo = new URLSearchParams(parametros)
    Object.entries(cambios).forEach(([k, valor]) => (valor ? nuevo.set(k, valor) : nuevo.delete(k)))
    setParametros(nuevo, { replace: true })
  }
  const visibles = (ofertas || []).filter((p) => pasa(p, v)).sort((a, b) =>
    orden === 'descuento' ? b.descuento - a.descuento : orden === 'precio' ? a.precio_final - b.precio_final
      : new Date(a.oferta_termina) - new Date(b.oferta_termina))

  return (
    <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <FiltrosCatalogo productos={ofertas || []} v={v} poner={poner} limpiar={() => setParametros({}, { replace: true })} generos={generos} />
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rosa">⚡ Por tiempo limitado</p>
            <h1 className="text-3xl font-semibold">Ofertas</h1>
            <p className="mt-1 text-sm text-tinta/60">{ofertas ? `${visibles.length} productos con descuento por tiempo limitado` : 'Cargando ofertas… La primera visita del día puede tardar hasta 1 minuto.'}</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-tinta/70">Ordenar por
            <select id="ofertas-orden" value={orden} onChange={(e) => poner({ orden: e.target.value === 'termina' ? '' : e.target.value })}
              className="rounded-lg border border-tinta/15 bg-superficie px-3 py-2 text-sm text-tinta">
              {ORDENES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </label>
        </div>
        {error && <p className="rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
        {ofertas?.length === 0 && <p className="text-tinta/60">Por ahora no hay ofertas. ¡Vuelve pronto!</p>}
        {ofertas?.length > 0 && visibles.length === 0 && <p className="text-tinta/60">No hay ofertas con esos filtros.</p>}
        <h2 className="sr-only">Productos en oferta</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visibles.map((p) => <li key={p.id}><TarjetaOferta p={p} onTermina={quitar} vertical /></li>)}
        </ul>
      </section>
    </div>
  )
}
