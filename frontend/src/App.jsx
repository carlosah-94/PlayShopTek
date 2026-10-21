import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import Catalogo from './pages/Catalogo.jsx'
import Ficha from './pages/Ficha.jsx'
import Inventario from './pages/Inventario.jsx'
import Login from './pages/Login.jsx'
import Panel from './pages/Panel.jsx'
import Rastreo from './pages/Rastreo.jsx'
import Taller from './pages/Taller.jsx'
import { cerrarSesion, leerSesion } from './api.js'

export default function App() {
  const sesion = leerSesion()
  const navegar = useNavigate()
  const salir = () => { cerrarSesion(); navegar('/') }

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-8">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-wide">
          <img src="/logo.jpg" alt="" className="h-9 w-9 rounded-full object-cover" />
          PLAY SHOP TEK
        </Link>
        <nav className="ml-auto flex items-center gap-4 text-sm">
          <Link to="/" className="hover:text-rosa">Tienda</Link>
          <Link to="/rastreo" className="hover:text-rosa">Rastrear reparación</Link>
          {sesion && sesion.usuario.rol !== 'cliente' && <Link to="/panel" className="hover:text-rosa">Panel</Link>}
          {sesion && sesion.usuario.rol !== 'cliente' && <Link to="/taller" className="hover:text-rosa">Taller</Link>}
          {sesion && sesion.usuario.rol === 'dueno' && <Link to="/inventario" className="hover:text-rosa">Inventario</Link>}
          {sesion
            ? <button onClick={salir} className="rounded-lg border border-white/20 px-3 py-1.5">Salir ({sesion.usuario.nombre.split(' ')[0]})</button>
            : <Link to="/login" className="rounded-lg bg-rosa px-3 py-1.5 font-semibold text-white">Iniciar sesión</Link>}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <Routes>
          <Route path="/" element={<Catalogo />} />
          <Route path="/producto/:id" element={<Ficha />} />
          <Route path="/rastreo" element={<Rastreo />} />
          <Route path="/login" element={<Login />} />
          <Route path="/panel" element={<Panel />} />
          <Route path="/taller" element={<Taller />} />
          <Route path="/inventario" element={<Inventario />} />
        </Routes>
      </main>
    </div>
  )
}