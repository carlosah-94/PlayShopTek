import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Asistente from './components/Asistente.jsx'
import { PanelWhatsApp, useDesplegable } from './components/Asesores.jsx'
import Icono from './components/Iconos.jsx'
import { MenuCuenta, Notificaciones } from './components/MenusCliente.jsx'
import PanelGestion, { RUTAS_PANEL } from './components/PanelGestion.jsx'
import Carrito from './pages/Carrito.jsx'
import Catalogo from './pages/Catalogo.jsx'
import Favoritos from './pages/Favoritos.jsx'
import Ficha from './pages/Ficha.jsx'
import Inicio from './pages/Inicio.jsx'
import Login from './pages/Login.jsx'
import Ofertas from './pages/Ofertas.jsx'
import Rastreo from './pages/Rastreo.jsx'
import Reparaciones from './pages/Reparaciones.jsx'
import { api, cerrarSesion, leerSesion } from './api.js'
import { leerCarrito, unidades } from './carrito.js'

// Rendimiento: las páginas que se usan poco (panel del equipo, cuenta, pago, información) se descargan
// recién cuando alguien entra a ellas. Así el inicio, el catálogo y la ficha cargan más rápido en celular.
const Banners = lazy(() => import('./pages/Banners.jsx'))
const Encuesta = lazy(() => import('./pages/Encuesta.jsx'))
const Informacion = lazy(() => import('./pages/Informacion.jsx'))
const Inventario = lazy(() => import('./pages/Inventario.jsx'))
const LibroReclamaciones = lazy(() => import('./pages/LibroReclamaciones.jsx'))
const MiCuenta = lazy(() => import('./pages/MiCuenta.jsx'))
const MiEquipo = lazy(() => import('./pages/MiEquipo.jsx'))
const MiTienda = lazy(() => import('./pages/MiTienda.jsx'))
const MisCompras = lazy(() => import('./pages/MisCompras.jsx'))
const MisReparaciones = lazy(() => import('./pages/MisReparaciones.jsx'))
const Pago = lazy(() => import('./pages/Pago.jsx'))
const Panel = lazy(() => import('./pages/Panel.jsx'))
const Reclamos = lazy(() => import('./pages/Reclamos.jsx'))
const Resenas = lazy(() => import('./pages/Resenas.jsx'))
const ServiciosTecnicos = lazy(() => import('./pages/ServiciosTecnicos.jsx'))
const Taller = lazy(() => import('./pages/Taller.jsx'))
const VentaTienda = lazy(() => import('./pages/VentaTienda.jsx'))

