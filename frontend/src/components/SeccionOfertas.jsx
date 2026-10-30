// HU-23: sección "Ofertas" con las que vencen más pronto primero, en un carrusel con flechas.
// Se usa en la página de inicio (HU-22).
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import TarjetaOferta, { faltan } from './TarjetaOferta.jsx'

// Solo las ofertas que siguen vigentes, de la que termina antes a la que termina después
export const ordenarOfertas = (productos) => productos
  .filter((p) => p.descuento && p.oferta_termina && faltan(p) > 0)
  .sort((a, b) => new Date(a.oferta_termina) - new Date(b.oferta_termina))

// HU-22: si la página ya trajo los productos (Inicio), se los pasa y no se vuelven a pedir al servidor
export default function SeccionOfertas({ productos }) {
  const [ofertas, setOfertas] = useState([])
  const carrusel = useRef(null)
  useEffect(() => {
    if (productos) setOfertas(ordenarOfertas(productos))
    else api('/productos').then((ps) => setOfertas(ordenarOfertas(ps))).catch(() => {})
  }, [productos])
  const quitar = (p) => setOfertas((os) => os.filter((o) => o.id !== p.id)) // cuando su contador llega a cero
  // Las flechas mueven el carrusel el ancho de una tarjeta
  const mover = (lado) => carrusel.current?.scrollBy({ left: lado * carrusel.current.clientWidth * 0.9, behavior: 'smooth' })

  if (ofertas.length === 0) return null
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold">⚡ Ofertas</h2>
          <p className="text-sm text-tinta/60">Las que vencen más pronto primero</p>
        </div>
        <Link to="/ofertas" className="text-sm font-semibold text-rosa hover:underline">Ver todas las ofertas →</Link>
      </div>
      <div className="relative">
        <button type="button" onClick={() => mover(-1)} aria-label="Ofertas anteriores"
          className="absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-rosa text-xl text-white shadow-lg sm:grid">‹</button>
        <ul ref={carrusel} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none]">
          {ofertas.map((p) => (
            <li key={p.id} className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)]">
              <TarjetaOferta p={p} onTermina={quitar} />
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => mover(1)} aria-label="Más ofertas"
          className="absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-rosa text-xl text-white shadow-lg sm:grid">›</button>
      </div>
    </section>
  )
}
