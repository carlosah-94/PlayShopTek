// HU-23: tarjeta de oferta como la del prototipo: foto, descuento, precio, "Ahorras", barra de stock
// y un contador DÍAS · HORAS · MIN · SEG que baja cada segundo hasta que la oferta termina.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { agregarAlCarrito } from '../carrito.js'
import { urlImagen } from '../api.js'
import Icono from './Iconos.jsx'

const soles = (n) => 'S/ ' + Number(n).toLocaleString('es-PE')
const etiqueta = (c) => (/^PS\d$/.test(c) ? 'Juegos ' + c : c)
const dos = (n) => String(n).padStart(2, '0')

// Cuántos milisegundos faltan para el final de la oferta (0 si ya pasó)
export const faltan = (p) => Math.max(new Date(p.oferta_termina) - Date.now(), 0)

export default function TarjetaOferta({ p, onTermina }) {
  const [resta, setResta] = useState(() => faltan(p))
  const [agregado, setAgregado] = useState(false)

  // Cada segundo recalcula cuánto falta. Es como un reloj de arena: cuando llega a cero, avisa
  useEffect(() => {
    const reloj = setInterval(() => {
      const r = faltan(p)
      setResta(r)
      if (r === 0) { clearInterval(reloj); onTermina?.(p) }
    }, 1000)
    return () => clearInterval(reloj) // al salir de la página se apaga el reloj
  }, [p])

  const seg = Math.floor(resta / 1000)
  const partes = [
    [Math.floor(seg / 86400), 'Días'], [Math.floor(seg / 3600) % 24, 'Horas'],
    [Math.floor(seg / 60) % 60, 'Min'], [seg % 60, 'Seg'],
  ]
  const ahorro = Number(p.precio) - Number(p.precio_final)
  const nivelStock = Math.min(p.stock / 10, 1) // la barra se llena con 10 o más unidades
  const anadir = () => { agregarAlCarrito(p); setAgregado(true); setTimeout(() => setAgregado(false), 1500) }

  return (
    <article className="grid h-full overflow-hidden rounded-2xl border border-rosa/30 bg-superficie shadow-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* HU-22: en celular la foto se limita a 14 rem de alto para que la oferta no ocupe toda la pantalla */}
      <Link to={'/producto/' + p.id} tabIndex={-1} className="relative block bg-white">
        {p.foto
          ? <img src={urlImagen(p.foto)} alt={p.nombre} loading="lazy" width="240" height="300" className="mx-auto aspect-[4/5] h-56 w-auto object-contain p-2 sm:h-full sm:w-full" />
          : <div className="grid aspect-[4/5] place-items-center text-sm text-[#5c5096]">Foto pendiente</div>}
        <span className="absolute left-2 top-2 rounded-full bg-rosa px-2 py-0.5 text-sm font-semibold text-white">-{p.descuento}%</span>
      </Link>

      <div className="flex flex-col gap-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-morado">{etiqueta(p.categoria)}</p>
        <h3 className="font-semibold leading-snug">
          <Link to={'/producto/' + p.id} className="hover:text-rosa">{p.nombre}</Link>
        </h3>
        <p className="flex items-baseline gap-2">
          <span className="font-titulo text-2xl font-semibold text-rosa">{soles(p.precio_final)}</span>
          <span className="text-sm text-tinta/60 line-through">{soles(p.precio)}</span>
        </p>
        <p className="text-sm text-ok">Ahorras {soles(ahorro)}</p>

        <div>
          <p className="text-xs text-tinta/70">Stock: {p.stock}</p>
          <div className="mt-1 h-1.5 rounded-full bg-tinta/10" role="presentation">
            <div className="h-full rounded-full bg-gradient-to-r from-morado to-rosa" style={{ width: nivelStock * 100 + '%' }} />
          </div>
        </div>

        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-aviso">⏱ La oferta termina en</p>
        <div className="grid grid-cols-4 gap-1.5 text-center" role="timer" aria-label={`Quedan ${partes[0][0]} días, ${partes[1][0]} horas y ${partes[2][0]} minutos`}>
          {partes.map(([n, nombre]) => (
            <div key={nombre} className="rounded-lg border border-tinta/10 py-1.5">
              <p className="font-titulo text-lg font-semibold tabular-nums">{dos(n)}</p>
              <p className="text-[10px] uppercase tracking-wide text-tinta/60">{nombre}</p>
            </div>
          ))}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
          <Link to={'/producto/' + p.id} className="rounded-lg border border-tinta/15 py-2 text-center text-sm hover:bg-tinta/5">Ver</Link>
          {p.stock > 0 && (
            <button type="button" onClick={anadir} className="flex items-center justify-center gap-1 rounded-lg bg-rosa py-2 text-sm font-semibold text-white">
              <Icono nombre="carrito" tam={16} /> {agregado ? '¡Listo!' : 'Añadir'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