function WhatsAppFlotante() {
  const [abierto, alternar, cerrar] = useDesplegable()
  return (
    <>
      {abierto && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={cerrar} aria-hidden="true" />
          <div className="fixed bottom-[9.75rem] right-5 z-[60] w-[min(320px,calc(100vw-40px))]">
            <PanelWhatsApp mensaje="Hola Play Shop Tek, quiero hacer una consulta." alCerrar={cerrar} conCerrar />
          </div>
        </>
      )}
      <button type="button" onClick={alternar} aria-expanded={abierto} aria-label={abierto ? 'Cerrar WhatsApp' : 'Escríbenos por WhatsApp'}
        className="fixed bottom-5 right-5 z-[56] grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg hover:bg-[#1fb857]">
        <Icono nombre={abierto ? 'cerrar' : 'whatsapp'} tam={abierto ? 26 : 30} />
      </button>
    </>
  )
}
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

  // HU-26: cuántos favoritos tiene (el número junto al corazón). Se actualiza al cambiar de página
  const [nFavoritos, setNFavoritos] = useState(0)
  const ruta = useLocation().pathname
  useEffect(() => {
    if (rol === 'cliente') api('/mi/favoritos').then((fs) => setNFavoritos(fs.length)).catch(() => {})
  }, [ruta, rol])

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
    <Suspense fallback={<p className="min-h-[60vh] p-6 text-tinta/60">Cargando…</p>}>
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/catalogo" element={<Catalogo />} />
      <Route path="/ofertas" element={<Ofertas />} />
      <Route path="/producto/:id" element={<Ficha />} />
      <Route path="/rastreo" element={<Rastreo />} />
      <Route path="/carrito" element={<Carrito />} />
      <Route path="/pago" element={<Pago />} />
      <Route path="/mis-compras" element={<MisCompras />} />
      <Route path="/mis-reparaciones" element={<MisReparaciones />} />
      <Route path="/mi-cuenta" element={<MiCuenta />} />
      <Route path="/reparaciones" element={<Reparaciones />} />
      <Route path="/mi-tienda" element={<MiTienda />} />
      <Route path="/privacidad" element={<Informacion tema="privacidad" />} />
      <Route path="/terminos" element={<Informacion tema="terminos" />} />
      <Route path="/favoritos" element={<Favoritos />} />
      <Route path="/login" element={<Login />} />
      <Route path="/encuesta" element={<Encuesta />} />
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
    </Suspense>
  )
  if (sesion && rol !== 'cliente' && RUTAS_PANEL.some((r) => pathname.startsWith(r))) {
    return <PanelGestion usuario={sesion.usuario} tema={tema} setTema={setTema} salir={salir}>{rutas}</PanelGestion>
  }
  // HU-27: la encuesta de gustos ocupa toda la pantalla, sin la cabecera de la tienda (como el prototipo)
  if (pathname === '/encuesta') return rutas

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
            <NavLink to="/reparaciones" className={enlace}>Reparaciones</NavLink>
          </nav>
          <form onSubmit={enviarBusqueda} role="search" className="order-last flex w-full items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 lg:order-none lg:w-auto lg:flex-1">
            <Icono nombre="buscar" tam={16} />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar: DualSense, FIFA 26, PS5…"
              aria-label="Buscar productos" className="w-full bg-transparent py-2 text-sm text-white placeholder:text-white/60 focus:outline-none" />
          </form>
          <div className="ml-auto flex items-center gap-2">
            {rol === 'cliente' && <Notificaciones />}
            {rol === 'cliente' && (
              <Link to="/favoritos" className={botonIcono} aria-label={'Favoritos, ' + nFavoritos + ' guardados'}>
                <Icono nombre="corazon" />
                {nFavoritos > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-morado px-1 text-xs font-semibold">{nFavoritos}</span>}
              </Link>
            )}
            <button type="button" onClick={() => setTema(tema === 'claro' ? 'oscuro' : 'claro')} className={botonIcono}
              aria-label={tema === 'claro' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}>
              <Icono nombre={tema === 'claro' ? 'luna' : 'sol'} />
            </button>
            <Link to="/carrito" className={botonIcono} aria-label={'Carrito, ' + enCarrito + ' productos'}>
              <Icono nombre="carrito" />
              {enCarrito > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rosa px-1 text-xs font-semibold">{enCarrito}</span>}
            </Link>
            {rol === 'cliente'
              ? <MenuCuenta nombre={sesion.usuario.nombre} email={sesion.usuario.email} salir={salir} />
              : sesion
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
      </header>

      {/* TT-03: alto mínimo para que el pie de página no "salte" mientras carga el catálogo */}
      <main className="mx-auto min-h-[75vh] max-w-6xl px-4 py-6 sm:px-8">
        {rutas}
      </main>

      <footer className="mt-10 bg-noche text-sm text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-8 sm:text-center">
          <div className="space-y-3 sm:justify-self-center">
            <p className="flex items-center gap-2 font-titulo text-base font-semibold sm:justify-center">
              <img src="/logo.jpg" alt="" className="h-9 w-9 rounded-full object-cover" />
              <span className="leading-tight sm:text-left">PLAY SHOP TEK<span className="block text-[11px] font-normal uppercase tracking-[0.14em] text-[#cfc7ff]">Villa El Salvador</span></span>
            </p>
            {/* HU-26: redes en círculos, como el prototipo */}
            <div className="flex gap-2 sm:justify-center">
              {[['https://www.facebook.com/PlayShopTek/', 'facebook', 'Facebook'], ['https://www.instagram.com/play_shop_tek/', 'instagram', 'Instagram'],
                ['https://www.tiktok.com/@playshoptek', 'tiktok', 'TikTok']].map(([url, ic, nombre]) => (
                <a key={nombre} href={url} target="_blank" rel="noreferrer" aria-label={nombre + ' de Play Shop Tek'}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/20 hover:bg-white/10"><Icono nombre={ic} tam={17} /></a>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#cfc7ff]">Ubícanos</p>
            <p>Av. Revolución 1420, Villa El Salvador, Lima Sur</p>
            <p className="text-white/75">Lunes a sábado 12:00–20:00 · Domingo 15:00–20:00</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#cfc7ff]">Información al cliente</p>
            <ul className="space-y-1.5">
              <li><Link to="/mi-tienda" className="hover:text-[#ff8fe4]">Mi tienda</Link></li>
              <li><Link to="/rastreo" className="hover:text-[#ff8fe4]">Rastrea tu reparación</Link></li>
              <li><Link to="/privacidad" className="hover:text-[#ff8fe4]">Políticas de privacidad</Link></li>
              <li><Link to="/terminos" className="hover:text-[#ff8fe4]">Términos y condiciones</Link></li>
              {/* La ley pide que el Libro de Reclamaciones se vea en la página principal */}
              <li><Link to="/libro-de-reclamaciones" className="hover:text-[#ff8fe4]">📕 Libro de Reclamaciones</Link></li>
            </ul>
          </div>
        </div>
        <p className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/65">© 2026 Play Shop Tek · Villa El Salvador, Lima Sur</p>
      </footer>

      {/* HU-20: botón flotante de WhatsApp (el asistente queda encima). HU-26: abre los asesores, como el prototipo */}
      <WhatsAppFlotante />
      <Asistente />
    </div>
  )
}
