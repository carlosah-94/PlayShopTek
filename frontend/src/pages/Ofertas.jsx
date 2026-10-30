// HU-23: página "Ofertas" con todas las ofertas vigentes y su contador.
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { ordenarOfertas } from '../components/SeccionOfertas.jsx'
import TarjetaOferta from '../components/TarjetaOferta.jsx'

export default function Ofertas() {
  const [ofertas, setOfertas] = useState(null) // null = todavía cargando
  const [error, setError] = useState('')
  useEffect(() => { api('/productos').then((ps) => setOfertas(ordenarOfertas(ps))).catch((e) => setError(e.message)) }, [])
  const quitar = (p) => setOfertas((os) => os.filter((o) => o.id !== p.id))

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">⚡ Ofertas por tiempo limitado</h1>
        <p className="mt-1 text-sm text-tinta/60">Precios rebajados por pocos días. Las que vencen más pronto van primero.</p>
      </div>
      {error && <p className="rounded-lg bg-red-500/15 p-3 text-sm text-error">{error}</p>}
      {ofertas === null && !error && <p className="text-sm text-tinta/60">Cargando ofertas… La primera visita del día puede tardar hasta 1 minuto.</p>}
      {ofertas?.length === 0 && <p className="text-tinta/60">Por ahora no hay ofertas. ¡Vuelve pronto!</p>}
      <h2 className="sr-only">Productos en oferta</h2>
      <ul className="grid gap-4 md:grid-cols-2">
        {ofertas?.map((p) => <li key={p.id}><TarjetaOferta p={p} onTermina={quitar} /></li>)}
      </ul>
    </section>
  )
}
