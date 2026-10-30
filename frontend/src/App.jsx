import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Asistente from './components/Asistente.jsx'
import Icono from './components/Iconos.jsx'
import PanelGestion, { RUTAS_PANEL } from './components/PanelGestion.jsx'
import Banners from './pages/Banners.jsx'
import Carrito from './pages/Carrito.jsx'
import Catalogo from './pages/Catalogo.jsx'
import Favoritos from './pages/Favoritos.jsx'
import Ficha from './pages/Ficha.jsx'
import Inicio from './pages/Inicio.jsx'
import Inventario from './pages/Inventario.jsx'
import LibroReclamaciones from './pages/LibroReclamaciones.jsx'
import Login from './pages/Login.jsx'
import MiEquipo from './pages/MiEquipo.jsx'
import MisCompras from './pages/MisCompras.jsx'
import Ofertas from './pages/Ofertas.jsx'
import Panel from './pages/Panel.jsx'
import Rastreo from './pages/Rastreo.jsx'
import Reclamos from './pages/Reclamos.jsx'
import Resenas from './pages/Resenas.jsx'
import ServiciosTecnicos from './pages/ServiciosTecnicos.jsx'
import Taller from './pages/Taller.jsx'
import VentaTienda from './pages/VentaTienda.jsx'
import { cerrarSesion, leerSesion } from './api.js'
import { leerCarrito, unidades } from './carrito.js'

const WHATSAPP = 'https://wa.me/51915152886?text=' + encodeURIComponent('Hola Play Shop Tek, quiero hacer una consulta.')
const enlace = ({ isActive }) => (isActive ? 'text-[#ff8fe4]' : 'hover:text-[#ff8fe4]')
const botonIcono = 'relative grid h-9 w-9 place-items-center rounded-lg border border-white/15 hover:bg-white/10'

