// HU-26: campanita de notificaciones y menú de la cuenta (círculo con las iniciales), como el prototipo.
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api.js'
import Icono from './Iconos.jsx'

const botonIcono = 'relative grid h-9 w-9 place-items-center rounded-lg border border-white/15 hover:bg-white/10'
const globo = 'absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs font-semibold'
// A qué página lleva cada notificación según su "destino"
const DESTINO = { reparaciones: '/mis-reparaciones', 'mis-compras': '/mis-compras' }

// Cierra el menú al hacer clic fuera de él o al presionar Escape
function useCerrarFuera(abierto, setAbierto) {
  const caja = useRef(null)
  useEffect(() => {
    if (!abierto) return
    const clic = (e) => { if (!caja.current?.contains(e.target)) setAbierto(false) }
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', clic)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', clic); document.removeEventListener('keydown', tecla) }
  }, [abierto])
  return caja
}

export function Notificaciones() {
  const [lista, setLista] = useState([])
  const [abierto, setAbierto] = useState(false)
  const { pathname } = useLocation()
  const caja = useCerrarFuera(abierto, setAbierto)
  // Se vuelve a consultar al cambiar de página (así llegan los avisos nuevos sin recargar)
  useEffect(() => { api('/mi/notificaciones').then(setLista).catch(() => {}); setAbierto(false) }, [pathname])
  const sinLeer = lista.filter((n) => !n.leida).length
  const marcarLeidas = async () => {
    await api('/mi/notificaciones/leidas', { metodo: 'POST' }).catch(() => {})
    setLista(lista.map((n) => ({ ...n, leida: true })))
  }

  return (
    <div className="relative" ref={caja}>
      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-label={'Notificaciones, ' + sinLeer + ' sin leer'} className={botonIcono}>
        <Icono nombre="campana" />
        {sinLeer > 0 && <span className={globo + ' bg-rosa'}>{sinLeer}</span>}
      </button>
      {abierto && (
        <div className="absolute right-0 top-11 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#2a1268] text-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="font-medium">Notificaciones</p>
            {sinLeer > 0 && <button type="button" onClick={marcarLeidas} className="text-sm font-semibold text-[#ff8fe4] hover:underline">Marcar leídas</button>}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {lista.map((n) => {
              const a = n.destino?.startsWith('/') ? n.destino : DESTINO[n.destino]
              const contenido = (
                <>
                  <span className={'mt-0.5 ' + (n.leida ? 'text-white/50' : 'text-[#ff8fe4]')}><Icono nombre="campana" tam={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className={'block text-sm ' + (n.leida ? 'text-white/80' : 'font-semibold')}>{n.titulo}</span>
                    {n.detalle && <span className="block text-xs text-white/70">{n.detalle}</span>}
                  </span>
                </>
              )
              return (
                <li key={n.id} className="border-b border-white/5 last:border-0">
                  {a
                    ? <Link to={a} className="flex gap-3 px-4 py-3 hover:bg-white/10">{contenido}</Link>
                    : <div className="flex gap-3 px-4 py-3">{contenido}</div>}
                </li>
              )
            })}
            {lista.length === 0 && <li className="px-4 py-6 text-center text-sm text-white/70">No tienes notificaciones.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

export function MenuCuenta({ nombre, email, salir }) {
  const [abierto, setAbierto] = useState(false)
  const { pathname } = useLocation()
  const caja = useCerrarFuera(abierto, setAbierto)
  useEffect(() => setAbierto(false), [pathname])
  const iniciales = nombre.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()
  const opciones = [['/mi-cuenta', 'usuario', 'Mi cuenta'], ['/mis-compras', 'ventas', 'Mis pedidos'], ['/reparaciones', 'llave', 'Reparaciones'],
    ['/mis-reparaciones', 'historial', 'Mis reparaciones'], ['/favoritos', 'corazon', 'Favoritos']]

  return (
    <div className="relative" ref={caja}>
      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-label={'Menú de tu cuenta, ' + nombre}
        className="flex items-center gap-1 rounded-full border border-white/15 py-0.5 pl-0.5 pr-2 hover:bg-white/10">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-rosa to-morado text-xs font-semibold">{iniciales}</span>
        <Icono nombre="flechaAbajo" tam={14} />
      </button>
      {abierto && (
        <div className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#2a1268] text-white shadow-2xl">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="font-medium">{nombre}</p>
            <p className="truncate text-xs text-white/70">{email}</p>
          </div>
          <ul className="py-1 text-sm">
            {opciones.map(([a, ic, t]) => (
              <li key={a}><Link to={a} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/10"><Icono nombre={ic} tam={17} /> {t}</Link></li>
            ))}
          </ul>
          <button type="button" onClick={salir} className="flex w-full items-center gap-3 border-t border-white/10 px-4 py-3 text-sm hover:bg-white/10">
            <Icono nombre="salir" tam={17} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
