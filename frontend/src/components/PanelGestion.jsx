// HU-24: "Panel de gestión" del prototipo. Ángel y Linda trabajan aquí, con un menú oscuro a la izquierda
// en vez de la cabecera de la tienda. Cada uno ve solo las secciones que le corresponden.
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { api } from '../api.js'
import Icono from './Iconos.jsx'

// [ruta, nombre, ícono, quién la ve]
const SECCIONES = [
  ['/panel', 'Tablero', 'tablero', 'todos'],
  ['/vender', 'Ventas', 'ventas', 'todos'],
  ['/taller', 'Reparaciones', 'llave', 'todos'],
  ['/resenas', 'Reseñas', 'estrella', 'todos'],
  ['/inventario', 'Inventario', 'paquete', 'dueno'],
  ['/banners', 'Banners de inicio', 'imagen', 'dueno'],
  ['/equipo', 'Mi equipo', 'equipo', 'dueno'],
  ['/servicios-tecnicos', 'Servicios técnicos', 'ajustes', 'dueno'],
  ['/reclamos', 'Reclamos', 'libro', 'todos'],
]
// Rutas que se muestran dentro del panel (las usa App.jsx para decidir qué diseño poner)
export const RUTAS_PANEL = [...SECCIONES.map((s) => s[0]), '/tablero']

const ROL = { dueno: 'Dueño · técnico y vendedor', trabajadora: 'Trabajadora · vendedora y técnica' }

export default function PanelGestion({ usuario, tema, setTema, salir, children }) {
  const [abierto, setAbierto] = useState(false) // menú en celular
  const { pathname } = useLocation()
  useEffect(() => setAbierto(false), [pathname]) // al elegir una sección, el menú del celular se cierra
  // Número rosa junto a "Reparaciones": equipos listos para recoger (se actualiza al cambiar de sección)
  const [listos, setListos] = useState(0)
  useEffect(() => {
    api('/reparaciones').then((rs) => setListos(rs.filter((r) => r.estado === 'listo_para_recoger').length)).catch(() => {})
  }, [pathname])
  const visibles = SECCIONES.filter((s) => s[3] === 'todos' || s[3] === usuario.rol)
  const nombre = usuario.nombre.split(' ')[0]

  const boton = 'flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/10'
  const menu = (
    <nav aria-label="Secciones del panel" className="flex h-full flex-col gap-1 p-4">
      <Link to="/panel" className="mb-4 flex items-center gap-3">
        <img src="/logo.jpg" alt="" className="h-10 w-10 rounded-full object-cover" />
        <span className="leading-tight">
          <span className="block font-titulo text-base font-semibold">PLAY SHOP TEK</span>
          <span className="block text-[11px] uppercase tracking-[0.14em] text-[#cfc7ff]">Panel de gestión</span>
        </span>
      </Link>
      {visibles.map(([ruta, texto, icono]) => (
        <NavLink key={ruta} to={ruta} end
          className={({ isActive }) => 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ' +
            (isActive ? 'border border-rosa/50 bg-rosa/25 font-semibold' : 'border border-transparent text-white/85 hover:bg-white/10')}>
          <Icono nombre={icono} tam={18} /> <span className="flex-1">{texto}</span>
          {ruta === '/taller' && listos > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rosa px-1.5 text-xs font-semibold">{listos}<span className="sr-only"> listas para recoger</span></span>
          )}
        </NavLink>
      ))}

      <div className="mt-auto space-y-2 border-t border-white/10 pt-4">
        <div className="flex items-center gap-3 pb-1">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rosa to-morado font-semibold">{nombre[0]}</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">{nombre}</span>
            <span className="block text-xs text-white/65">{ROL[usuario.rol]}</span>
          </span>
        </div>
        <button type="button" onClick={() => setTema(tema === 'claro' ? 'oscuro' : 'claro')} className={boton}>
          <Icono nombre={tema === 'claro' ? 'luna' : 'sol'} tam={16} /> {tema === 'claro' ? 'Modo oscuro' : 'Modo claro'}
        </button>
        <Link to="/" className={boton}><Icono nombre="ojo" tam={16} /> Ver la tienda</Link>
        <button type="button" onClick={salir} className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-[#ff8fe4] hover:underline">
          <Icono nombre="salir" tam={16} /> Cerrar sesión
        </button>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* Computadora: menú fijo a la izquierda */}
      <aside className="hidden bg-noche text-white lg:sticky lg:top-0 lg:block lg:h-screen">{menu}</aside>

      {/* Celular: barra arriba con botón para abrir el menú */}
      <div className="sticky top-0 z-40 flex items-center gap-3 bg-noche px-4 py-3 text-white lg:hidden">
        <button type="button" onClick={() => setAbierto(true)} aria-label="Abrir el menú del panel" aria-expanded={abierto}
          className="grid h-9 w-9 place-items-center rounded-lg border border-white/15"><Icono nombre="lista" /></button>
        <span className="font-titulo font-semibold">Panel de gestión</span>
      </div>
      {abierto && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-72 max-w-[85%] overflow-y-auto bg-noche text-white">
            <div className="flex justify-end p-2">
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar el menú"
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"><Icono nombre="cerrar" /></button>
            </div>
            {menu}
          </div>
          <button type="button" aria-label="Cerrar el menú" onClick={() => setAbierto(false)} className="flex-1 bg-black/50" />
        </div>
      )}

      {/* En celular se avisa que el panel se usa mejor en computadora (igual que el prototipo) */}
      <main className="min-w-0 px-4 py-6 sm:px-8">
        <p className="mb-4 rounded-xl border border-aviso/30 bg-aviso/10 p-3 text-sm lg:hidden">
          El panel se usa mejor en laptop o computadora. En el celular puedes revisar y actualizar estados de reparación.
        </p>
        {children}
      </main>
    </div>
  )
}