export default function App() {
  const sesion = leerSesion()
  const rol = sesion?.usuario.rol
  const navegar = useNavigate()
  const salir = () => { cerrarSesion(); navegar('/') }
  // Contador del carrito: se actualiza cada vez que carrito.js avisa un cambio
  const [enCarrito, setEnCarrito] = useState(unidades(leerCarrito()))
  useEffect(() => {
    const actualizar = () => setEnCarrito(unidades(leerCarrito()))
    window.addEventListener('carrito', actualizar)
    return () => window.removeEventListener('carrito', actualizar)
  }, [])

  // HU-20: modo claro u oscuro. Se recuerda en el navegador para la próxima visita
  const [tema, setTema] = useState(() => localStorage.getItem('tema') || 'claro')
  useEffect(() => {
    document.documentElement.dataset.tema = tema
    localStorage.setItem('tema', tema)
  }, [tema])

  // HU-20: el buscador de la cabecera lleva al catálogo con lo que se escribió
  const [buscar, setBuscar] = useState('')
  const enviarBusqueda = (e) => {
    e.preventDefault()
    navegar('/catalogo?q=' + encodeURIComponent(buscar.trim()))
  }

  // HU-24: las páginas del equipo van dentro del "Panel de gestión" (menú a la izquierda, sin la cabecera de la tienda)
  const { pathname } = useLocation()
  const rutas = (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/catalogo" element={<Catalogo />} />
      <Route path="/ofertas" element={<Ofertas />} />
      <Route path="/producto/:id" element={<Ficha />} />
      <Route path="/rastreo" element={<Rastreo />} />
      <Route path="/carrito" element={<Carrito />} />
      <Route path="/mis-compras" element={<MisCompras />} />
      <Route path="/favoritos" element={<Favoritos />} />
      <Route path="/login" element={<Login />} />
      <Route path="/panel" element={<Panel />} />
      <Route path="/taller" element={<Taller />} />
      <Route path="/vender" element={<VentaTienda />} />
      <Route path="/inventario" element={<Inventario />} />
      <Route path="/tablero" element={<Navigate to="/panel" replace />} />
      <Route path="/resenas" element={<Resenas />} />
      <Route path="/banners" element={<Banners />} />
      <Route path="/equipo" element={<MiEquipo />} />
      <Route path="/servicios-tecnicos" element={<ServiciosTecnicos />} />
      <Route path="/libro-de-reclamaciones" element={<LibroReclamaciones />} />
      <Route path="/reclamos" element={<Reclamos />} />
    </Routes>
  )
  if (sesion && rol !== 'cliente' && RUTAS_PANEL.some((r) => pathname.startsWith(r))) {
    return <PanelGestion usuario={sesion.usuario} tema={tema} setTema={setTema} salir={salir}>{rutas}</PanelGestion>
  }

  return (
    <div className="min-h-screen">
      <header className="z-40 bg-noche lg:sticky lg:top-0 text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-8">
          <Link to="/" className="flex items-center gap-2 font-titulo text-lg font-semibold tracking-wide">
            <img src="/logo.jpg" alt="" className="h-10 w-10 rounded-full object-cover" />
            PLAY SHOP TEK
          </Link>
          <nav className="flex gap-4 text-sm">
            <NavLink to="/" end className={enlace}>Inicio</NavLink>
            <NavLink to="/catalogo" className={enlace}>Catálogo</NavLink>
            <NavLink to="/ofertas" className={enlace}>⚡ Ofertas</NavLink>
            <NavLink to="/rastreo" className={enlace}>Reparaciones</NavLink>
          </nav>
          <form onSubmit={enviarBusqueda} role="search" className="order-last flex w-full items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 lg:order-none lg:w-auto lg:flex-1">
            <Icono nombre="buscar" tam={16} />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar: DualSense, FIFA 26, PS5…"
              aria-label="Buscar productos" className="w-full bg-transparent py-2 text-sm text-white placeholder:text-white/60 focus:outline-none" />
          </form>
          <div className="ml-auto flex items-center gap-2">
            {rol === 'cliente' && <Link to="/favoritos" className={botonIcono} aria-label="Favoritos"><Icono nombre="corazon" /></Link>}
            <button type="button" onClick={() => setTema(tema === 'claro' ? 'oscuro' : 'claro')} className={botonIcono}
              aria-label={tema === 'claro' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}>
              <Icono nombre={tema === 'claro' ? 'luna' : 'sol'} />
            </button>
            <Link to="/carrito" className={botonIcono} aria-label={'Carrito, ' + enCarrito + ' productos'}>
              <Icono nombre="carrito" />
              {enCarrito > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rosa px-1 text-xs font-semibold">{enCarrito}</span>}
            </Link>
            {sesion
              ? <button type="button" onClick={salir} className="rounded-lg border border-white/20 px-3 py-2 text-sm">Salir ({sesion.usuario.nombre.split(' ')[0]})</button>
              : <Link to="/login" className="flex items-center gap-2 rounded-lg border border-[#ff8fe4] px-3 py-2 text-sm font-semibold hover:bg-white/10">
                  <Icono nombre="entrar" tam={16} /> Iniciar sesión
                </Link>}
          </div>
        </div>
        {/* HU-24: Ángel y Linda vuelven a su panel desde la tienda */}
        {sesion && rol !== 'cliente' && (
          <nav className="border-t border-white/10 bg-white/5">
            <div className="mx-auto flex max-w-6xl px-4 py-2 text-sm sm:px-8">
              <Link to="/panel" className="flex items-center gap-2 hover:text-[#ff8fe4]"><Icono nombre="tablero" tam={16} /> Ir al panel de gestión</Link>
            </div>
          </nav>
        )}
        {rol === 'cliente' && (
          <nav className="border-t border-white/10 bg-white/5">
            <div className="mx-auto flex max-w-6xl gap-5 px-4 py-2 text-sm sm:px-8">
              <NavLink to="/mis-compras" className={enlace}>Mis compras</NavLink>
              <NavLink to="/favoritos" className={enlace}>Favoritos</NavLink>
            </div>
          </nav>
        )}
      </header>

      {/* TT-03: alto mínimo para que el pie de página no "salte" mientras carga el catálogo */}
      <main className="mx-auto min-h-[75vh] max-w-6xl px-4 py-6 sm:px-8">
        {rutas}
      </main>

      <footer className="mt-10 bg-noche text-sm text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-8">
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-titulo text-base font-semibold">
              <img src="/logo.jpg" alt="" className="h-9 w-9 rounded-full object-cover" /> PLAY SHOP TEK
            </p>
            <p className="text-white/70">Videojuegos, consolas y servicio técnico en Villa El Salvador.</p>
            <div className="flex gap-3">
              <a href="https://www.facebook.com/PlayShopTek/" target="_blank" rel="noreferrer" className="underline hover:text-[#ff8fe4]">Facebook</a>
              <a href="https://www.instagram.com/play_shop_tek/" target="_blank" rel="noreferrer" className="underline hover:text-[#ff8fe4]">Instagram</a>
              <a href="https://www.tiktok.com/@playshoptek" target="_blank" rel="noreferrer" className="underline hover:text-[#ff8fe4]">TikTok</a>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#cfc7ff]">Ubícanos</p>
            <p>Av. Revolución 1420, Villa El Salvador, Lima Sur</p>
            <p className="text-white/70">Lunes a sábado 12:00–20:00 · Domingo 15:00–20:00</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#cfc7ff]">Información al cliente</p>
            <p><Link to="/rastreo" className="hover:text-[#ff8fe4]">Rastrea tu reparación</Link></p>
            {/* La ley pide que el Libro de Reclamaciones se vea en la página principal */}
            <p><Link to="/libro-de-reclamaciones" className="hover:text-[#ff8fe4]">📕 Libro de Reclamaciones</Link></p>
          </div>
        </div>
        <p className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/60">© 2026 Play Shop Tek · Villa El Salvador, Lima Sur</p>
      </footer>

      {/* HU-20: botón flotante de WhatsApp (el asistente queda encima) */}
      <a href={WHATSAPP} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp"
        className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#1f9d55] text-white shadow-lg hover:bg-[#17803f]">
        <Icono nombre="whatsapp" tam={28} />
      </a>
      <Asistente />
    </div>
  )
}
