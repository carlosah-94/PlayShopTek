// HU-21: tarjeta de producto como la del prototipo: foto, categoría, nombre, estrellas, stock, precio y botones.
// Se usa en el catálogo, en "También te puede gustar" y en la página de inicio.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { agregarAlCarrito } from '../carrito.js'
import { urlImagen } from '../api.js'
import Icono from './Iconos.jsx'

const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE')
// "PS5" se muestra como "Juegos PS5"; "Mandos", "Máquinas"... quedan igual
// HU-25: "quedan 3 días" / "último día" de la oferta
const quedan = (fin) => {
  const dias = Math.ceil((new Date(fin) - Date.now()) / 86400000)
  return dias <= 1 ? 'último día' : 'quedan ' + dias + ' días'
}
const etiqueta = (c) => (/^PS\d$/.test(c) ? 'Juegos ' + c : c)

export default function TarjetaProducto({ p, favorito = false, onFavorito }) {
  const [agregado, setAgregado] = useState(false)
  const sePuedeComprar = !p.es_preventa && p.stock > 0
  const anadir = () => {
    agregarAlCarrito(p)
    setAgregado(true)
    setTimeout(() => setAgregado(false), 1500)
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-tinta/10 bg-superficie shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative">
        <Link to={'/producto/' + p.id} tabIndex={-1}>
          {/* HU-25: como el prototipo: la foto vertical sobre una franja lila suave */}
          {p.foto
            ? <div className="bg-morado/10 px-3 pt-6 pb-3"><img src={urlImagen(p.foto)} alt={p.nombre} loading="lazy" width="300" height="340" className="aspect-[7/8] w-full object-contain" /></div>
            : <div className="grid aspect-[4/5] place-items-center bg-morado/10 text-sm text-tinta/60">Foto pendiente</div>}
        </Link>
        {p.descuento && <span className="absolute left-2 top-2 rounded-full bg-rosa px-2 py-0.5 text-xs font-semibold text-white">-{p.descuento}%</span>}
        {onFavorito && (
          <button type="button" onClick={() => onFavorito(p)} aria-pressed={favorito}
            aria-label={(favorito ? 'Quitar de favoritos: ' : 'Guardar en favoritos: ') + p.nombre}
            className={'absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-lg bg-white/90 shadow ' + (favorito ? 'text-rosa' : 'text-[#5c5096]')}>
            <Icono nombre="corazon" tam={18} />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 bg-gradient-to-b from-rosa/5 to-morado/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-morado">{etiqueta(p.categoria)}</p>
        <h3 className="font-semibold leading-snug">
          <Link to={'/producto/' + p.id} className="hover:text-rosa">{p.nombre}</Link>
        </h3>
        <p className="text-xs text-tinta/70">{[p.condicion || 'Nuevo', p.incluye, p.origen && (p.origen === 'Original' ? 'Original Sony' : 'Genérico')].filter(Boolean).join(' · ')}</p>
        <p className="mt-1 text-xs text-tinta/70">
          {p.calificacion && <span><span className="text-[#b07800]">★</span> {p.calificacion} · </span>}
          {p.es_preventa ? 'Preventa' : p.stock > 0 ? p.stock + ' en stock' : <span className="text-error">Agotado</span>}
        </p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
          <div>
            {p.descuento && (
              <p className="text-xs text-tinta/70"><span className="line-through">{soles(p.precio)}</span>
                {p.oferta_termina && <span className="ml-1.5 text-aviso">⏱ {quedan(p.oferta_termina)}</span>}</p>
            )}
            <p className="font-titulo text-xl font-semibold">{soles(p.precio_final)}</p>
          </div>
          <div className="flex gap-2">
            <Link to={'/producto/' + p.id} className="rounded-lg border border-tinta/15 px-3 py-1.5 text-sm hover:bg-tinta/5">Ver</Link>
            {sePuedeComprar && (
              <button type="button" onClick={anadir} className="flex items-center gap-1 rounded-lg bg-rosa px-3 py-1.5 text-sm font-semibold text-white">
                <Icono nombre="carrito" tam={16} /> {agregado ? '¡Listo!' : 'Añadir'}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
